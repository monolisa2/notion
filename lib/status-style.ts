import type { PagePriority, StatusRow } from './types';

/**
 * 상태 색: page_statuses.color 키 → Tailwind 클래스 (0012).
 * Tailwind 는 정적 문자열만 인식하므로 여기에 전부 나열한다.
 */
export const STATUS_COLOR_KEYS = [
  'zinc',
  'blue',
  'violet',
  'emerald',
  'amber',
  'red',
  'orange',
  'cyan',
  'pink',
  'lime',
] as const;
export type StatusColorKey = (typeof STATUS_COLOR_KEYS)[number];

export const STATUS_COLOR_CLASSES: Record<StatusColorKey, string> = {
  zinc: 'bg-zinc-100 text-zinc-700',
  blue: 'bg-blue-100 text-blue-800',
  violet: 'bg-violet-100 text-violet-800',
  emerald: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
  orange: 'bg-orange-100 text-orange-800',
  cyan: 'bg-cyan-100 text-cyan-800',
  pink: 'bg-pink-100 text-pink-800',
  lime: 'bg-lime-100 text-lime-800',
};

/** 색 키를 클래스로 (모르는 키는 zinc) */
export function colorClass(color: string | null | undefined) {
  return STATUS_COLOR_CLASSES[(color ?? 'zinc') as StatusColorKey] ?? STATUS_COLOR_CLASSES.zinc;
}

/** 기본 6종 상태의 색 (목록을 아직 못 받은 화면의 폴백) */
const LEGACY_COLOR: Record<string, string> = {
  대기: STATUS_COLOR_CLASSES.zinc,
  진행: STATUS_COLOR_CLASSES.blue,
  검토: STATUS_COLOR_CLASSES.violet,
  완료: STATUS_COLOR_CLASSES.emerald,
  보류: STATUS_COLOR_CLASSES.amber,
  드롭: 'bg-zinc-200 text-zinc-500 line-through',
};

/** 상태 이름 → 칩 클래스. statuses(0012 목록)를 주면 커스텀 색을 따른다 */
export function statusClass(status: string | null | undefined, statuses?: StatusRow[]) {
  const found = statuses?.find((s) => s.name === status);
  if (found) return colorClass(found.color);
  return LEGACY_COLOR[status ?? ''] ?? STATUS_COLOR_CLASSES.zinc;
}

/** 상태 이름 → 의미(kind). 모르면 null */
export function statusKind(status: string | null | undefined, statuses?: StatusRow[]) {
  return statuses?.find((s) => s.name === status)?.kind ?? null;
}

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
