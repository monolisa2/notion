import Link from 'next/link';
import { Suspense } from 'react';
import { DashboardSection, DashboardSkeleton } from '@/components/dashboard/dashboard-section';
import { createClient, getSessionUser } from '@/lib/supabase/server';
import { getMyProfile, getStatuses } from '@/lib/reference';
import { statusClass } from '@/lib/status-style';

export const dynamic = 'force-dynamic';

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return '좋은 아침입니다';
  if (h < 17) return '좋은 오후입니다';
  return '수고 많으셨습니다';
}

type MyTask = {
  id: string;
  title: string;
  icon: string | null;
  status: string | null;
  progress: number | null;
  due_date: string | null;
  assignee_id: string | null;
};

export default async function Home() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);

  // 상태 목록(0012) — "진행 중" 판정은 이름이 아니라 kind 로
  const statuses = await getStatuses();
  const openNames = statuses.filter((s) => s.kind === '대기' || s.kind === '진행').map((s) => s.name);

  const TASK_COLS = 'id, title, icon, status, progress, due_date, assignee_id';
  const [profile, { data: assignedRows }, participating, { data: recent }, { data: pinned }, visitCount] =
    await Promise.all([
      getMyProfile(),
      supabase
        .from('pages')
        .select(TASK_COLS)
        .eq('type', 'task')
        .eq('assignee_id', user!.id)
        .in('status', openNames)
        .is('archived_at', null)
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(10),
      // 내가 "참여자"로 들어가 있는 업무 (0013) — 담당자가 아니어도 내 일이다
      supabase
        .from('page_people')
        .select(`page:pages!page_people_page_id_fkey(${TASK_COLS}, type, archived_at)`)
        .eq('user_id', user!.id)
        .limit(200)
        .then((r) => {
          const rows = (r.data ?? []) as unknown as { page: (MyTask & { type: string; archived_at: string | null }) | null }[];
          return rows
            .map((x) => x.page)
            .filter(
              (p): p is MyTask & { type: string; archived_at: string | null } =>
                !!p && p.type === 'task' && !p.archived_at && openNames.includes(p.status ?? ''),
            );
        }),
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
      // 시작 안내는 "본부에 페이지가 없을 때"가 아니라 "내가 아직 아무 데도 안 가봤을 때" 보여준다
      // (그래야 나중에 입사한 사람도 첫날 안내를 본다)
      supabase
        .from('page_visits')
        .select('page_id', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .then((r) => r.count ?? 0),
    ]);

  // 담당 ∪ 참여 — 중복 제거 후 기한 순
  const assigned = (assignedRows ?? []) as MyTask[];
  const seen = new Set(assigned.map((t) => t.id));
  const joined: MyTask[] = participating.filter((t) => !seen.has(t.id));
  const myTasks = [...assigned, ...joined]
    .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'))
    .slice(0, 8);

  const today = new Date().toISOString().slice(0, 10);
  const isNewcomer = visitCount === 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10 sm:px-10">
      <h1 className="text-2xl font-semibold tracking-tight">
        {greeting()}, {profile?.name ?? '반갑습니다'}님
      </h1>
      <p className="mt-1 text-sm text-zinc-500">{today} · 경영관리본부 TeamHub</p>

      {/* 고정 공지 */}
      {(pinned ?? []).length > 0 && (
        <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <div className="flex items-baseline gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-800">📌 공지</h2>
            <Link href="/notices" className="ml-auto text-xs text-amber-800/70 hover:underline">
              전체 보기
            </Link>
          </div>
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

      {/* 시작하기 — 처음 오신 분께 (페이지를 한 번이라도 열면 사라집니다) */}
      {isNewcomer && (
        <section className="mt-8">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-semibold text-zinc-700">처음 오셨나요?</h2>
            <span className="text-xs text-zinc-400">페이지를 한 번 열어보면 이 안내는 사라집니다</span>
          </div>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            {[
              ['1', '페이지 만들기', '왼쪽 사이드바에서 팀 이름에 마우스를 올리면 ＋ 가 나옵니다. 회의록·업무·공지 양식을 고르세요.'],
              ['2', '쓰고 공유하기', '본문은 자동 저장됩니다. / 로 블록 메뉴, @ 로 동료 언급, 하단에서 댓글.'],
              ['3', '업무로 관리하기', '페이지를 업무로 전환하면 상태·담당자·기한이 붙고, 업무 목록과 이 홈에 모입니다.'],
            ].map(([n, t, d]) => (
              <div key={n} className="rounded-xl border border-zinc-200 p-4">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">{n}</div>
                <h3 className="mt-3 text-sm font-semibold">{t}</h3>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">{d}</p>
              </div>
            ))}
          </div>
          <GuideLink />
        </section>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* 내 업무 — 담당 + 참여 */}
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-zinc-700">내 업무</h2>
            <Link href="/tasks?mine=1" className="text-xs text-zinc-400 hover:underline">전체 보기</Link>
          </div>
          <ul className="mt-2 divide-y divide-zinc-100 rounded-xl border border-zinc-200">
            {myTasks.length === 0 && (
              <li className="px-4 py-6 text-center text-xs text-zinc-400">맡았거나 참여 중인 업무가 없습니다</li>
            )}
            {myTasks.map((t) => (
              <li key={t.id}>
                <Link href={`/p/${t.id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-zinc-50">
                  <span className="w-5 text-center">{t.icon ?? '☑'}</span>
                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  {t.assignee_id !== user!.id && (
                    <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500" title="담당자는 다른 분이고, 나는 참여자입니다">
                      참여
                    </span>
                  )}
                  <span className={`rounded px-1.5 py-0.5 text-[11px] ${statusClass(t.status, statuses)}`}>{t.status}</span>
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
            {(recent ?? []).length === 0 && <li className="px-4 py-6 text-center text-xs text-zinc-400">아직 페이지가 없습니다</li>}
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

      {/* 본부 현황 — 위젯 5개 고정 */}
      <div className="mt-10 flex items-baseline gap-3">
        <h2 className="text-sm font-semibold text-zinc-700">본부 현황</h2>
        <Link href="/tasks" className="ml-auto text-xs text-zinc-400 hover:underline">업무 목록 →</Link>
      </div>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardSection statuses={statuses} />
      </Suspense>
    </div>
  );
}

/** 사용법 페이지가 있으면 바로 갈 수 있게 (없으면 아무것도 안 보여준다) */
async function GuideLink() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('pages')
    .select('id')
    .eq('template', 'guide')
    .is('archived_at', null)
    .order('created_at')
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return (
    <Link
      href={`/p/${data.id}`}
      className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700"
    >
      📖 팀허브 3분 사용법 읽기
    </Link>
  );
}
