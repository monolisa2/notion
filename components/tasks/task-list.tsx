'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/errors';
import { PAGE_STATUSES, type PageStatus } from '@/lib/types';
import { PRIORITY_COLOR, RISK_COLOR, STATUS_COLOR, statusClass } from '@/lib/status-style';
import type { TaskRow } from '@/lib/tasks';
import { Avatar } from '@/components/avatar';
import type { Person } from '@/hooks/use-people';

type View = 'table' | 'kanban';
type DueFilter = 'all' | 'overdue' | 'today' | 'week' | 'none';

const DUE_OPTIONS: { value: DueFilter; label: string }[] = [
  { value: 'all', label: '기한 전체' },
  { value: 'overdue', label: '초과' },
  { value: 'today', label: '오늘' },
  { value: 'week', label: '7일 이내' },
  { value: 'none', label: '기한 없음' },
];

function todayStr() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function addDays(s: string, n: number) {
  const d = new Date(s + 'T00:00:00');
  d.setDate(d.getDate() + n);
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function riskOf(due: string | null, today: string): string | null {
  if (!due) return null;
  if (due < today) return '초과';
  if (due === today) return '오늘';
  if (due <= addDays(today, 3)) return '임박';
  return null;
}

/**
 * 업무 목록: 테이블 / 칸반(status) 토글, 필터는 URL 쿼리로 유지.
 * (라벨 필터는 0006 마이그레이션을 실행하지 않았으므로 없음)
 */
export function TaskList({ tasks, people }: { tasks: TaskRow[]; people: Person[] }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const view = (params.get('view') as View) || 'table';
  const assignee = params.get('assignee') ?? '';
  const status = params.get('status') ?? '';
  const due = (params.get('due') as DueFilter) || 'all';
  const showClosed = params.get('closed') === '1';

  const setParam = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === '' || v === 'all' || (k === 'view' && v === 'table')) next.delete(k);
        else next.set(k, v);
      }
      const q = next.toString();
      router.replace(q ? `${pathname}?${q}` : pathname);
    },
    [params, pathname, router],
  );

  // 다른 사람이 바꾸면 서버 데이터 새로 받기
  useEffect(() => {
    const channel = supabase
      .channel('tasks-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pages' }, () => router.refresh())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, router]);

  const today = todayStr();
  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (!showClosed && !status && (t.status === '완료' || t.status === '드롭')) return false;
      if (assignee === 'none' ? t.assignee_id !== null : assignee && t.assignee_id !== assignee) return false;
      if (status && t.status !== status) return false;
      if (due === 'none' && t.due_date) return false;
      if (due === 'overdue' && !(t.due_date && t.due_date < today)) return false;
      if (due === 'today' && t.due_date !== today) return false;
      if (due === 'week' && !(t.due_date && t.due_date >= today && t.due_date <= addDays(today, 7))) return false;
      return true;
    });
  }, [tasks, assignee, status, due, showClosed, today]);

  const changeStatus = async (id: string, next: PageStatus) => {
    const { error } = await supabase.from('pages').update({ status: next }).eq('id', id);
    if (error) toast.error(`상태 변경 실패: ${errorMessage(error)}`);
    else router.refresh();
  };

  const select =
    'rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs outline-none dark:border-zinc-700 dark:bg-zinc-900';

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8 sm:px-8">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-2xl font-semibold tracking-tight">업무 목록</h1>
        <span className="text-sm text-zinc-400">{filtered.length}건</span>

        <div className="ml-auto flex items-center gap-1 rounded-md border border-zinc-200 p-0.5 dark:border-zinc-700">
          {(['table', 'kanban'] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setParam({ view: v })}
              className={`rounded px-2.5 py-1 text-xs ${
                view === v ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              {v === 'table' ? '테이블' : '칸반'}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select value={assignee} onChange={(e) => setParam({ assignee: e.target.value })} className={select} aria-label="담당자 필터">
          <option value="">담당자 전체</option>
          <option value="none">미지정</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setParam({ status: e.target.value })} className={select} aria-label="상태 필터">
          <option value="">상태 전체</option>
          {PAGE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={due} onChange={(e) => setParam({ due: e.target.value })} className={select} aria-label="기한 필터">
          {DUE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {!status && (
          <label className="flex items-center gap-1.5 text-xs text-zinc-500">
            <input type="checkbox" checked={showClosed} onChange={(e) => setParam({ closed: e.target.checked ? '1' : null })} />
            완료·드롭 포함
          </label>
        )}
        {(assignee || status || due !== 'all' || showClosed) && (
          <button
            type="button"
            onClick={() => setParam({ assignee: null, status: null, due: null, closed: null })}
            className="text-xs text-zinc-400 underline hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            초기화
          </button>
        )}
      </div>

      <div className="mt-4">
        {view === 'table' ? (
          <TaskTable rows={filtered} today={today} onStatus={changeStatus} />
        ) : (
          <Kanban rows={filtered} today={today} onStatus={changeStatus} />
        )}
      </div>
    </div>
  );
}

function DueCell({ due, today }: { due: string | null; today: string }) {
  if (!due) return <span className="text-zinc-300 dark:text-zinc-600">–</span>;
  const risk = riskOf(due, today);
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] tabular-nums ${risk ? RISK_COLOR[risk] : 'text-zinc-500'}`}>
      {due}
    </span>
  );
}

function TaskTable({
  rows,
  today,
  onStatus,
}: {
  rows: TaskRow[];
  today: string;
  onStatus: (id: string, s: PageStatus) => void;
}) {
  if (rows.length === 0) {
    return <p className="py-16 text-center text-sm text-zinc-400">조건에 맞는 업무가 없습니다.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-zinc-50 text-left text-[11px] text-zinc-500 dark:bg-zinc-900">
          <tr>
            <th className="px-3 py-2 font-normal">업무</th>
            <th className="px-3 py-2 font-normal">상태</th>
            <th className="px-3 py-2 font-normal">담당자</th>
            <th className="px-3 py-2 font-normal">진행률</th>
            <th className="px-3 py-2 font-normal">기한</th>
            <th className="px-3 py-2 font-normal">우선순위</th>
            <th className="px-3 py-2 font-normal">수정</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className="border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/60">
              <td className="max-w-md px-3 py-2">
                <Link href={`/p/${t.id}`} className="block truncate hover:underline">
                  {t.icon ?? '☑'} {t.title}
                </Link>
              </td>
              <td className="px-3 py-2">
                <select
                  value={t.status ?? '대기'}
                  onChange={(e) => onStatus(t.id, e.target.value as PageStatus)}
                  className={`rounded px-1.5 py-0.5 text-[11px] font-medium outline-none ${statusClass(t.status)}`}
                  aria-label="상태"
                >
                  {PAGE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2">
                {t.assignee ? (
                  <span className="flex items-center gap-1.5">
                    <Avatar name={t.assignee.name} src={t.assignee.avatar_url} size={18} />
                    {t.assignee.name}
                  </span>
                ) : (
                  <span className="text-zinc-400">미지정</span>
                )}
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-16 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
                    <div className="h-full bg-blue-500" style={{ width: `${t.progress ?? 0}%` }} />
                  </div>
                  <span className="w-8 text-xs tabular-nums text-zinc-500">{t.progress ?? 0}%</span>
                </div>
              </td>
              <td className="px-3 py-2">
                <DueCell due={t.due_date} today={today} />
              </td>
              <td className={`px-3 py-2 text-xs ${t.priority ? PRIORITY_COLOR[t.priority as keyof typeof PRIORITY_COLOR] : 'text-zinc-300'}`}>
                {t.priority ?? '–'}
              </td>
              <td className="px-3 py-2 text-xs text-zinc-400">{t.updated_at.slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Kanban({
  rows,
  today,
  onStatus,
}: {
  rows: TaskRow[];
  today: string;
  onStatus: (id: string, s: PageStatus) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<PageStatus | null>(null);

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {PAGE_STATUSES.map((s) => {
        const col = rows.filter((t) => t.status === s);
        return (
          <div
            key={s}
            onDragOver={(e) => {
              if (!dragId) return;
              e.preventDefault();
              if (over !== s) setOver(s);
            }}
            onDragLeave={() => over === s && setOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              if (dragId) onStatus(dragId, s);
              setDragId(null);
              setOver(null);
            }}
            className={`flex w-64 shrink-0 flex-col rounded-xl border p-2 ${
              over === s ? 'border-blue-400 bg-blue-50/40 dark:bg-blue-950/20' : 'border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40'
            }`}
          >
            <div className="flex items-center gap-2 px-1 py-1">
              <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${STATUS_COLOR[s]}`}>{s}</span>
              <span className="text-xs text-zinc-400">{col.length}</span>
            </div>
            <ul className="mt-1 flex-1 space-y-2">
              {col.map((t) => (
                <li
                  key={t.id}
                  draggable
                  onDragStart={() => setDragId(t.id)}
                  onDragEnd={() => {
                    setDragId(null);
                    setOver(null);
                  }}
                  className={`rounded-lg border border-zinc-200 bg-white p-2.5 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-900 ${
                    dragId === t.id ? 'opacity-40' : ''
                  }`}
                >
                  <Link href={`/p/${t.id}`} className="block hover:underline">
                    {t.icon ?? '☑'} {t.title}
                  </Link>
                  <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                    {t.assignee ? (
                      <Avatar name={t.assignee.name} src={t.assignee.avatar_url} size={16} />
                    ) : (
                      <span className="inline-block h-4 w-4 rounded-full border border-dashed border-zinc-300" />
                    )}
                    <span className="tabular-nums">{t.progress ?? 0}%</span>
                    <span className="ml-auto">
                      <DueCell due={t.due_date} today={today} />
                    </span>
                  </div>
                </li>
              ))}
              {col.length === 0 && <li className="py-4 text-center text-[11px] text-zinc-300 dark:text-zinc-600">비어 있음</li>}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
