import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, getSessionUser } from '@/lib/supabase/server';
import { getStatuses, getUnits } from '@/lib/reference';
import { statusClass, statusKind } from '@/lib/status-style';
import { subtreeOf, unitLabel } from '@/lib/org';
import { Avatar } from '@/components/avatar';
import { fetchParticipantsByPage } from '@/lib/participation';

export const dynamic = 'force-dynamic';

type TeamTask = {
  id: string;
  title: string;
  icon: string | null;
  status: string | null;
  progress: number | null;
  due_date: string | null;
  unit_id: string | null;
  parent_id: string | null;
  updated_at: string;
  assignee: { id: string; name: string; avatar_url: string | null } | null;
};
type LastLog = { page_id: string; content: string; created_at: string; author: { name: string } | null };

function dday(due: string | null, today: string) {
  if (!due) return null;
  if (due < today) return { label: '기한 초과', tone: 'text-red-600 font-medium' };
  if (due === today) return { label: '오늘 마감', tone: 'text-orange-600 font-medium' };
  const diff = Math.round((new Date(`${due}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000);
  return { label: `D-${diff}`, tone: diff <= 3 ? 'text-orange-600' : 'text-zinc-400' };
}

/**
 * 우리 팀 업무 현황 — 한 화면에 "누가 / 무엇을 / 어디까지 / 마지막 기록" 을 모아 본다.
 * 기본은 내 소속(하위 조직 포함). 관리자·실장은 다른 조직도 골라 볼 수 있다.
 */
export default async function TeamPage({ searchParams }: { searchParams: Promise<{ unit?: string }> }) {
  const { unit: unitParam } = await searchParams;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect('/login');

  const [{ data: profile }, units, statuses] = await Promise.all([
    supabase.from('profiles').select('unit_id, is_admin, job_title').eq('id', user.id).maybeSingle(),
    getUnits(),
    getStatuses(),
  ]);

  // 볼 조직: 지정 → 내 소속 → 본부
  const rootUnit = units.find((u) => !u.parent_id)?.id ?? null;
  const unitId = unitParam || profile?.unit_id || rootUnit;
  const scope = unitId ? [...subtreeOf(units, unitId)] : [];

  const { data: taskRows } = await supabase
    .from('pages')
    .select(
      'id, title, icon, status, progress, due_date, unit_id, parent_id, updated_at, assignee:profiles!pages_assignee_id_fkey(id, name, avatar_url)',
    )
    .eq('type', 'task')
    .is('archived_at', null)
    .in('unit_id', scope.length > 0 ? scope : ['00000000-0000-0000-0000-000000000000'])
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(300);
  const allTasks = (taskRows ?? []) as unknown as TeamTask[];

  // 진행 중(대기·진행 계열)만 — 완료·보류·드롭은 아래 요약에만
  const open = allTasks.filter((t) => ['대기', '진행'].includes(statusKind(t.status, statuses) ?? ''));
  const doneCount = allTasks.filter((t) => statusKind(t.status, statuses) === '완료').length;
  const holdCount = allTasks.filter((t) => ['보류', '드롭'].includes(statusKind(t.status, statuses) ?? '')).length;

  // 각 업무의 마지막 진행 기록 (한 번에 받아 클라이언트에서 묶는다)
  const ids = open.map((t) => t.id);
  const [{ data: logRows }, participants] = await Promise.all([
    ids.length
      ? supabase
          .from('page_updates')
          .select('page_id, content, created_at, author:profiles!page_updates_author_id_fkey(name)')
          .in('page_id', ids)
          .order('created_at', { ascending: false })
          .limit(400)
      : Promise.resolve({ data: [] as LastLog[] }),
    // 참여자(0013) — 담당자 말고 누가 같이 붙어 있는지도 보여야 한다
    fetchParticipantsByPage(supabase, ids),
  ]);
  const lastLog = new Map<string, LastLog>();
  for (const l of (logRows ?? []) as unknown as LastLog[]) {
    if (!lastLog.has(l.page_id)) lastLog.set(l.page_id, l);
  }

  // 담당자별로 묶기 (미지정은 마지막)
  const byPerson = new Map<string, { name: string; avatar: string | null; tasks: TeamTask[] }>();
  for (const t of open) {
    const key = t.assignee?.id ?? '__none__';
    const entry = byPerson.get(key) ?? {
      name: t.assignee?.name ?? '담당자 미지정',
      avatar: t.assignee?.avatar_url ?? null,
      tasks: [],
    };
    entry.tasks.push(t);
    byPerson.set(key, entry);
  }
  const groups = [...byPerson.entries()].sort(([a], [b]) =>
    a === '__none__' ? 1 : b === '__none__' ? -1 : 0,
  );

  const today = new Date().toISOString().slice(0, 10);
  const overdue = open.filter((t) => t.due_date && t.due_date < today).length;
  const avg = open.length
    ? Math.round(open.reduce((n, t) => n + (t.progress ?? 0), 0) / open.length)
    : 0;
  const isLead = !!profile?.is_admin || ['팀장', '실장', '본부장'].includes(profile?.job_title ?? '');

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8 sm:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {unitLabel(units, unitId) || '본부'} 업무 현황
        </h1>
        {isLead && units.length > 1 && (
          <form className="ml-auto" action="/team" method="get">
            <select
              name="unit"
              defaultValue={unitId ?? ''}
              className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs outline-none"
              aria-label="조직 선택"
            >
              {units
                .slice()
                .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                .map((u) => (
                  <option key={u.id} value={u.id ?? ''}>
                    {u.name}
                  </option>
                ))}
            </select>
            <button type="submit" className="ml-1 rounded-md border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-50">
              보기
            </button>
          </form>
        )}
      </div>

      {/* 요약 */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: '진행 중', value: `${open.length}건`, tone: '' },
          { label: '평균 진행률', value: `${avg}%`, tone: '' },
          { label: '기한 초과', value: `${overdue}건`, tone: overdue > 0 ? 'text-red-600' : '' },
          { label: '완료 / 보류', value: `${doneCount} / ${holdCount}`, tone: '' },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-zinc-200 px-3 py-2">
            <div className="text-[11px] text-zinc-400">{c.label}</div>
            <div className={`text-xl font-semibold tabular-nums ${c.tone}`}>{c.value}</div>
          </div>
        ))}
      </div>

      {open.length === 0 ? (
        <p className="mt-16 text-center text-sm text-zinc-400">이 조직에 진행 중인 업무가 없습니다.</p>
      ) : (
        <div className="mt-6 space-y-5">
          {groups.map(([key, g]) => (
            <section key={key} className="rounded-2xl border border-zinc-200">
              <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-2.5">
                {key === '__none__' ? (
                  <span className="inline-block h-5 w-5 rounded-full border border-dashed border-zinc-300" />
                ) : (
                  <Avatar name={g.name} src={g.avatar} size={20} />
                )}
                <span className="font-medium">{g.name}</span>
                <span className="text-xs text-zinc-400">{g.tasks.length}건</span>
                <span className="ml-auto text-xs tabular-nums text-zinc-400">
                  평균 {Math.round(g.tasks.reduce((n, t) => n + (t.progress ?? 0), 0) / g.tasks.length)}%
                </span>
              </div>
              <ul className="divide-y divide-zinc-50">
                {g.tasks.map((t) => {
                  const d = dday(t.due_date, today);
                  const log = lastLog.get(t.id);
                  return (
                    <li key={t.id} className="px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/p/${t.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                          {t.icon ?? '☑'} {t.title}
                        </Link>
                        {t.unit_id && t.unit_id !== unitId && (
                          <span className="shrink-0 text-[11px] text-zinc-400">{unitLabel(units, t.unit_id)}</span>
                        )}
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] ${statusClass(t.status, statuses)}`}>
                          {t.status}
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-zinc-200">
                            <span className="block h-full rounded-full bg-blue-500" style={{ width: `${t.progress ?? 0}%` }} />
                          </span>
                          <span className="w-9 text-right text-xs tabular-nums text-zinc-600">{t.progress ?? 0}%</span>
                        </span>
                        {(participants.get(t.id) ?? []).filter((u) => u.id !== t.assignee?.id).length > 0 && (
                          <span
                            className="flex shrink-0 -space-x-1.5"
                            title={`참여: ${(participants.get(t.id) ?? [])
                              .filter((u) => u.id !== t.assignee?.id)
                              .map((u) => u.name)
                              .join(', ')}`}
                          >
                            {(participants.get(t.id) ?? [])
                              .filter((u) => u.id !== t.assignee?.id)
                              .slice(0, 3)
                              .map((u) => (
                                <span key={u.id} className="rounded-full ring-2 ring-white dark:ring-zinc-900">
                                  <Avatar name={u.name} src={u.avatar_url} size={16} />
                                </span>
                              ))}
                          </span>
                        )}
                        {d && (
                          <span className={`shrink-0 text-xs tabular-nums ${d.tone}`} title={`기한 ${t.due_date}`}>
                            {d.label}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-xs text-zinc-500">
                        {log ? (
                          <>
                            <span className="text-zinc-400">{log.created_at.slice(5, 10)}</span>{' '}
                            <span className="font-medium text-zinc-600">{log.author?.name ?? ''}</span> {log.content}
                          </>
                        ) : (
                          <span className="text-zinc-400">아직 진행 기록이 없습니다</span>
                        )}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="mt-8 text-xs text-zinc-400">
        진행 중(대기·진행) 업무만 담당자별로 묶어 보여줍니다. 완료·보류는 위 요약에만 집계되고, 전체 목록은 업무 화면에서 볼 수 있습니다.
      </p>
    </div>
  );
}
