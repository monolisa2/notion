import Link from 'next/link';
import { Avatar } from '@/components/avatar';
import { RISK_COLOR, statusClass } from '@/lib/status-style';
import type { StatusRow } from '@/lib/types';
import type { AssigneeSummaryRow, BlockedTaskRow, DueRiskRow, StaleTaskRow } from '@/lib/dashboard';
import { timeAgo } from '@/lib/notifications';
import { Empty } from './widget';

export function AssigneeSummary({ rows }: { rows: AssigneeSummaryRow[] }) {
  const active = rows.filter((r) => (r.open_count ?? 0) > 0 || (r.done_count ?? 0) > 0);
  if (active.length === 0) return <Empty>배정된 업무가 없습니다.</Empty>;
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-[11px] text-zinc-400">
        <tr>
          <th className="pb-1 font-normal">담당자</th>
          <th className="pb-1 text-right font-normal">진행 중</th>
          <th className="pb-1 pl-3 font-normal">평균 진행률</th>
          <th className="pb-1 text-right font-normal">기한 초과</th>
        </tr>
      </thead>
      <tbody>
        {active.map((r) => (
          <tr key={r.assignee_id} className="border-t border-zinc-100 dark:border-zinc-800">
            <td className="py-1.5">
              <Link
                href={`/tasks?assignee=${r.assignee_id}`}
                className="flex items-center gap-2 hover:underline"
              >
                <Avatar name={r.name ?? '?'} src={r.avatar_url} size={20} />
                <span className="truncate">{r.name}</span>
              </Link>
            </td>
            <td className="py-1.5 text-right tabular-nums">{r.open_count ?? 0}</td>
            <td className="py-1.5 pl-3">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-24 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
                  <div className="h-full bg-blue-500" style={{ width: `${r.avg_progress ?? 0}%` }} />
                </div>
                <span className="w-8 text-right text-xs tabular-nums text-zinc-500">
                  {r.avg_progress === null ? '–' : `${r.avg_progress}%`}
                </span>
              </div>
            </td>
            <td className={`py-1.5 text-right tabular-nums ${(r.overdue ?? 0) > 0 ? 'font-medium text-red-600 dark:text-red-400' : 'text-zinc-400'}`}>
              {r.overdue ?? 0}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DueRisk({ rows }: { rows: DueRiskRow[] }) {
  if (rows.length === 0) return <Empty>7일 내 기한인 업무가 없습니다.</Empty>;
  return (
    <ul className="space-y-1">
      {rows.map((r) => (
        <li key={r.id}>
          <Link
            href={`/p/${r.id}`}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            <span className={`w-10 shrink-0 rounded px-1.5 py-0.5 text-center text-[11px] font-medium ${RISK_COLOR[r.risk_level ?? '여유']}`}>
              {r.risk_level}
            </span>
            <span className="min-w-0 flex-1 truncate">{r.icon ?? '☑'} {r.title}</span>
            <span className="shrink-0 text-xs text-zinc-500">{r.assignee_name ?? '미지정'}</span>
            <span className="w-14 shrink-0 text-right text-xs tabular-nums text-zinc-400">
              {r.days_left === null ? '' : r.days_left < 0 ? `${-r.days_left}일 지남` : r.days_left === 0 ? '오늘' : `${r.days_left}일 남음`}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function StaleTasks({ rows, statuses }: { rows: StaleTaskRow[]; statuses?: StatusRow[] }) {
  if (rows.length === 0) return <Empty>3일 이상 멈춘 업무가 없습니다. 👍</Empty>;
  return (
    <ul className="space-y-1">
      {rows.map((r) => (
        <li key={r.id}>
          <Link
            href={`/p/${r.id}`}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            <span className="w-12 shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums text-red-800 dark:bg-red-900/60 dark:text-red-200">
              {r.stale_days}일
            </span>
            <span className="min-w-0 flex-1 truncate">{r.icon ?? '☑'} {r.title}</span>
            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] ${statusClass(r.status, statuses)}`}>{r.status}</span>
            <span className="flex shrink-0 items-center gap-1 text-xs text-zinc-500">
              {r.assignee_name ? (
                <>
                  <Avatar name={r.assignee_name} src={r.avatar_url} size={16} />
                  {r.assignee_name}
                </>
              ) : (
                '미지정'
              )}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function BlockedTasks({ rows }: { rows: BlockedTaskRow[] }) {
  if (rows.length === 0) return <Empty>막힌 업무가 없습니다.</Empty>;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.id} className="rounded-lg border border-red-100 bg-red-50/40 px-3 py-2 dark:border-red-900/50 dark:bg-red-950/20">
          <Link href={`/p/${r.id}`} className="flex items-center gap-2 text-sm hover:underline">
            <span className="min-w-0 flex-1 truncate font-medium">{r.icon ?? '☑'} {r.title}</span>
            <span className="shrink-0 text-xs text-zinc-500">{r.assignee_name ?? '미지정'}</span>
            <span className="shrink-0 text-[11px] text-zinc-400">{r.raised_at ? timeAgo(r.raised_at) : ''}</span>
          </Link>
          {/* blocker 원문을 그대로 노출 */}
          <p className="mt-1 whitespace-pre-wrap text-sm text-red-800 dark:text-red-200">⛔ {r.blocker}</p>
        </li>
      ))}
    </ul>
  );
}
