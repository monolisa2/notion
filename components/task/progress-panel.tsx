'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  CHILD_TASK_SELECT,
  CHILD_UPDATE_SELECT,
  fetchUpdates,
  type ChildTaskLite,
  type ChildUpdateLite,
  type UpdateWithAuthor,
} from '@/lib/updates';
import { statusClass, statusKind } from '@/lib/status-style';
import { DEFAULT_STATUSES, type PageRow, type StatusRow } from '@/lib/types';
import { Avatar } from '@/components/avatar';
import { useProgressLog } from '@/components/progress-log-provider';

function dday(due: string | null): { label: string; tone: string } | null {
  if (!due) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${due}T00:00:00`);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff > 0) return { label: `D-${diff}`, tone: diff <= 3 ? 'text-orange-600' : 'text-zinc-500' };
  if (diff === 0) return { label: 'D-Day', tone: 'text-orange-600 font-semibold' };
  return { label: `${-diff}일 지남`, tone: 'text-red-600 font-semibold' };
}

function when(iso: string) {
  return iso.slice(5, 16).replace('T', ' ');
}

/**
 * 업무 페이지 상단의 진행률 패널.
 * - 하위 업무가 있으면(자동 평균): 어떤 업무들의 평균인지 구성 목록 + 하위 업무 최근 기록
 * - 하위가 없으면: 진행 추이 그래프 + 최근 기록 목록
 * 숫자가 "어디서 왔는지"가 항상 눈에 보이게 한다.
 */
export function ProgressPanel({
  page,
  initialUpdates,
  statuses = DEFAULT_STATUSES,
  autoFromChildren = false,
  initialChildren = [],
  initialChildUpdates = [],
}: {
  page: PageRow;
  initialUpdates: UpdateWithAuthor[];
  statuses?: StatusRow[];
  /** 하위 업무 평균으로 자동 계산 중 (0014) */
  autoFromChildren?: boolean;
  initialChildren?: ChildTaskLite[];
  initialChildUpdates?: ChildUpdateLite[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const { open: openLog } = useProgressLog();
  const [progress, setProgress] = useState(page.progress ?? 0);
  const [status, setStatus] = useState(page.status ?? '대기');
  const [dueDate, setDueDate] = useState(page.due_date);
  const [updates, setUpdates] = useState(initialUpdates);
  const [children, setChildren] = useState<ChildTaskLite[]>(initialChildren);
  const [childUpdates, setChildUpdates] = useState<ChildUpdateLite[]>(initialChildUpdates);

  useEffect(() => {
    const refetchChildren = async () => {
      const [{ data: kids }, { data: feed }] = await Promise.all([
        supabase
          .from('pages')
          .select(CHILD_TASK_SELECT)
          .eq('parent_id', page.id)
          .eq('type', 'task')
          .is('archived_at', null)
          .order('sort_order'),
        supabase
          .from('page_updates')
          .select(CHILD_UPDATE_SELECT)
          .eq('page.parent_id', page.id)
          .order('created_at', { ascending: false })
          .limit(6),
      ]);
      if (kids) setChildren(kids as unknown as ChildTaskLite[]);
      if (feed) setChildUpdates(feed as unknown as ChildUpdateLite[]);
    };
    const channel = supabase
      .channel(`progress-${page.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pages', filter: `id=eq.${page.id}` },
        (payload) => {
          const row = payload.new as PageRow;
          setProgress(row.progress ?? 0);
          setStatus(row.status ?? '대기');
          setDueDate(row.due_date);
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'page_updates', filter: `page_id=eq.${page.id}` },
        async () => {
          try {
            setUpdates(await fetchUpdates(supabase, page.id));
          } catch {
            /* 다음 이벤트에 재시도 */
          }
        },
      )
      // 하위 업무의 진행률·로그가 바뀌면 구성 목록과 기록을 다시 받는다
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pages', filter: `parent_id=eq.${page.id}` },
        () => void refetchChildren().catch(() => {}),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, page.id]);

  const due = dday(dueDate);
  const kind = statusKind(status, statuses);
  const done = kind === '완료' || progress >= 100;
  const barColor = done ? 'bg-emerald-500' : kind === '보류' ? 'bg-amber-400' : 'bg-blue-600';

  // 진행 추이: 로그의 진행률 스냅샷(시간순)
  const points = useMemo(
    () =>
      [...updates]
        .filter((u) => u.progress_snapshot !== null)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((u) => ({ t: new Date(u.created_at).getTime(), v: u.progress_snapshot as number, when: u.created_at })),
    [updates],
  );

  const recentOwn = updates.slice(0, 4);

  return (
    <section className="mx-auto w-full max-w-[900px] px-6 pt-3 sm:px-12">
      {/* 모바일: 본문이 길어도 한 손으로 기록할 수 있게 하단 고정 버튼 */}
      <button
        type="button"
        onClick={() => openLog(page.id)}
        className="fixed bottom-4 right-4 z-30 rounded-full bg-zinc-900 px-4 py-3 text-sm font-medium text-white shadow-lg md:hidden"
      >
        ✏️ 진행 기록
      </button>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 px-4 py-3">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums text-zinc-900">{progress}%</span>
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${statusClass(status, statuses)}`}>{status}</span>
          {autoFromChildren && (
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500" title="하위 업무 진행률의 평균입니다">
              하위 업무 {children.length}건 평균
            </span>
          )}
          {/* 기록 버튼은 항상 보인다. 하위 업무가 있으면 %는 잠기고 글만 남는다 */}
          <button
            type="button"
            onClick={() => openLog(page.id)}
            className="rounded-md border border-zinc-300 bg-white px-2 py-0.5 text-[11px] text-zinc-600 hover:bg-zinc-50"
            title={
              autoFromChildren
                ? '진행률은 하위 업무 평균이라 여기서 바꿀 수 없습니다. 상황만 기록합니다'
                : '진행률 변경은 항상 기록과 함께 남습니다'
            }
          >
            {autoFromChildren ? '✏️ 기록 남기기' : '✏️ 기록하고 변경'}
          </button>
          {due && (
            <span className={`ml-auto text-xs tabular-nums ${due.tone}`} title={`기한 ${dueDate}`}>
              기한 {dueDate} · {due.label}
            </span>
          )}
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-zinc-200/80" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className={`h-full rounded-full transition-[width] duration-300 ${barColor}`} style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>

        {autoFromChildren ? (
          <>
            {/*
              이 % 가 어떤 업무들의 평균인지 — 숫자로도, 선으로도 보이게.
              "상위 = 하위 평균" 이 말로만 있으면 안 와닿는다는 요청 (2026-09-20)
            */}
            <p className="mt-2 px-2 text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
              {/* 하위가 많으면 수식이 한 줄을 넘어가 오히려 안 읽힌다 */}
              {children.length <= 6
                ? `(${children.map((c) => c.progress ?? 0).join(' + ')}) ÷ ${children.length}건 = `
                : `하위 ${children.length}건의 평균 = `}
              <span className="font-semibold text-zinc-700 dark:text-zinc-200">{progress}%</span>
            </p>
            <ul className="relative mt-1 space-y-1">
              {/* 위 진행률 막대에서 마지막 하위까지 내려오는 세로선 */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-[13px] top-0 w-px bg-zinc-300 dark:bg-zinc-600"
                style={{ bottom: 16 }}
              />
              {children.map((c) => (
                <li key={c.id} className="relative">
                  {/* 세로선에서 각 하위로 뻗는 가로선 */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-[13px] top-1/2 h-px w-2 bg-zinc-300 dark:bg-zinc-600"
                  />
                  <Link
                    href={`/p/${c.id}`}
                    className="flex items-center gap-2 rounded-lg py-1.5 pl-6 pr-2 text-sm hover:bg-white"
                  >
                    <span className="w-5 shrink-0 text-center">{c.icon ?? '☑'}</span>
                    <span className="min-w-0 flex-1 truncate">{c.title}</span>
                    {c.assignee && (
                      <span className="flex shrink-0 items-center gap-1 text-xs text-zinc-500">
                        <Avatar name={c.assignee.name} src={c.assignee.avatar_url} size={16} />
                        {c.assignee.name}
                      </span>
                    )}
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${statusClass(c.status, statuses)}`}>{c.status}</span>
                    <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-zinc-200">
                      <span className="block h-full rounded-full bg-blue-500" style={{ width: `${c.progress ?? 0}%` }} />
                    </span>
                    <span className="w-9 shrink-0 text-right text-xs tabular-nums text-zinc-600">{c.progress ?? 0}%</span>
                  </Link>
                </li>
              ))}
            </ul>

            {/* 하위 업무에서 올라온 최근 기록 */}
            {childUpdates.length > 0 && (
              <div className="mt-3 border-t border-zinc-200/70 pt-2">
                <p className="px-2 text-[11px] font-medium text-zinc-400">최근 기록 (하위 업무)</p>
                <ul className="mt-1 space-y-0.5">
                  {childUpdates.map((u) => (
                    <li key={u.id} className="flex items-center gap-2 px-2 py-1 text-xs text-zinc-600">
                      <Avatar name={u.author?.name ?? '?'} src={u.author?.avatar_url} size={16} />
                      <span className="shrink-0 font-medium text-zinc-700">{u.author?.name ?? '알 수 없음'}</span>
                      {u.page && (
                        <Link href={`/p/${u.page.id}`} className="max-w-[10rem] shrink-0 truncate text-zinc-400 hover:underline">
                          {u.page.title}
                        </Link>
                      )}
                      <span className="min-w-0 flex-1 truncate">{u.content}</span>
                      {u.progress_snapshot !== null && (
                        <span className="shrink-0 rounded bg-zinc-100 px-1 py-0.5 tabular-nums">{u.progress_snapshot}%</span>
                      )}
                      <span className="shrink-0 tabular-nums text-zinc-400">{when(u.created_at)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <>
            {points.length >= 2 && <ProgressSpark points={points} />}

            {/* 이 숫자가 어디서 왔는지 — 최근 기록 목록 */}
            {recentOwn.length > 0 ? (
              <div className="mt-3 border-t border-zinc-200/70 pt-2">
                <p className="px-2 text-[11px] font-medium text-zinc-400">최근 기록</p>
                <ul className="mt-1 space-y-0.5">
                  {recentOwn.map((u) => (
                    <li key={u.id} className="flex items-center gap-2 px-2 py-1 text-xs text-zinc-600">
                      <Avatar name={u.author?.name ?? '?'} src={u.author?.avatar_url} size={16} />
                      <span className="shrink-0 font-medium text-zinc-700">{u.author?.name ?? '알 수 없음'}</span>
                      <span className="min-w-0 flex-1 truncate">{u.content}</span>
                      {u.progress_snapshot !== null && (
                        <span className="shrink-0 rounded bg-zinc-100 px-1 py-0.5 tabular-nums">{u.progress_snapshot}%</span>
                      )}
                      <span className="shrink-0 tabular-nums text-zinc-400">{when(u.created_at)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : progress > 0 ? (
              <p className="mt-2 text-[11px] text-zinc-400">
                이 진행률은 기록 없이 설정된 값입니다 (예전 방식). 다음 변경부터는 누가·언제·왜가 함께 남습니다.
              </p>
            ) : (
              <p className="mt-2 text-[11px] text-zinc-400">진행 로그를 남길 때마다 여기에 추이 그래프와 기록이 표시됩니다.</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

/** 진행률 추이 스텝 차트 (단일 계열 · 0~100 고정 축) */
function ProgressSpark({ points }: { points: { t: number; v: number; when: string }[] }) {
  const W = 560;
  const H = 56;
  const PAD = 4;
  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const span = Math.max(1, t1 - t0);
  const x = (t: number) => PAD + ((t - t0) / span) * (W - PAD * 2);
  const y = (v: number) => H - PAD - (Math.min(100, Math.max(0, v)) / 100) * (H - PAD * 2);

  // 스텝 라인: 값이 다음 로그까지 유지되는 형태
  let d = `M ${x(points[0].t)} ${y(points[0].v)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` H ${x(points[i].t)} V ${y(points[i].v)}`;
  }
  const area = `${d} V ${H - PAD} H ${x(points[0].t)} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-14 w-full" aria-label="진행률 추이" role="img">
      {[25, 50, 75].map((g) => (
        <line key={g} x1={PAD} x2={W - PAD} y1={y(g)} y2={y(g)} stroke="#e4e4e7" strokeWidth="1" strokeDasharray="2 4" />
      ))}
      <path d={area} fill="rgba(37, 99, 235, 0.08)" />
      <path d={d} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(p.t)} cy={y(p.v)} r="3" fill="#2563eb" stroke="#ffffff" strokeWidth="1.5" />
          <circle cx={x(p.t)} cy={y(p.v)} r="9" fill="transparent">
            <title>{`${p.when.slice(0, 10)} · ${p.v}%`}</title>
          </circle>
        </g>
      ))}
    </svg>
  );
}
