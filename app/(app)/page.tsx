import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { fetchDashboard, FEED_DAYS } from '@/lib/dashboard';
import { Widget } from '@/components/dashboard/widget';
import { ActivityFeed } from '@/components/dashboard/activity-feed';
import { AssigneeSummary, BlockedTasks, DueRisk, StaleTasks } from '@/components/dashboard/widgets';

export const dynamic = 'force-dynamic';

/**
 * 대시보드 — 위젯은 정확히 5개. 더 만들지 말 것 (CLAUDE.md 6절).
 * 정체 업무가 관리자가 제일 먼저 보는 카드라 맨 위에 둔다.
 */
export default async function Dashboard() {
  const supabase = await createClient();
  const { feed, assignees, dueRisk, stale, blocked } = await fetchDashboard(supabase);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8 sm:px-8">
      <div className="flex items-baseline gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">대시보드</h1>
        <span className="text-sm text-zinc-400">{today}</span>
        <Link href="/tasks" className="ml-auto text-sm text-blue-600 hover:underline dark:text-blue-400">
          업무 목록 →
        </Link>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <Widget title="정체 업무" hint="3일 이상 진행 로그 없음" count={stale.length} accent>
            <StaleTasks rows={stale} />
          </Widget>
          <Widget title="막힌 업무" hint="최신 로그에 blocker" count={blocked.length} accent>
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
    </div>
  );
}
