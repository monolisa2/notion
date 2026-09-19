'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchUpdates, type UpdateWithAuthor } from '@/lib/updates';
import { statusClass, statusKind } from '@/lib/status-style';
import { DEFAULT_STATUSES, type PageRow, type StatusRow } from '@/lib/types';

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

/**
 * 업무 페이지 상단의 진행률 패널: 큰 진행 바 + 기한 D-day + 진행 추이(로그 스냅샷) 차트.
 * 값 편집은 속성 바(슬라이더)와 진행 로그가 담당하고, 여기는 "보여주는" 곳.
 */
export function ProgressPanel({
  page,
  initialUpdates,
  statuses = DEFAULT_STATUSES,
  autoFromChildren = false,
}: {
  page: PageRow;
  initialUpdates: UpdateWithAuthor[];
  statuses?: StatusRow[];
  /** 하위 업무 평균으로 자동 계산 중 (0014) */
  autoFromChildren?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [progress, setProgress] = useState(page.progress ?? 0);
  const [status, setStatus] = useState(page.status ?? '대기');
  const [dueDate, setDueDate] = useState(page.due_date);
  const [updates, setUpdates] = useState(initialUpdates);

  useEffect(() => {
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
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, page.id]);

  const due = dday(dueDate);
  const kind = statusKind(status, statuses);
  const done = kind === '완료' || progress >= 100;
  const barColor = done ? 'bg-emerald-500' : kind === '보류' ? 'bg-amber-400' : 'bg-blue-600';

  // 진행 추이: 로그의 진행률 스냅샷(시간순) + 현재값
  const points = useMemo(() => {
    const logs = [...updates]
      .filter((u) => u.progress_snapshot !== null)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((u) => ({ t: new Date(u.created_at).getTime(), v: u.progress_snapshot as number, when: u.created_at }));
    return logs;
  }, [updates]);

  return (
    <section className="mx-auto w-full max-w-[900px] px-6 pt-3 sm:px-12">
      <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 px-4 py-3">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums text-zinc-900">{progress}%</span>
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${statusClass(status, statuses)}`}>{status}</span>
          {autoFromChildren && (
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500" title="하위 업무 진행률의 평균입니다">
              하위 업무 평균 (자동)
            </span>
          )}
          {due && (
            <span className={`ml-auto text-xs tabular-nums ${due.tone}`} title={`기한 ${dueDate}`}>
              기한 {dueDate} · {due.label}
            </span>
          )}
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-zinc-200/80" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className={`h-full rounded-full transition-[width] duration-300 ${barColor}`} style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>
        {points.length >= 2 && <ProgressSpark points={points} />}
        {points.length < 2 && (
          <p className="mt-2 text-[11px] text-zinc-400">진행 로그를 남길 때마다 여기에 진행 추이 그래프가 그려집니다.</p>
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
      {/* 눈금 (25/50/75%) */}
      {[25, 50, 75].map((g) => (
        <line key={g} x1={PAD} x2={W - PAD} y1={y(g)} y2={y(g)} stroke="#e4e4e7" strokeWidth="1" strokeDasharray="2 4" />
      ))}
      <path d={area} fill="rgba(37, 99, 235, 0.08)" />
      <path d={d} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(p.t)} cy={y(p.v)} r="3" fill="#2563eb" stroke="#ffffff" strokeWidth="1.5" />
          {/* 넉넉한 히트 영역 + 브라우저 툴팁 */}
          <circle cx={x(p.t)} cy={y(p.v)} r="9" fill="transparent">
            <title>{`${p.when.slice(0, 10)} · ${p.v}%`}</title>
          </circle>
        </g>
      ))}
    </svg>
  );
}
