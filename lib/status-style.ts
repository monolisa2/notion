import type { PagePriority, PageStatus } from './types';

export const STATUS_COLOR: Record<PageStatus, string> = {
  대기: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200',
  진행: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200',
  검토: 'bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-200',
  완료: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200',
  보류: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200',
  드롭: 'bg-zinc-200 text-zinc-500 line-through dark:bg-zinc-800 dark:text-zinc-400',
};

export const PRIORITY_COLOR: Record<PagePriority, string> = {
  긴급: 'text-red-600 dark:text-red-400',
  높음: 'text-orange-600 dark:text-orange-400',
  보통: 'text-zinc-600 dark:text-zinc-300',
  낮음: 'text-zinc-400',
};

/** v_due_risk.risk_level → 색 (초과=빨강, 오늘=주황, 임박=노랑, 여유=회색) */
export const RISK_COLOR: Record<string, string> = {
  초과: 'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200',
  오늘: 'bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-200',
  임박: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/60 dark:text-yellow-200',
  여유: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
};

export function statusClass(status: string | null | undefined) {
  return STATUS_COLOR[(status ?? '대기') as PageStatus] ?? STATUS_COLOR.대기;
}
