'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/errors';
import { DEFAULT_STATUSES, type OrgUnitRow, type StatusRow } from '@/lib/types';
import { unitLabel } from '@/lib/org';
import { PRIORITY_COLOR, RISK_COLOR, statusClass, statusKind } from '@/lib/status-style';
import { insertAutoLog } from '@/lib/updates';
import { StatusManager } from '@/components/tasks/status-manager';
import type { TaskRow } from '@/lib/tasks';
import { Avatar } from '@/components/avatar';
import { BoardDragGhost, useBoardDrag } from '@/components/board-dnd';
import type { Person } from '@/hooks/use-people';

type View = 'table' | 'kanban';
type GroupBy = 'status' | 'assignee' | 'unit';
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
export function TaskList({
  tasks,
  people,
  units,
  statuses = DEFAULT_STATUSES,
  meId,
  canManageStatuses = false,
}: {
  tasks: TaskRow[];
  people: Person[];
  units: OrgUnitRow[];
  statuses?: StatusRow[];
  meId?: string;
  canManageStatuses?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const view = (params.get('view') as View) || 'table';
  const groupBy = (params.get('group') as GroupBy) || 'status';
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
      if (!showClosed && !status && ['완료', '드롭'].includes(statusKind(t.status, statuses) ?? '')) return false;
      if (assignee === 'none' ? t.assignee_id !== null : assignee && t.assignee_id !== assignee) return false;
      if (status && t.status !== status) return false;
      if (due === 'none' && t.due_date) return false;
      if (due === 'overdue' && !(t.due_date && t.due_date < today)) return false;
      if (due === 'today' && t.due_date !== today) return false;
      if (due === 'week' && !(t.due_date && t.due_date >= today && t.due_date <= addDays(today, 7))) return false;
      return true;
    });
  }, [tasks, assignee, status, due, showClosed, today, statuses]);

  const changeStatus = async (id: string, next: string) => {
    const before = tasks.find((t) => t.id === id);
    const { error } = await supabase.from('pages').update({ status: next }).eq('id', id);
    if (error) {
      toast.error(`상태 변경 실패: ${errorMessage(error)}`);
      return;
    }
    if (meId && before && before.status !== next) {
      // 누가 바꿨는지 진행 로그에 자동 기록
      try {
        await insertAutoLog(supabase, {
          pageId: id,
          authorId: meId,
          content: `상태 변경: ${before.status ?? '없음'} → ${next}`,
          progress: before.progress,
          status: next,
        });
      } catch {
        /* 자동 기록 실패는 무시 */
      }
    }
    router.refresh();
  };
  const changeAssignee = async (id: string, next: string | null) => {
    const { error } = await supabase.from('pages').update({ assignee_id: next }).eq('id', id);
    if (error) toast.error(`담당자 변경 실패: ${errorMessage(error)}`);
    else router.refresh();
  };

  const select =
    'rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs outline-none dark:border-zinc-700 dark:bg-zinc-900';

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8 sm:px-8">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-2xl font-semibold tracking-tight">업무 목록</h1>
        <span className="text-sm text-zinc-400">{filtered.length}건</span>

        {view === 'kanban' && (
          <select value={groupBy} onChange={(e) => setParam({ group: e.target.value === 'status' ? null : e.target.value })} className={`${'rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs outline-none'} ml-auto`} aria-label="칸반 기준">
            <option value="status">상태별</option>
            <option value="assignee">담당자별</option>
            <option value="unit">팀별</option>
          </select>
        )}
        <div className={`${view === 'kanban' ? '' : 'ml-auto'} flex items-center gap-1 rounded-md border border-zinc-200 p-0.5`}>
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
          {statuses.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
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
        {canManageStatuses && <StatusManager statuses={statuses} />}
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
          <TaskTable rows={filtered} today={today} statuses={statuses} onStatus={changeStatus} />
        ) : (
          <Kanban rows={filtered} today={today} groupBy={groupBy} people={people} units={units} statuses={statuses} onStatus={changeStatus} onAssignee={changeAssignee} />
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
  statuses,
  onStatus,
}: {
  rows: TaskRow[];
  today: string;
  statuses: StatusRow[];
  onStatus: (id: string, s: string) => void;
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
                  value={t.status ?? ''}
                  onChange={(e) => onStatus(t.id, e.target.value)}
                  className={`rounded px-1.5 py-0.5 text-[11px] font-medium outline-none ${statusClass(t.status, statuses)}`}
                  aria-label="상태"
                >
                  {statuses.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                  {!statuses.some((s) => s.name === t.status) && t.status && <option value={t.status}>{t.status}</option>}
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
  groupBy,
  people,
  units,
  statuses,
  onStatus,
  onAssignee,
}: {
  rows: TaskRow[];
  today: string;
  groupBy: GroupBy;
  people: Person[];
  units: OrgUnitRow[];
  statuses: StatusRow[];
  onStatus: (id: string, s: string) => void;
  onAssignee: (id: string, a: string | null) => void;
}) {
  const { drag, over, registerColumn, startDrag, suppressClickCapture } = useBoardDrag((id, key) => {
    const task = rows.find((t) => t.id === id);
    if (groupBy === 'status') {
      if (task?.status !== key) onStatus(id, key);
    } else if (groupBy === 'assignee') {
      if ((task?.assignee_id ?? '') !== key) onAssignee(id, key || null);
    }
  });
  const draggable = groupBy !== 'unit';

  const columns: { key: string; head: React.ReactNode; match: (t: TaskRow) => boolean }[] =
    groupBy === 'status'
      ? statuses.map((s) => ({
          key: s.name,
          head: <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${statusClass(s.name, statuses)}`}>{s.name}</span>,
          match: (t: TaskRow) => t.status === s.name,
        }))
      : groupBy === 'assignee'
        ? [
            { key: '', head: <span className="text-[11px] font-medium text-zinc-500">미지정</span>, match: (t: TaskRow) => !t.assignee_id },
            ...people.map((p) => ({
              key: p.id,
              head: (
                <span className="flex items-center gap-1.5 text-[11px] font-medium">
                  <Avatar name={p.name} src={p.avatar_url} size={16} />
                  {p.name}
                </span>
              ),
              match: (t: TaskRow) => t.assignee_id === p.id,
            })),
          ]
        : units
            .filter((u) => u.id)
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .map((u) => ({
              key: u.id!,
              head: <span className="text-[11px] font-medium">{u.name}</span>,
              match: (t: TaskRow) => t.unit_id === u.id,
            }));

  const visibleCols = groupBy === 'assignee'
    ? [...columns.filter((c) => rows.some(c.match) || c.key === ''), ...columns.filter((c) => !rows.some(c.match) && c.key !== '')]
    : columns;

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {visibleCols.map((c) => {
        const col = rows.filter(c.match);
        const empty = col.length === 0;
        return (
          <div
            key={c.key || 'none'}
            ref={draggable ? registerColumn(c.key) : undefined}
            className={`flex shrink-0 flex-col rounded-xl border p-2 transition-colors ${empty && groupBy === 'assignee' ? 'w-40 opacity-70' : 'w-64'} ${
              over === c.key ? 'border-blue-400 bg-blue-50/60' : 'border-zinc-200 bg-zinc-50/60'
            }`}
          >
            <div className="flex items-center gap-2 px-1 py-1">
              {c.head}
              <span className="text-xs text-zinc-400">{col.length}</span>
            </div>
            <ul className="mt-1 flex-1 space-y-2">
              {col.map((t) => (
                <li
                  key={t.id}
                  onPointerDown={draggable ? startDrag(t.id, t.title) : undefined}
                  className={`select-none rounded-lg border border-zinc-200 bg-white p-2.5 text-sm shadow-sm ${
                    draggable ? 'cursor-grab' : ''
                  } ${drag?.id === t.id ? 'opacity-30' : ''}`}
                >
                  <Link href={`/p/${t.id}`} draggable={false} onClickCapture={suppressClickCapture} className="block hover:underline">
                    {t.icon ?? '☑'} {t.title}
                  </Link>
                  <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                    {groupBy !== 'status' && t.status && (
                      <span className={`rounded px-1 py-0.5 text-[10px] ${statusClass(t.status, statuses)}`}>{t.status}</span>
                    )}
                    {groupBy !== 'assignee' &&
                      (t.assignee ? (
                        <Avatar name={t.assignee.name} src={t.assignee.avatar_url} size={16} />
                      ) : (
                        <span className="inline-block h-4 w-4 rounded-full border border-dashed border-zinc-300" />
                      ))}
                    {groupBy !== 'unit' && t.unit_id && <span className="truncate text-[10px] text-zinc-400">{unitLabel(units, t.unit_id)}</span>}
                    <span className="tabular-nums">{t.progress ?? 0}%</span>
                    <span className="ml-auto">
                      <DueCell due={t.due_date} today={today} />
                    </span>
                  </div>
                </li>
              ))}
              {empty && <li className="py-4 text-center text-[11px] text-zinc-300">비어 있음</li>}
            </ul>
          </div>
        );
      })}
      {groupBy === 'unit' && <p className="self-start pt-2 text-[11px] text-zinc-400">팀은 페이지가 속한 공간이라 드래그로 바꿀 수 없습니다.</p>}
      {drag && <BoardDragGhost drag={drag} />}
    </div>
  );
}
