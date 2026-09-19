'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/errors';
import {
  DEFAULT_STATUSES,
  PAGE_PRIORITIES,
  type PagePriority,
  type PageRow,
  type StatusRow,
} from '@/lib/types';
import { Avatar } from '@/components/avatar';
import { PRIORITY_COLOR, statusClass } from '@/lib/status-style';
import { insertAutoLog } from '@/lib/updates';
import { useProgressLog } from '@/components/progress-log-provider';

export type AssigneeOption = { id: string; name: string; avatar_url: string | null };

type TaskFields = Pick<PageRow, 'status' | 'assignee_id' | 'progress' | 'due_date' | 'priority'>;

/**
 * type='task' 페이지 상단 속성 바 (한 줄).
 * 각 필드는 변경 즉시 optimistic 반영 → 저장 실패 시 되돌리고 토스트.
 * 다른 사람이 바꾸거나 진행 로그 트리거가 갱신하면 Realtime 으로 따라온다.
 */
export function PropertyBar({
  page,
  assignees,
  meId,
  statuses = DEFAULT_STATUSES,
  initialPeople = [],
  progressAuto = false,
}: {
  page: PageRow;
  assignees: AssigneeOption[];
  meId?: string;
  statuses?: StatusRow[];
  /** 참여자(다중) user id 목록 — page_people (0013) */
  initialPeople?: string[];
  /** 하위 업무가 있어 진행률이 자동 계산되는 업무 (0014) — 슬라이더 잠금 */
  progressAuto?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { open: openLog } = useProgressLog();
  const [fields, setFields] = useState<TaskFields>({
    status: page.status,
    assignee_id: page.assignee_id,
    progress: page.progress,
    due_date: page.due_date,
    priority: page.priority,
  });
  const fieldsRef = useRef(fields);
  useEffect(() => {
    fieldsRef.current = fields;
  }, [fields]);

  // 마지막으로 "저장된" 값 — 자동 기록의 비교 기준.
  // (fields 는 조작 중에 먼저 바뀌므로 비교 기준으로 쓰면 안 된다.
  //  서버 값 변경은 아래 Realtime 핸들러가 갱신한다)
  const committedRef = useRef({ status: page.status, progress: page.progress });

  // 이 페이지 행의 변경을 구독 (진행 로그 INSERT 트리거 / 다른 사용자 편집)
  useEffect(() => {
    const channel = supabase
      .channel(`page-${page.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pages', filter: `id=eq.${page.id}` },
        (payload) => {
          const row = payload.new as PageRow;
          committedRef.current = { status: row.status, progress: row.progress };
          setFields({
            status: row.status,
            assignee_id: row.assignee_id,
            progress: row.progress,
            due_date: row.due_date,
            priority: row.priority,
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, page.id]);

  const update = async (patch: Partial<TaskFields>) => {
    const prev = fieldsRef.current;
    const committed = { ...committedRef.current };
    setFields({ ...prev, ...patch });
    const { error } = await supabase.from('pages').update(patch).eq('id', page.id);
    if (error) {
      setFields(prev);
      toast.error(`저장 실패: ${errorMessage(error)}`);
      return;
    }
    // 상태 변경은 "누가 바꿨는지" 타임라인에 자동 기록
    if (meId && patch.status !== undefined && patch.status !== committed.status) {
      committedRef.current = { ...committedRef.current, status: patch.status };
      try {
        await insertAutoLog(supabase, {
          pageId: page.id,
          authorId: meId,
          content: `상태 변경: ${committed.status ?? '없음'} → ${patch.status}`,
          progress: committed.progress,
          status: patch.status,
        });
      } catch {
        // 자동 기록 실패는 조용히 넘어간다 (본 저장은 이미 성공)
      }
    }
  };

  // 참여자(다중) — 담당자와 별개로 함께 하는 사람들
  const [people, setPeople] = useState<Set<string>>(new Set(initialPeople));
  // 속성 바가 overflow-x 스크롤 영역이라, 목록창은 fixed 로 화면 좌표에 띄운다 (잘림 방지)
  const [peopleOpen, setPeopleOpen] = useState<{ x: number; y: number } | null>(null);
  const togglePerson = async (userId: string, add: boolean) => {
    setPeople((prev) => {
      const next = new Set(prev);
      if (add) next.add(userId);
      else next.delete(userId);
      return next;
    });
    const q = add
      ? await supabase.from('page_people').insert({ page_id: page.id, user_id: userId, added_by: meId ?? null })
      : await supabase.from('page_people').delete().eq('page_id', page.id).eq('user_id', userId);
    if (q.error) {
      setPeople((prev) => {
        const next = new Set(prev);
        if (add) next.delete(userId);
        else next.add(userId);
        return next;
      });
      toast.error(`참여자 변경 실패: ${errorMessage(q.error)}`);
    }
  };

  const assignee = assignees.find((a) => a.id === fields.assignee_id) ?? null;
  const status = fields.status ?? '대기';
  const progress = fields.progress ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-wrap items-center gap-x-2 gap-y-1.5 px-6 pt-4 text-sm sm:px-12">
      {/* 상태 */}
      <label className="relative shrink-0">
        <span className="sr-only">상태</span>
        <select
          value={status}
          onChange={(e) => update({ status: e.target.value })}
          className={`appearance-none rounded-md px-2.5 py-1 pr-6 text-xs font-medium outline-none ${statusClass(status, statuses)}`}
        >
          {statuses.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
            </option>
          ))}
          {!statuses.some((s) => s.name === status) && <option value={status}>{status}</option>}
        </select>
        <Chevron />
      </label>

      {/* 담당자 */}
      <label className="relative flex shrink-0 items-center gap-1.5 rounded-md border border-zinc-200 py-0.5 pl-1.5 pr-6 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900">
        <span className="sr-only">담당자</span>
        {assignee ? (
          <Avatar name={assignee.name} src={assignee.avatar_url} size={18} />
        ) : (
          <span className="inline-block h-[18px] w-[18px] rounded-full border border-dashed border-zinc-400" />
        )}
        <select
          value={fields.assignee_id ?? ''}
          onChange={(e) => update({ assignee_id: e.target.value || null })}
          className="appearance-none bg-transparent text-xs outline-none"
        >
          <option value="">담당자 없음</option>
          {assignees.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <Chevron />
      </label>
      {meId && fields.assignee_id !== meId && (
        <button
          type="button"
          onClick={() => update({ assignee_id: meId })}
          className="shrink-0 rounded-md border border-dashed border-zinc-300 px-2 py-0.5 text-xs text-zinc-500 hover:bg-zinc-50"
          title="담당자를 나로 지정"
        >
          나에게
        </button>
      )}

      {/* 참여자 (여러 명) */}
      <div className="shrink-0">
        <button
          type="button"
          onClick={(e) => {
            if (peopleOpen) {
              setPeopleOpen(null);
              return;
            }
            const r = e.currentTarget.getBoundingClientRect();
            setPeopleOpen({ x: Math.max(8, Math.min(r.left, window.innerWidth - 216)), y: r.bottom + 4 });
          }}
          className="flex items-center gap-1 rounded-md border border-zinc-200 py-0.5 pl-1.5 pr-2 hover:bg-zinc-50"
          title="이 업무에 함께 하는 사람들"
        >
          {people.size > 0 ? (
            <span className="flex -space-x-1.5">
              {assignees
                .filter((a) => people.has(a.id))
                .slice(0, 4)
                .map((a) => (
                  <span key={a.id} className="rounded-full ring-2 ring-white">
                    <Avatar name={a.name} src={a.avatar_url} size={18} />
                  </span>
                ))}
            </span>
          ) : (
            <span className="text-xs text-zinc-400">참여자</span>
          )}
          {people.size > 4 && <span className="text-[10px] text-zinc-500">+{people.size - 4}</span>}
          <span className="text-xs text-zinc-400">＋</span>
        </button>
        {peopleOpen && (
          <>
            <div className="fixed inset-0 z-40" onMouseDown={() => setPeopleOpen(null)} />
            <div
              className="fixed z-50 max-h-64 w-52 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-1 shadow-lg"
              style={{ left: peopleOpen.x, top: peopleOpen.y }}
            >
              <p className="px-2 py-1 text-[11px] text-zinc-400">함께 하는 사람 (담당자와 별개)</p>
              {assignees.map((a) => (
                <label key={a.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-zinc-50">
                  <input
                    type="checkbox"
                    checked={people.has(a.id)}
                    onChange={(e) => void togglePerson(a.id, e.target.checked)}
                  />
                  <Avatar name={a.name} src={a.avatar_url} size={18} />
                  <span className="truncate">{a.name}</span>
                </label>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 진행률 — 표시만. 변경은 반드시 진행 로그를 남기면서 (기록 없는 숫자 변경 방지) */}
      <div
        className="flex shrink-0 items-center gap-2 rounded-md border border-zinc-200 px-2 py-1 dark:border-zinc-700"
        title={
          progressAuto
            ? '하위 업무 진행률의 평균으로 자동 계산됩니다'
            : '진행률은 진행 로그를 남기면서 바꿉니다 (누가 언제 왜 바꿨는지 남도록)'
        }
      >
        <span className="text-xs text-zinc-500">진행률{progressAuto && ' 🔒'}</span>
        <span className="h-1.5 w-20 overflow-hidden rounded-full bg-zinc-200" aria-hidden="true">
          <span className="block h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </span>
        <span className="w-8 text-right text-xs tabular-nums">{progress}%</span>
        {!progressAuto && (
          <button
            type="button"
            onClick={() => openLog(page.id)}
            className="rounded border border-zinc-200 px-1.5 py-0.5 text-[10px] text-zinc-500 hover:bg-zinc-50"
          >
            변경
          </button>
        )}
      </div>

      {/* 기한 */}
      <label className="flex shrink-0 items-center gap-1.5 rounded-md border border-zinc-200 px-2 py-0.5 dark:border-zinc-700">
        <span className="text-xs text-zinc-500">기한</span>
        <input
          type="date"
          value={fields.due_date ?? ''}
          onChange={(e) => update({ due_date: e.target.value || null })}
          className="bg-transparent text-xs outline-none"
          aria-label="기한"
        />
      </label>

      {/* 우선순위 */}
      <label className="relative shrink-0">
        <span className="sr-only">우선순위</span>
        <select
          value={fields.priority ?? ''}
          onChange={(e) => update({ priority: (e.target.value || null) as PagePriority | null })}
          className={`appearance-none rounded-md border border-zinc-200 bg-transparent px-2 py-1 pr-6 text-xs outline-none dark:border-zinc-700 ${
            fields.priority ? PRIORITY_COLOR[fields.priority as PagePriority] : 'text-zinc-400'
          }`}
        >
          <option value="">우선순위</option>
          {PAGE_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <Chevron />
      </label>

      <button
        type="button"
        onClick={() => openLog(page.id)}
        className="ml-auto shrink-0 rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-700"
      >
        진행 기록 <kbd className="ml-1 opacity-60">⌃⇧L</kbd>
      </button>
    </div>
  );
}

function Chevron() {
  return (
    <svg
      aria-hidden="true"
      width="10"
      height="10"
      viewBox="0 0 10 10"
      className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400"
    >
      <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
