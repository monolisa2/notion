'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/errors';
import { createPage } from '@/lib/pages';
import { docToPlainText } from '@/lib/mentions';
import { buildOrgTree, unitLabel, type OrgNode } from '@/lib/org';
import { todayStr } from '@/lib/templates';
import type { OrgUnitRow } from '@/lib/types';
import { Avatar } from '@/components/avatar';
import { RenderDoc } from '@/components/render-doc';

export type CollectionItem = {
  id: string;
  title: string;
  icon: string | null;
  type: string;
  template: string | null;
  unit_id: string | null;
  visibility: string;
  event_date: string | null;
  updated_at: string;
  created_at: string;
  content: unknown;
  author: { id: string; name: string; avatar_url: string | null } | null;
};

const META: Record<string, { label: string; icon: string; dateLabel: string }> = {
  meeting: { label: '회의록', icon: '📝', dateLabel: '회의일' },
  weekly: { label: '주간 정리', icon: '🗓', dateLabel: '기준일' },
  notice: { label: '공지', icon: '📢', dateLabel: '게시일' },
};

type Period = 'week' | 'lastweek' | 'month' | 'all';
const PERIODS: { v: Period; label: string }[] = [
  { v: 'week', label: '이번 주' },
  { v: 'lastweek', label: '지난 주' },
  { v: 'month', label: '최근 30일' },
  { v: 'all', label: '전체' },
];

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // 월요일 시작
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
function fmt(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function periodRange(p: Period): [string, string] | null {
  const now = new Date();
  if (p === 'all') return null;
  if (p === 'month') {
    const from = new Date(now);
    from.setDate(from.getDate() - 30);
    return [fmt(from), fmt(now)];
  }
  const sow = startOfWeek(now);
  if (p === 'week') {
    const eow = new Date(sow);
    eow.setDate(eow.getDate() + 6);
    return [fmt(sow), fmt(eow)];
  }
  const lsow = new Date(sow);
  lsow.setDate(lsow.getDate() - 7);
  const leow = new Date(sow);
  leow.setDate(leow.getDate() - 1);
  return [fmt(lsow), fmt(leow)];
}

/** 조직 트리에서 특정 조직 + 그 하위 전체 id */
function subtreeIds(roots: OrgNode[], id: string): Set<string> {
  const out = new Set<string>();
  const find = (list: OrgNode[]): OrgNode | null => {
    for (const n of list) {
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
  const node = find(roots);
  if (node) walk(node);
  return out;
}

/**
 * 양식별 모아보기. 흩어진 회의록/주간 정리/공지를 조직·기간으로 걸러 한 화면에 이어 보고,
 * 필요하면 하나의 페이지로 합친다 (실장 보고용).
 */
export function CollectionView({
  template,
  items,
  units,
  me,
  initialUnit,
  initialPeriod,
}: {
  template: string;
  items: CollectionItem[];
  units: OrgUnitRow[];
  me: { id: string; name: string; unitId: string | null };
  initialUnit: string;
  initialPeriod: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const meta = META[template] ?? META.meeting;
  const orgTree = useMemo(() => buildOrgTree(units), [units]);

  const [unit, setUnit] = useState(initialUnit);
  const [period, setPeriod] = useState<Period>((PERIODS.some((p) => p.v === initialPeriod) ? initialPeriod : 'month') as Period);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const range = periodRange(period);
    const allowed = unit ? subtreeIds(orgTree, unit) : null;
    return items.filter((it) => {
      const d = it.event_date ?? it.created_at.slice(0, 10);
      if (range && (d < range[0] || d > range[1])) return false;
      if (allowed && !(it.unit_id && allowed.has(it.unit_id))) return false;
      return true;
    });
  }, [items, period, unit, orgTree]);

  // 조직별 묶기 (조직 정렬 순서대로)
  const grouped = useMemo(() => {
    const order = new Map(units.map((u, i) => [u.id, u.sort_order ?? i]));
    const m = new Map<string, CollectionItem[]>();
    for (const it of filtered) {
      const k = it.unit_id ?? '';
      m.set(k, [...(m.get(k) ?? []), it]);
    }
    return [...m.entries()].sort((a, b) => (order.get(a[0]) ?? 999) - (order.get(b[0]) ?? 999));
  }, [filtered, units]);

  const setQuery = (u: string, p: Period) => {
    const q = new URLSearchParams();
    if (u) q.set('unit', u);
    if (p !== 'month') q.set('period', p);
    router.replace(q.toString() ? `${pathname}?${q}` : pathname);
  };

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allOpen = filtered.length > 0 && filtered.every((it) => openIds.has(it.id));

  const rangeLabel = (() => {
    const r = periodRange(period);
    return r ? `${r[0]} ~ ${r[1]}` : '전체 기간';
  })();

  const copyText = async () => {
    const text = filtered
      .map((it) => `# ${it.title} (${it.author?.name ?? ''} · ${it.event_date ?? it.created_at.slice(0, 10)})\n${docToPlainText(it.content)}`)
      .join('\n\n');
    await navigator.clipboard.writeText(text);
    toast.success('텍스트로 복사했습니다');
  };

  /** 필터된 페이지들을 하나의 새 페이지로 합친다 (원본은 그대로) */
  const mergeIntoPage = async () => {
    if (filtered.length === 0) return;
    setBusy(true);
    try {
      const blocks: unknown[] = [];
      for (const it of filtered) {
        blocks.push({
          type: 'heading',
          props: { level: 2 },
          content: [{ type: 'text', text: `${it.title} — ${it.author?.name ?? ''} · ${it.event_date ?? it.created_at.slice(0, 10)}`, styles: {} }],
        });
        const body = Array.isArray(it.content) ? (it.content as Record<string, unknown>[]) : [];
        for (const blk of body) {
          // id 는 새로 발급되도록 제거
          const clone = JSON.parse(JSON.stringify(blk)) as Record<string, unknown>;
          delete clone.id;
          blocks.push(clone);
        }
        blocks.push({ type: 'divider' });
      }
      const targetUnit = unit || me.unitId || (units.find((u) => !u.parent_id)?.id ?? null);
      const id = await createPage(supabase, {
        parentId: null,
        createdBy: me.id,
        unitId: targetUnit,
        visibility: '소속',
        type: 'doc',
        title: `${meta.label} 모음 · ${unit ? unitLabel(units, unit) : '전체'} · ${rangeLabel}`,
        icon: meta.icon,
        content: blocks,
        template: 'blank',
        eventDate: todayStr(),
      });
      toast.success('하나의 페이지로 합쳤습니다');
      router.push(`/p/${id}`);
    } catch (e) {
      toast.error(`합치기 실패: ${errorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const tab = (key: string, label: string, icon: string) => (
    <Link
      key={key}
      href={`/collections/${key}`}
      className={`rounded-md px-3 py-1.5 text-sm ${template === key ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
    >
      {icon} {label}
    </Link>
  );

  const sel = 'rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs outline-none';

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8 sm:px-10">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-2xl font-semibold tracking-tight">모아보기</h1>
        <div className="flex gap-1 rounded-lg border border-zinc-200 p-0.5">
          {tab('meeting', '회의록', '📝')}
          {tab('weekly', '주간 정리', '🗓')}
          {/* 공지는 "고정" 이 기준이라 별도 화면(/notices)으로 뺐다 */}
        </div>
      </div>
      <p className="mt-2 text-sm text-zinc-500">
        {meta.label} 양식으로 만든 페이지를 조직·기간으로 모아 봅니다. 팀장은 팀을, 실장은 실 전체를 고르세요.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select
          value={unit}
          onChange={(e) => {
            setUnit(e.target.value);
            setQuery(e.target.value, period);
          }}
          className={sel}
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
        <div className="flex gap-0.5 rounded-md border border-zinc-200 p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.v}
              type="button"
              onClick={() => {
                setPeriod(p.v);
                setQuery(unit, p.v);
              }}
              className={`rounded px-2 py-0.5 text-xs ${period === p.v ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-zinc-400">{rangeLabel} · {filtered.length}건</span>

        <span className="ml-auto" />
        <button type="button" onClick={() => setOpenIds(allOpen ? new Set() : new Set(filtered.map((i) => i.id)))} className="rounded-md border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-50">
          {allOpen ? '모두 접기' : '모두 펼치기'}
        </button>
        <button type="button" disabled={filtered.length === 0} onClick={() => void copyText()} className="rounded-md border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-50 disabled:opacity-40">
          텍스트 복사
        </button>
        <button
          type="button"
          disabled={busy || filtered.length === 0}
          onClick={() => void mergeIntoPage()}
          className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
          title="필터된 페이지들을 이어 붙인 새 페이지를 만듭니다 (원본은 그대로)"
        >
          {busy ? '합치는 중…' : '한 페이지로 합치기'}
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-10 rounded-xl border border-dashed border-zinc-200 py-12 text-center text-sm text-zinc-400">
          이 조건에 맞는 {meta.label}가 없습니다. 사이드바에서 조직 옆 ＋ → {meta.label} 양식으로 만들면 여기에 모입니다.
        </p>
      ) : (
        <div className="mt-6 space-y-8">
          {grouped.map(([unitId, list]) => (
            <section key={unitId || 'none'}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                {unitLabel(units, unitId) || '공간 미지정'} · {list.length}
              </h2>
              <ul className="mt-2 divide-y divide-zinc-100 rounded-xl border border-zinc-200">
                {list.map((it) => {
                  const open = openIds.has(it.id);
                  return (
                    <li key={it.id}>
                      <div className="flex items-center gap-3 px-4 py-2.5">
                        <button type="button" onClick={() => toggle(it.id)} aria-label={open ? '접기' : '펼치기'} className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-zinc-100">
                          <svg width="10" height="10" viewBox="0 0 10 10" className={`transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden="true">
                            <path d="M3 1.5 7 5 3 8.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                          </svg>
                        </button>
                        <span className="w-6 text-center">{it.icon ?? meta.icon}</span>
                        <Link href={`/p/${it.id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">
                          {it.title}
                        </Link>
                        <span className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-500">
                          <Avatar name={it.author?.name ?? '?'} src={it.author?.avatar_url} size={16} />
                          {it.author?.name}
                        </span>
                        <span className="w-24 shrink-0 text-right text-xs tabular-nums text-zinc-400">
                          {it.event_date ?? it.created_at.slice(0, 10)}
                        </span>
                      </div>
                      {open && (
                        <div className="border-t border-zinc-100 bg-zinc-50/60 px-14 py-4">
                          <RenderDoc doc={it.content} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
