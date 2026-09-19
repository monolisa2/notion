'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { TaskRow } from '@/lib/tasks';
import { statusClass, statusKind } from '@/lib/status-style';
import type { OrgUnitRow, StatusRow } from '@/lib/types';
import { unitLabel } from '@/lib/org';

function toDate(s: string) {
  return new Date(`${s}T00:00:00`);
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function fmt(d: Date) {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * 업무 타임라인 — 기한이 있는 업무를 기간 축에 늘어놓는다 (읽기 전용).
 *   막대: 시작일~기한 (시작일이 없으면 기한 3일 전부터 짧게)
 *   창: 오늘 기준 지난 1주 ~ 앞 4주 (업무가 더 멀리 있으면 그만큼 확장)
 */
export function TaskTimeline({
  rows,
  today,
  units,
  statuses,
}: {
  rows: TaskRow[];
  today: string;
  units: OrgUnitRow[];
  statuses: StatusRow[];
}) {
  const dated = useMemo(
    () => rows.filter((t) => t.due_date).sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1)),
    [rows],
  );
  const undatedCount = rows.length - dated.length;
  const todayD = toDate(today);

  const { start, end, ticks } = useMemo(() => {
    let s = addDays(todayD, -7);
    let e = addDays(todayD, 28);
    for (const t of dated) {
      const due = toDate(t.due_date!);
      const st = t.start_date ? toDate(t.start_date) : due;
      if (st < s) s = addDays(st, -2);
      if (due > e) e = addDays(due, 3);
    }
    // 주 단위 눈금
    const tk: Date[] = [];
    for (let d = new Date(s); d <= e; d = addDays(d, 7)) tk.push(new Date(d));
    return { start: s, end: e, ticks: tk };
  }, [dated, todayD]);

  const span = Math.max(1, end.getTime() - start.getTime());
  const pos = (d: Date) => Math.min(100, Math.max(0, ((d.getTime() - start.getTime()) / span) * 100));

  const barColor = (t: TaskRow) => {
    const k = statusKind(t.status, statuses);
    if (k === '완료') return 'bg-emerald-400';
    if (k === '보류' || k === '드롭') return 'bg-zinc-300';
    if (t.due_date && t.due_date < today) return 'bg-red-400';
    return 'bg-blue-500';
  };

  if (dated.length === 0) {
    return <p className="py-16 text-center text-sm text-zinc-400">기한이 있는 업무가 없습니다. 기한을 넣으면 타임라인에 나타나요.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 [scrollbar-width:thin]">
      <div className="min-w-[760px]">
        {/* 축 (주 단위) */}
        <div className="relative flex h-8 border-b border-zinc-100 bg-zinc-50/60 text-[10px] text-zinc-400">
          <div className="w-56 shrink-0 border-r border-zinc-100 px-3 py-2 font-medium text-zinc-500">업무 ({dated.length})</div>
          <div className="relative flex-1">
            {ticks.map((d) => (
              <span key={d.getTime()} className="absolute top-0 flex h-full items-center border-l border-zinc-100 pl-1" style={{ left: `${pos(d)}%` }}>
                {fmt(d)}
              </span>
            ))}
            <span className="absolute inset-y-0 z-10 w-px bg-orange-400" style={{ left: `${pos(todayD)}%` }} title={`오늘 ${today}`} />
            <span className="absolute top-0 z-10 -translate-x-1/2 rounded-b bg-orange-400 px-1 text-[9px] font-medium text-white" style={{ left: `${pos(todayD)}%` }}>
              오늘
            </span>
          </div>
        </div>

        <ul>
          {dated.map((t) => {
            const due = toDate(t.due_date!);
            const st = t.start_date ? toDate(t.start_date) : addDays(due, -3);
            const left = pos(st < due ? st : due);
            const width = Math.max(1.2, pos(due) - left);
            return (
              <li key={t.id} className="flex border-b border-zinc-50 hover:bg-zinc-50/60">
                <div className="flex w-56 shrink-0 items-center gap-1.5 border-r border-zinc-100 px-3 py-2 text-sm">
                  <Link href={`/p/${t.id}`} className="min-w-0 flex-1 truncate hover:underline">
                    {t.icon ?? '☑'} {t.title}
                  </Link>
                  <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] ${statusClass(t.status, statuses)}`}>{t.status}</span>
                </div>
                <div className="relative min-h-9 flex-1">
                  <span className="absolute inset-y-0 z-0 w-px bg-orange-200" style={{ left: `${pos(todayD)}%` }} aria-hidden="true" />
                  <Link
                    href={`/p/${t.id}`}
                    className={`absolute top-1/2 h-3.5 -translate-y-1/2 rounded-full ${barColor(t)} hover:ring-2 hover:ring-blue-200`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${t.title} · ${t.start_date ? `${t.start_date} ~ ` : '기한 '}${t.due_date} · ${t.progress ?? 0}%${
                      t.assignee ? ` · ${t.assignee.name}` : ''
                    }${t.unit_id ? ` · ${unitLabel(units, t.unit_id)}` : ''}`}
                  >
                    <span className="sr-only">{t.title}</span>
                  </Link>
                  <span
                    className="pointer-events-none absolute top-1/2 -translate-y-1/2 whitespace-nowrap pl-1 text-[10px] text-zinc-400"
                    style={{ left: `${Math.min(86, left + width)}%` }}
                  >
                    {t.assignee?.name ?? ''} {t.progress ?? 0}%
                  </span>
                </div>
              </li>
            );
          })}
        </ul>

        {undatedCount > 0 && (
          <p className="px-3 py-2 text-[11px] text-zinc-400">기한이 없는 업무 {undatedCount}건은 표시되지 않았습니다 (테이블 뷰에서 확인).</p>
        )}
      </div>
    </div>
  );
}
