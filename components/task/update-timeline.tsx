'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/errors';
import { fetchUpdates, insertProgressLog, type UpdateWithAuthor } from '@/lib/updates';
import { fetchLogReplies, type CommentWithAuthor } from '@/lib/comments';
import { saveComment } from '@/lib/mentions';
import { Avatar } from '@/components/avatar';
import { useProgressLog } from '@/components/progress-log-provider';

function formatWhen(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 페이지 하단 진행 로그 타임라인 (최신순) + 바로 쓰는 한 줄 입력.
 * 수정/삭제 버튼은 없다 — append-only. 오기재는 새 로그로 정정한다.
 */
export function UpdateTimeline({
  pageId,
  meId,
  initial,
  progressAuto = false,
}: {
  pageId: string;
  meId?: string;
  initial: UpdateWithAuthor[];
  /** 하위 업무 평균으로 진행률이 자동 계산되는 업무 — % 입력 숨김 (0014) */
  progressAuto?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { open: openLog } = useProgressLog();
  const [items, setItems] = useState<UpdateWithAuthor[]>(initial);
  const [text, setText] = useState('');
  const [pct, setPct] = useState(''); // 비우면 현재 진행률 유지
  const [saving, setSaving] = useState(false);
  // 로그별 답글 (comments.update_id, 0013)
  const [replies, setReplies] = useState<Map<string, CommentWithAuthor[]>>(new Map());
  const [replyOpen, setReplyOpen] = useState<string | null>(null);

  useEffect(() => {
    // 답글은 클라이언트에서 받는다 (0013 이전 DB 면 조용히 빈 목록)
    fetchLogReplies(supabase, pageId).then(setReplies).catch(() => {});
    const channel = supabase
      .channel(`updates-${pageId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'page_updates', filter: `page_id=eq.${pageId}` },
        async () => {
          // 작성자 join 이 필요하므로 다시 받는다 (팀 규모에서는 충분히 가볍다)
          try {
            setItems(await fetchUpdates(supabase, pageId));
          } catch {
            /* 다음 이벤트에 재시도 */
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments', filter: `page_id=eq.${pageId}` },
        () => {
          fetchLogReplies(supabase, pageId).then(setReplies).catch(() => {});
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, pageId]);

  const addReply = async (updateId: string, replyText: string) => {
    const content = replyText.trim();
    if (!content || !meId) return;
    // 답글은 한 문단짜리 본문으로 저장 (댓글과 같은 테이블)
    const body = [{ type: 'paragraph', content: [{ type: 'text', text: content, styles: {} }] }];
    try {
      await saveComment(supabase, { pageId, authorId: meId, body, updateId });
      setReplies(await fetchLogReplies(supabase, pageId));
      setReplyOpen(null);
    } catch (e) {
      toast.error(`답글 저장 실패: ${errorMessage(e)}`);
    }
  };

  const quickAdd = async () => {
    const content = text.trim();
    if (!content || !meId || saving) return;
    setSaving(true);
    try {
      // % 칸을 채우면 진행률도 함께 갱신 (상태도 의미에 따라 자동 전환), 비우면 현재 값 유지
      const { data: cur } = await supabase.from('pages').select('progress, status').eq('id', pageId).single();
      const nextProgress =
        pct.trim() !== '' ? Math.min(100, Math.max(0, Number(pct))) : (cur?.progress ?? 0);
      await insertProgressLog(supabase, {
        pageId,
        authorId: meId,
        content,
        progress: Number.isFinite(nextProgress) ? nextProgress : (cur?.progress ?? 0),
        currentStatus: cur?.status ?? null,
        blocker: null,
      });
      setText('');
      setPct('');
      setItems(await fetchUpdates(supabase, pageId));
    } catch (e) {
      toast.error(`진행 로그 저장 실패: ${errorMessage(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-3xl px-6 pb-24 sm:px-10">
      <h2 className="text-sm font-medium text-zinc-500">진행 로그 {items.length > 0 && `· ${items.length}`}</h2>

      {/* 바로 쓰는 입력 — 양식은 placeholder 로 안내, 여러 줄 가능 */}
      {meId && (
        <form
          className="mt-2 rounded-xl border border-zinc-200 focus-within:border-zinc-400"
          onSubmit={(e) => {
            e.preventDefault();
            void quickAdd();
          }}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                void quickAdd();
              }
            }}
            rows={text.includes('\n') || text.length > 60 ? 4 : 2}
            placeholder={'한 일: \n다음 할 일: '}
            className="w-full resize-none rounded-t-xl bg-transparent px-3 py-2 text-sm outline-none placeholder:text-zinc-400"
            disabled={saving}
          />
          <div className="flex items-center gap-2 border-t border-zinc-100 px-2 py-1.5">
            {!progressAuto && (
              <label
                className="flex shrink-0 items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-500"
                title="비우면 진행률 유지, 숫자를 넣으면 진행률도 함께 갱신"
              >
                진행률
                <input
                  value={pct}
                  onChange={(e) => setPct(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
                  placeholder="––"
                  inputMode="numeric"
                  className="w-7 bg-transparent text-right text-sm tabular-nums outline-none placeholder:text-zinc-300"
                  disabled={saving}
                  aria-label="진행률"
                />
                %
              </label>
            )}
            <button
              type="button"
              onClick={() => openLog(pageId)}
              className="shrink-0 rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-50"
              title="멘션·막힘까지 함께 기록하는 자세한 양식"
            >
              ⛔ 막힘 기록
            </button>
            <span className="ml-auto hidden text-[10px] text-zinc-300 sm:inline">⌃Enter</span>
            <button
              type="submit"
              disabled={saving || !text.trim()}
              className="shrink-0 rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
            >
              남기기
            </button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-400">
          아직 진행 로그가 없습니다. 위 입력창에 남겨보세요 — 진행률 숫자는 로그와 함께만 바뀝니다.
        </p>
      ) : (
        <ol className="mt-3 space-y-3">
          {items.map((u) => (
            <li
              key={u.id}
              className={[
                'rounded-xl border px-4 py-3',
                u.blocker
                  ? 'border-red-200 bg-red-50/60 dark:border-red-900/60 dark:bg-red-950/30'
                  : 'border-zinc-200 dark:border-zinc-800',
              ].join(' ')}
            >
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Avatar name={u.author?.name ?? '?'} src={u.author?.avatar_url} size={20} />
                <span className="font-medium text-zinc-700 dark:text-zinc-200">{u.author?.name ?? '알 수 없음'}</span>
                <time dateTime={u.created_at}>{formatWhen(u.created_at)}</time>
                {u.progress_snapshot !== null && (
                  <span className="ml-auto rounded bg-zinc-100 px-1.5 py-0.5 tabular-nums dark:bg-zinc-800">
                    {u.progress_snapshot}%
                  </span>
                )}
                {u.status_snapshot && (
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">{u.status_snapshot}</span>
                )}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{u.content}</p>
              {u.blocker && (
                <p className="mt-2 flex items-start gap-1.5 text-sm text-red-700 dark:text-red-300">
                  <span aria-hidden="true">⛔</span>
                  <span>
                    <span className="font-medium">막힘:</span> {u.blocker}
                  </span>
                </p>
              )}

              {/* 로그 답글 */}
              {(replies.get(u.id) ?? []).map((c) => (
                <div key={c.id} className="mt-2 flex items-start gap-2 border-l-2 border-zinc-100 pl-3 text-sm">
                  <Avatar name={c.author?.name ?? '?'} src={c.author?.avatar_url} size={16} />
                  <div className="min-w-0">
                    <span className="mr-1.5 text-xs font-medium text-zinc-600">{c.author?.name ?? '알 수 없음'}</span>
                    <span className="mr-1.5 text-[10px] text-zinc-400">{formatWhen(c.created_at)}</span>
                    <span className="whitespace-pre-wrap text-zinc-700">{c.body_text}</span>
                  </div>
                </div>
              ))}
              {meId &&
                (replyOpen === u.id ? (
                  <ReplyInput onSubmit={(v) => void addReply(u.id, v)} onCancel={() => setReplyOpen(null)} />
                ) : (
                  <button
                    type="button"
                    onClick={() => setReplyOpen(u.id)}
                    className="mt-1.5 text-[11px] text-zinc-400 hover:text-zinc-700 hover:underline"
                  >
                    답글 달기
                  </button>
                ))}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function ReplyInput({ onSubmit, onCancel }: { onSubmit: (v: string) => void; onCancel: () => void }) {
  const [v, setV] = useState('');
  return (
    <form
      className="mt-2 flex items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(v);
      }}
    >
      <input
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onCancel()}
        placeholder="답글…"
        className="min-w-0 flex-1 rounded-md border border-zinc-200 px-2 py-1 text-sm outline-none focus:border-zinc-400"
      />
      <button type="submit" disabled={!v.trim()} className="rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-medium text-white disabled:opacity-40">
        답글
      </button>
      <button type="button" onClick={onCancel} className="rounded-md px-1.5 py-1 text-[11px] text-zinc-400 hover:bg-zinc-100">
        취소
      </button>
    </form>
  );
}
