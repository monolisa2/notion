/**
 * 대시보드 데이터. 뷰 5종을 SELECT 만 한다 — 집계를 클라이언트에서 다시 계산하지 않는다.
 * 모든 뷰는 security_invoker = true 이므로 조회자의 RLS 가 적용된다.
 */
import type { Db } from './pages';
import type { Views } from './types';

export type ActivityRow = Views['v_activity_feed']['Row'];
export type AssigneeSummaryRow = Views['v_assignee_summary']['Row'];
export type DueRiskRow = Views['v_due_risk']['Row'];
export type StaleTaskRow = Views['v_stale_tasks']['Row'];
export type BlockedTaskRow = Views['v_blocked_tasks']['Row'];

export const FEED_DAYS = 7;

export async function fetchActivityFeed(sb: Db, limit = 50): Promise<ActivityRow[]> {
  const since = new Date(Date.now() - FEED_DAYS * 86400_000).toISOString();
  const { data, error } = await sb
    .from('v_activity_feed')
    .select('*')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function fetchDashboard(sb: Db) {
  const [feed, assignees, dueRisk, stale, blocked] = await Promise.all([
    fetchActivityFeed(sb),
    sb.from('v_assignee_summary').select('*').order('open_count', { ascending: false }),
    sb.from('v_due_risk').select('*').order('due_date'),
    sb.from('v_stale_tasks').select('*').order('stale_days', { ascending: false }),
    sb.from('v_blocked_tasks').select('*').order('raised_at', { ascending: false }),
  ]);
  for (const r of [assignees, dueRisk, stale, blocked]) {
    if (r.error) throw r.error;
  }
  return {
    feed,
    assignees: (assignees.data ?? []) as AssigneeSummaryRow[],
    dueRisk: (dueRisk.data ?? []) as DueRiskRow[],
    stale: (stale.data ?? []) as StaleTaskRow[],
    blocked: (blocked.data ?? []) as BlockedTaskRow[],
  };
}
