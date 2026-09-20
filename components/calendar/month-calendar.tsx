'use client';

import Link from 'next/link';
import { kstToday } from '@/lib/kst';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { buildOrgTree, type OrgNode } from '@/lib/org';
import { statusClass } from '@/lib/status-style';
import type { StatusRow } from '@/lib/types';
import type { OrgUnitRow } from '@/lib/types';

export type CalendarItem = {
  id: string;
  date: string;
  title: string;
  icon: string | null;
  kind: 'task' | 'meeting' | 'weekly' | 'notice' | 'doc' | 'blank';
  status: string | null;
  unitId: string | null;
  who: string | null;
};

const KIND_STYLE: Record<CalendarItem['kind'], string> = {
  task: 'border-l-2 border-blue-400 bg-blue-50/70',
  meeting: 'border-l-2 border-violet-400 bg-violet-50/70',
  notice: 'border-l-2 border-amber-400 bg-amber-50/70',
  weekly: 'border-l-2 border-emerald-400 bg-emerald-50/70',
  doc: 'border-l-2 border-zinc-300 bg-zinc-50',
  blank: 'border-l-2 border-zinc-300 bg-zinc-50',
};

function subtree(roots: OrgNode[], id: string) {
  const out = new Set<string>();
  const find = (l: OrgNode[]): OrgNode | null => {
    for (const n of l) {
      if (n.id === id) return n;
      const r = find(n.children);
      if (r) return r;
    }
    return null;
  };
  const walk = (n: OrgNode) => {
    out.add(n.id);
    n.children.forEach(walk);
  };
  const n = find(roots);
  if (n) walk(n);
  return out;
}

/** 월간 캘린더: 업무 기한(파랑) · 회의(보라) · 공지(노랑) · 주간 정리(초록) */
export function MonthCalendar({
  month,
  items,
  units,
  initialUnit,
  statuses,
}: {
  month: string;
  items: CalendarItem[];
  units: OrgUnitRow[];
  initialUnit: string;
  statuses?: StatusRow[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [unit, setUnit] = useState(initialUnit);
  const orgTree = useMemo(() => buildOrgTree(units), [units]);

  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const leading = (first.getDay() + 6) % 7; // 월요일 시작
  const cells: (string | null)[] = [
    ...Array<null>(leading).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`),
  ];
  while (cells.length % 7) cells.push(null);
  const today = kstToday();

  const allowed = unit ? subtree(orgTree, unit) : null;
  const byDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const it of items) {
      if (allowed && !(it.unitId && allowed.has(it.unitId))) continue;
      map.set(it.date, [...(map.get(it.date) ?? []), it]);
    }
    return map;
  }, [items, allowed]);

  const go = (delta: number, u = unit) => {
    const d = new Date(y, m - 1 + delta, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const q = new URLSearchParams({ ym });
    if (u) q.set('unit', u);
    router.push(`${pathname}?${q}`);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8 sm:px-8">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{y}년 {m}월</h1>
        <div className="ml-2 flex gap-1">
          <button type="button" onClick={() => go(-1)} className="rounded-md border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-50" aria-label="이전 달">‹</button>
          <button type="button" onClick={() => go(0, unit)} className="rounded-md border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-50">이번 달</button>
          <button type="button" onClick={() => go(1)} className="rounded-md border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-50" aria-label="다음 달">›</button>
        </div>
        <select
          value={unit}
          onChange={(e) => {
            setUnit(e.target.value);
            const q = new URLSearchParams({ ym: month });
            if (e.target.value) q.set('unit', e.target.value);
            router.replace(`${pathname}?${q}`);
          }}
          className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs outline-none"
          aria-label="조직"
        >
          <option value="">조직 전체</option>
          {(function flat(list: OrgNode[], depth: number): React.ReactNode[] {
            return list.flatMap((n) => [
              <option key={n.id} value={n.id}>{'　'.repeat(depth)}{n.name}</option>,
              ...flat(n.children, depth + 1),
            ]);
          })(orgTree, 0)}
        </select>
        <div className="ml-auto flex items-center gap-3 text-[11px] text-zinc-500">
          <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-blue-400" />업무 기한</span>
          <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-violet-400" />회의</span>
          <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-amber-400" />공지</span>
          <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-emerald-400" />주간 정리</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 overflow-hidden rounded-xl border border-zinc-200 text-sm">
        {['월', '화', '수', '목', '금', '토', '일'].map((d, i) => (
          <div key={d} className={`border-b border-zinc-200 bg-zinc-50 px-2 py-1.5 text-center text-[11px] font-medium ${i >= 5 ? 'text-zinc-400' : 'text-zinc-500'}`}>
            {d}
          </div>
        ))}
        {cells.map((date, i) => {
          const list = date ? byDate.get(date) ?? [] : [];
          const isToday = date === today;
          const weekend = i % 7 >= 5;
          return (
            <div
              key={i}
              className={`min-h-28 border-b border-r border-zinc-100 p-1.5 ${weekend ? 'bg-zinc-50/60' : ''} ${(i + 1) % 7 === 0 ? 'border-r-0' : ''}`}
            >
              {date && (
                <>
                  <div className={`mb-1 text-right text-[11px] ${isToday ? 'font-bold text-blue-600' : 'text-zinc-400'}`}>
                    {isToday ? <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-white">{Number(date.slice(8))}</span> : Number(date.slice(8))}
                  </div>
                  <ul className="space-y-1">
                    {list.slice(0, 4).map((it) => (
                      <li key={it.id}>
                        <Link
                          href={`/p/${it.id}`}
                          title={`${it.title}${it.who ? ` · ${it.who}` : ''}`}
                          className={`block truncate rounded-r px-1.5 py-0.5 text-[11px] leading-snug hover:opacity-80 ${KIND_STYLE[it.kind] ?? KIND_STYLE.doc}`}
                        >
                          {it.kind === 'task' && it.status && (
                            <span className={`mr-1 rounded px-1 text-[9px] ${statusClass(it.status, statuses)}`}>{it.status}</span>
                          )}
                          {it.title}
                        </Link>
                      </li>
                    ))}
                    {list.length > 4 && <li className="px-1 text-[10px] text-zinc-400">+{list.length - 4}</li>}
                  </ul>
                </>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-zinc-400">업무는 기한(due date), 회의록·공지·주간 정리는 페이지 상단의 날짜 기준입니다. 날짜가 없는 페이지는 표시되지 않습니다.</p>
    </div>
  );
}
