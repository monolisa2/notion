import { createClient } from '@/lib/supabase/server';
import { getMyProfile } from '@/lib/reference';
import { fetchDashboard, FEED_DAYS } from '@/lib/dashboard';
import { Widget } from '@/components/dashboard/widget';
import { ActivityFeed } from '@/components/dashboard/activity-feed';
import { AssigneeSummary, BlockedTasks, DueRisk, StaleTasks } from '@/components/dashboard/widgets';
import type { StatusRow } from '@/lib/types';

type SilentRow = { profile_id: string; name: string; open_tasks: number; last_log_at: string | null };

/**
 * 본부 현황 위젯 묶음 — 집계 쿼리가 무거워 홈에서 Suspense 로 분리했다.
 * 상단(공지·내 업무·최근 수정)이 먼저 뜨고, 이 블록은 준비되는 대로 채워진다.
 */
export async function DashboardSection({ statuses }: { statuses: StatusRow[] }) {
  const supabase = await createClient();
  const [dash, profile] = await Promise.all([fetchDashboard(supabase), getMyProfile()]);
  const isLead = !!profile?.is_admin || ['팀장', '실장', '본부장'].includes(profile?.job_title ?? '');
  const silent: SilentRow[] = isLead
    ? ((await supabase.rpc('silent_members', { p_days: 7 })).data as SilentRow[] | null) ?? []
    : [];
  const { feed, assignees, dueRisk, stale, blocked } = dash;

  return (
    <>
      {/* 팀장·실장·관리자: 이번 주 진행 기록이 없는 담당자 */}
      {isLead && (
        <section className="mb-4 rounded-xl border border-zinc-200 p-4">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-semibold text-zinc-700">이번 주 진행 기록 없음</h2>
            <span className="text-xs text-zinc-400">진행 중 업무가 있는데 최근 7일 기록이 0건인 담당자 · 관리자·팀장에게만 보입니다</span>
          </div>
          {silent.length === 0 ? (
            <p className="mt-2 text-sm text-emerald-700">전원 기록 있음 👍</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-2">
              {silent.map((s) => (
                <li key={s.profile_id} className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-zinc-500"> · 진행 {s.open_tasks}건 · 마지막 {s.last_log_at ? s.last_log_at.slice(0, 10) : '없음'}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="mt-3 grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <Widget title="정체 업무" hint="3일 이상 진행 기록 없음" count={stale.length} accent>
            <StaleTasks rows={stale} statuses={statuses} />
          </Widget>
          <Widget title="막힌 업무" hint="최신 기록에 막힘 표시" count={blocked.length} accent>
            <BlockedTasks rows={blocked} />
          </Widget>
          <Widget title="기한 리스크" hint="7일 이내" count={dueRisk.length}>
            <DueRisk rows={dueRisk} />
          </Widget>
          <Widget title="담당자별 현황">
            <AssigneeSummary rows={assignees} />
          </Widget>
        </div>
        <div className="lg:col-span-2">
          <Widget title="활동 피드" hint={`최근 ${FEED_DAYS}일 · 실시간`}>
            <ActivityFeed initial={feed} />
          </Widget>
        </div>
      </div>
    </>
  );
}

/** 위젯이 준비되기 전 자리 표시 */
export function DashboardSkeleton() {
  return (
    <div className="mt-3 grid gap-4 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="min-h-40 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-50/60" />
        ))}
      </div>
      <div className="lg:col-span-2">
        <div className="min-h-40 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-50/60" />
      </div>
    </div>
  );
}
