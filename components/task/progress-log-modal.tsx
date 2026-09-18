'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/errors';
import { insertProgressLog, notifyLogMentions } from '@/lib/updates';
import type { Me } from '@/lib/types';
import { Avatar } from '@/components/avatar';

type TaskLite = { id: string; title: string; status: string | null; progress: number | null };
type Person = { id: string; name: string; avatar_url: string | null };

/**
 * 진행 로그 입력 모달. 구성은 정확히 3개:
 *   1) 텍스트 한 줄 (@ 멘션 자동완성)
 *   2) 진행률 슬라이더 (현재 값이 기본)
 *   3) "막힌 게 있나요?" 토글 → blocker 입력
 * 제출은 page_updates INSERT 만. pages 는 트리거가 갱신한다.
 * 필드를 더 추가하지 말 것 — 30초를 넘기면 아무도 안 쓴다.
 */
export function ProgressLogModal({
  me,
  initialPageId,
  onClose,
}: {
  me: Me;
  initialPageId: string | null;
  onClose: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [task, setTask] = useState<TaskLite | null>(null);
  const [taskLoading, setTaskLoading] = useState(!!initialPageId);
  const [candidates, setCandidates] = useState<TaskLite[]>([]);
  const [taskQuery, setTaskQuery] = useState('');

  const [content, setContent] = useState('');
  const [progress, setProgress] = useState(0);
  const [blockerOpen, setBlockerOpen] = useState(false);
  const [blocker, setBlocker] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [people, setPeople] = useState<Person[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const mentioned = useRef<Map<string, string>>(new Map());
  const textRef = useRef<HTMLTextAreaElement>(null);

  // 대상 업무 로드
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (initialPageId) {
        const { data } = await supabase
          .from('pages')
          .select('id, title, status, progress')
          .eq('id', initialPageId)
          .eq('type', 'task')
          .maybeSingle();
        if (!cancelled) {
          setTask(data ?? null);
          setProgress(data?.progress ?? 0);
          setTaskLoading(false);
        }
      }
      // 선택 후보: 내 진행 중 업무 (최근 수정순)
      const { data: mine } = await supabase
        .from('pages')
        .select('id, title, status, progress')
        .eq('type', 'task')
        .eq('assignee_id', me.id)
        .in('status', ['대기', '진행', '검토'])
        .is('archived_at', null)
        .order('updated_at', { ascending: false })
        .limit(20);
      if (!cancelled) setCandidates(mine ?? []);

      const { data: ppl } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .is('deactivated_at', null)
        .order('name');
      if (!cancelled) setPeople(ppl ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, initialPageId, me.id]);

  // 업무 검색 (후보에 없을 때)
  useEffect(() => {
    if (task || taskQuery.trim().length < 1) return;
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('pages')
        .select('id, title, status, progress')
        .eq('type', 'task')
        .is('archived_at', null)
        .ilike('title', `%${taskQuery.trim()}%`)
        .order('updated_at', { ascending: false })
        .limit(20);
      setCandidates(data ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [supabase, task, taskQuery]);

  useEffect(() => {
    if (task) textRef.current?.focus();
  }, [task]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mentionQuery === null) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, mentionQuery]);

  // ---- 멘션 자동완성 ----
  const mentionMatches = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return people.filter((p) => p.id !== me.id && p.name.toLowerCase().includes(q)).slice(0, 6);
  }, [people, mentionQuery, me.id]);

  const detectMention = (value: string, caret: number) => {
    const before = value.slice(0, caret);
    const m = /(?:^|\s)@([^\s@]*)$/.exec(before);
    setMentionQuery(m ? m[1] : null);
    setMentionIndex(0);
  };

  const pickMention = (p: Person) => {
    const el = textRef.current;
    if (!el) return;
    const caret = el.selectionStart;
    const before = content.slice(0, caret).replace(/@[^\s@]*$/, `@${p.name} `);
    const after = content.slice(caret);
    mentioned.current.set(p.id, p.name);
    setContent(before + after);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(before.length, before.length);
    });
  };

  const submit = async () => {
    if (!task) return;
    if (content.trim().length === 0) {
      toast.error('한 줄이라도 적어주세요');
      return;
    }
    setSubmitting(true);
    try {
      await insertProgressLog(supabase, {
        pageId: task.id,
        authorId: me.id,
        content,
        progress,
        currentStatus: task.status,
        blocker: blockerOpen ? blocker : null,
      });
      void notifyLogMentions(supabase, {
        pageId: task.id,
        pageTitle: task.title,
        actorId: me.id,
        actorName: me.name,
        content,
        mentioned: [...mentioned.current].map(([id, name]) => ({ id, name })),
      }).catch(() => {});
      toast.success('기록했습니다');
      onClose();
    } catch (e) {
      toast.error(`기록 실패: ${errorMessage(e)}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="진행 로그 기록"
        className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-2xl dark:bg-zinc-900 sm:rounded-2xl"
      >
        {/* 대상 업무 */}
        {taskLoading ? (
          <div className="h-6 w-40 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
        ) : task ? (
          <div className="flex items-center gap-2 text-sm">
            <span aria-hidden="true">☑</span>
            <span className="min-w-0 flex-1 truncate font-medium">{task.title}</span>
            {task.status && (
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {task.status}
              </span>
            )}
            {!initialPageId && (
              <button
                type="button"
                onClick={() => setTask(null)}
                className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                변경
              </button>
            )}
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium">어느 업무의 진행 상황인가요?</p>
            <input
              autoFocus
              value={taskQuery}
              onChange={(e) => setTaskQuery(e.target.value)}
              placeholder="업무 이름으로 검색"
              className="mt-2 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-zinc-700"
            />
            <ul className="mt-2 max-h-56 divide-y divide-zinc-100 overflow-y-auto rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {candidates.length === 0 && (
                <li className="px-3 py-3 text-center text-xs text-zinc-400">
                  {taskQuery ? '검색 결과가 없습니다' : '내게 배정된 진행 중 업무가 없습니다. 이름으로 검색해 보세요.'}
                </li>
              )}
              {candidates.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setTask(c);
                      setProgress(c.progress ?? 0);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    <span className="min-w-0 flex-1 truncate">{c.title}</span>
                    <span className="text-xs text-zinc-400">{c.progress ?? 0}%</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {task && (
          <>
            {/* 1) 텍스트 한 줄 */}
            <div className="relative mt-4">
              <textarea
                ref={textRef}
                rows={2}
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  detectMention(e.target.value, e.target.selectionStart);
                }}
                onKeyDown={(e) => {
                  if (mentionQuery !== null && mentionMatches.length > 0) {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setMentionIndex((i) => (i + 1) % mentionMatches.length);
                      return;
                    }
                    if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setMentionIndex((i) => (i - 1 + mentionMatches.length) % mentionMatches.length);
                      return;
                    }
                    if (e.key === 'Enter' || e.key === 'Tab') {
                      e.preventDefault();
                      pickMention(mentionMatches[mentionIndex]);
                      return;
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      setMentionQuery(null);
                      return;
                    }
                  }
                  if (e.key === 'Enter' && !e.shiftKey && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void submit();
                  }
                }}
                placeholder="오늘 뭘 했나요? (@로 동료 언급)"
                className="w-full resize-none rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-zinc-700"
              />
              {mentionQuery !== null && mentionMatches.length > 0 && (
                <ul
                  role="listbox"
                  className="absolute left-0 top-full z-10 mt-1 w-56 rounded-md border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {mentionMatches.map((p, i) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={i === mentionIndex}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pickMention(p)}
                        className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm ${
                          i === mentionIndex ? 'bg-zinc-100 dark:bg-zinc-800' : ''
                        }`}
                      >
                        <Avatar name={p.name} src={p.avatar_url} size={18} />
                        {p.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* 2) 진행률 슬라이더 */}
            <label className="mt-3 flex items-center gap-3 text-sm">
              <span className="w-12 shrink-0 text-zinc-500">진행률</span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={progress}
                onChange={(e) => setProgress(Number(e.target.value))}
                className="flex-1 accent-blue-600"
              />
              <span className="w-10 text-right tabular-nums">{progress}%</span>
            </label>

            {/* 3) 막힘 토글 */}
            <div className="mt-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={blockerOpen}
                  onChange={(e) => setBlockerOpen(e.target.checked)}
                  className="accent-red-600"
                />
                막힌 게 있나요?
              </label>
              {blockerOpen && (
                <input
                  autoFocus
                  value={blocker}
                  onChange={(e) => setBlocker(e.target.value)}
                  placeholder="무엇이 막혀 있나요? (예: 법무 회신 대기)"
                  className="mt-2 w-full rounded-md border border-red-300 bg-red-50/40 px-3 py-1.5 text-sm outline-none focus:border-red-500 dark:border-red-900 dark:bg-red-950/20"
                />
              )}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <span className="mr-auto text-xs text-zinc-400">⌘/Ctrl+Enter 로 제출</span>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={submitting}
                className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {submitting ? '기록 중…' : '기록'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
