'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/errors';
import {
  PAGE_PRIORITIES,
  PAGE_STATUSES,
  type PagePriority,
  type PageRow,
  type PageStatus,
} from '@/lib/types';
import { Avatar } from '@/components/avatar';
import { useProgressLog } from '@/components/progress-log-provider';

export type AssigneeOption = { id: string; name: string; avatar_url: string | null };

type TaskFields = Pick<PageRow, 'status' | 'assignee_id' | 'progress' | 'due_date' | 'priority'>;

const STATUS_COLOR: Record<PageStatus, string> = {
  대기: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200',
  진행: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200',
  검토: 'bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-200',
  완료: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200',
  보류: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200',
  드롭: 'bg-zinc-200 text-zinc-500 line-through dark:bg-zinc-800 dark:text-zinc-400',
};

const PRIORITY_COLOR: Record<PagePriority, string> = {
  긴급: 'text-red-600 dark:text-red-400',
  높음: 'text-orange-600 dark:text-orange-400',
  보통: 'text-zinc-600 dark:text-zinc-300',
  낮음: 'text-zinc-400',
};

/**
 * type='task' 페이지 상단 속성 바 (한 줄).
 * 각 필드는 변경 즉시 optimistic 반영 → 저장 실패 시 되돌리고 토스트.
 * 다른 사람이 바꾸거나 진행 로그 트리거가 갱신하면 Realtime 으로 따라온다.
 */
export function PropertyBar({ page, assignees }: { page: PageRow; assignees: AssigneeOption[] }) {
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

  // 이 페이지 행의 변경을 구독 (진행 로그 INSERT 트리거 / 다른 사용자 편집)
  useEffect(() => {
    const channel = supabase
      .channel(`page-${page.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pages', filter: `id=eq.${page.id}` },
        (payload) => {
          const row = payload.new as PageRow;
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
    setFields({ ...prev, ...patch });
    const { error } = await supabase.from('pages').update(patch).eq('id', page.id);
    if (error) {
      setFields(prev);
      toast.error(`저장 실패: ${errorMessage(error)}`);
    }
  };

  const assignee = assignees.find((a) => a.id === fields.assignee_id) ?? null;
  const status = (fields.status ?? '대기') as PageStatus;
  const progress = fields.progress ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-2 px-6 pt-4 text-sm sm:px-10">
      {/* 상태 */}
      <label className="relative">
        <span className="sr-only">상태</span>
        <select
          value={status}
          onChange={(e) => update({ status: e.target.value as PageStatus })}
          className={`appearance-none rounded-md px-2.5 py-1 pr-6 text-xs font-medium outline-none ${STATUS_COLOR[status]}`}
        >
          {PAGE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <Chevron />
      </label>

      {/* 담당자 */}
      <label className="relative flex items-center gap-1.5 rounded-md border border-zinc-200 py-0.5 pl-1.5 pr-6 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900">
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

      {/* 진행률 */}
      <label className="flex items-center gap-2 rounded-md border border-zinc-200 px-2 py-0.5 dark:border-zinc-700">
        <span className="text-xs text-zinc-500">진행률</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={progress}
          onChange={(e) => setFields((f) => ({ ...f, progress: Number(e.target.value) }))}
          onMouseUp={(e) => update({ progress: Number((e.target as HTMLInputElement).value) })}
          onTouchEnd={(e) => update({ progress: Number((e.target as HTMLInputElement).value) })}
          onKeyUp={(e) => update({ progress: Number((e.target as HTMLInputElement).value) })}
          className="h-1 w-24 accent-blue-600"
          aria-label="진행률"
        />
        <span className="w-8 text-right text-xs tabular-nums">{progress}%</span>
      </label>

      {/* 기한 */}
      <label className="flex items-center gap-1.5 rounded-md border border-zinc-200 px-2 py-0.5 dark:border-zinc-700">
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
      <label className="relative">
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
        className="ml-auto rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
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
