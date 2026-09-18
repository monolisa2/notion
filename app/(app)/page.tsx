import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { fetchDashboard, FEED_DAYS } from '@/lib/dashboard';
import { Widget } from '@/components/dashboard/widget';
import { ActivityFeed } from '@/components/dashboard/activity-feed';
import { AssigneeSummary, BlockedTasks, DueRisk, StaleTasks } from '@/components/dashboard/widgets';
import { statusClass } from '@/lib/status-style';

export const dynamic = 'force-dynamic';

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return '좋은 아침입니다';
  if (h < 17) return '좋은 오후입니다';
  return '수고 많으셨습니다';
}

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, dash, { data: myTasks }, { data: recent }, { data: pinned }] = await Promise.all([
    supabase.from('profiles').select('name, is_admin, job_title').eq('id', user!.id).maybeSingle(),
    fetchDashboard(supabase),
    supabase
      .from('pages')
      .select('id, title, icon, status, progress, due_date')
      .eq('type', 'task')
      .eq('assignee_id', user!.id)
      .in('status', ['대기', '진행', '검토'])
      .is('archived_at', null)
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(8),
    supabase
      .from('pages')
      .select('id, title, icon, type, updated_at')
      .is('archived_at', null)
      .order('updated_at', { ascending: false })
      .limit(8),
    supabase
      .from('pages')
      .select('id, title, icon, event_date, updated_at, unit_id, author:profiles!pages_created_by_fkey(name)')
      .eq('pinned', true)
      .is('archived_at', null)
      .order('updated_at', { ascending: false })
      .limit(5),
  ]);
  const isLead = !!profile?.is_admin || ['팀장', '실장', '본부장'].includes(profile?.job_title ?? '');
  const silent = isLead ? (await supabase.rpc('silent_members', { p_days: 7 })).data ?? [] : [];
  const { feed, assignees, dueRisk, stale, blocked } = dash;
  const today = new Date().toISOString().slice(0, 10);
  const empty = (recent ?? []).length === 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10 sm:px-10">
      <h1 className="text-2xl font-semibold tracking-tight">
        {greeting()}, {profile?.name ?? '반갑습니다'}님
      </h1>
      <p className="mt-1 text-sm text-zinc-500">{today} · 경영관리본부 TeamHub</p>

      {/* 고정 공지 */}
      {(pinned ?? []).length > 0 && (
        <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-800">📌 공지</h2>
          <ul className="mt-2 space-y-1">
            {(pinned ?? []).map((n) => (
              <li key={n.id}>
                <Link href={`/p/${n.id}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-amber-100/60">
                  <span className="w-5 text-center">{n.icon ?? '📢'}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{n.title}</span>
                  <span className="text-xs text-amber-800/70">
                    {(n.author as unknown as { name: string } | null)?.name} · {n.event_date ?? n.updated_at.slice(0, 10)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 시작하기 (첫 사용 안내) */}
      {empty && (
        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            ['1', '페이지 만들기', '왼쪽 사이드바에서 팀 이름에 마우스를 올리면 ＋ 가 나옵니다. 회의록·업무·공지 양식을 고르세요.'],
            ['2', '쓰고 공유하기', '본문은 자동 저장됩니다. / 로 블록 메뉴, @ 로 동료 언급, 하단에서 댓글.'],
            ['3', '업무로 관리하기', '페이지를 업무로 전환하면 상태·담당자·기한이 붙고, 업무 목록과 이 홈에 모입니다.'],
          ].map(([n, t, d]) => (
            <div key={n} className="rounded-xl border border-zinc-200 p-4">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">{n}</div>
              <h2 className="mt-3 text-sm font-semibold">{t}</h2>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">{d}</p>
            </div>
          ))}
        </section>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* 내 업무 */}
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-zinc-700">내 업무</h2>
            <Link href={`/tasks?assignee=${user!.id}`} className="text-xs text-zinc-400 hover:underline">전체 보기</Link>
          </div>
          <ul className="mt-2 divide-y divide-zinc-100 rounded-xl border border-zinc-200">
            {(myTasks ?? []).length === 0 && (
              <li className="px-4 py-6 text-center text-xs text-zinc-400">배정된 진행 중 업무가 없습니다</li>
            )}
            {(myTasks ?? []).map((t) => (
              <li key={t.id}>
                <Link href={`/p/${t.id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-zinc-50">
                  <span className="w-5 text-center">{t.icon ?? '☑'}</span>
                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[11px] ${statusClass(t.status)}`}>{t.status}</span>
                  <span className="w-9 text-right text-xs tabular-nums text-zinc-500">{t.progress ?? 0}%</span>
                  <span className={`w-20 text-right text-xs tabular-nums ${t.due_date && t.due_date < today ? 'text-red-600' : 'text-zinc-400'}`}>
                    {t.due_date ?? ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* 최근 수정 */}
        <section>
          <h2 className="text-sm font-semibold text-zinc-700">최근 수정된 페이지</h2>
          <ul className="mt-2 divide-y divide-zinc-100 rounded-xl border border-zinc-200">
            {empty && <li className="px-4 py-6 text-center text-xs text-zinc-400">아직 페이지가 없습니다</li>}
            {(recent ?? []).map((p) => (
              <li key={p.id}>
                <Link href={`/p/${p.id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-zinc-50">
                  <span className="w-5 text-center">{p.icon ?? (p.type === 'task' ? '☑' : '📄')}</span>
                  <span className="min-w-0 flex-1 truncate">{p.title}</span>
                  <span className="text-xs text-zinc-400">{p.updated_at.slice(0, 10)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* 팀장·실장·관리자: 이번 주 진행 기록이 없는 담당자 */}
      {isLead && (
        <section className="mt-8 rounded-xl border border-zinc-200 p-4">
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

      {/* 본부 현황 — 위젯 5개 고정 */}
      <div className="mt-10 flex items-baseline gap-3">
        <h2 className="text-sm font-semibold text-zinc-700">본부 현황</h2>
        <Link href="/tasks" className="ml-auto text-xs text-zinc-400 hover:underline">업무 목록 →</Link>
      </div>
      <div className="mt-3 grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <Widget title="정체 업무" hint="3일 이상 진행 기록 없음" count={stale.length} accent>
            <StaleTasks rows={stale} />
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
    </div>
  );
}
