import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, getSessionUser } from '@/lib/supabase/server';
import { statusClass } from '@/lib/status-style';
import { DEFAULT_STATUSES } from '@/lib/types';
import { Avatar } from '@/components/avatar';

export const dynamic = 'force-dynamic';

type DigestRow = {
  author_name: string;
  page_title: string;
  page_status: string | null;
  progress: number | null;
  assignee_name: string;
  updates: string;
  blockers: string | null;
};
type SilentRow = { profile_id: string; name: string; open_tasks: number; last_log_at: string | null };

/**
 * 주간 모아보기 — 지난 N일의 진행 로그를 "사람별 → 업무별" 로 묶어서 보여준다.
 * 주간 회의 때 이 화면 하나로 진행하는 용도. 집계는 DB(weekly_digest)에서.
 */
export default async function WeeklyPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { days: daysParam } = await searchParams;
  const days = daysParam === '14' ? 14 : 7;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect('/login');

  const [{ data: digest }, { data: profile }, { data: statusRows }] = await Promise.all([
    supabase.rpc('weekly_digest', { p_days: days }),
    supabase.from('profiles').select('is_admin, job_title').eq('id', user.id).maybeSingle(),
    supabase.from('page_statuses').select('*').order('sort_order'),
  ]);
  const statuses = statusRows && statusRows.length > 0 ? statusRows : DEFAULT_STATUSES;
  const isLead = !!profile?.is_admin || ['팀장', '실장', '본부장'].includes(profile?.job_title ?? '');
  const silent: SilentRow[] = isLead
    ? ((await supabase.rpc('silent_members', { p_days: days })).data as SilentRow[] | null) ?? []
    : [];

  const rows = (digest ?? []) as DigestRow[];
  const byAuthor = new Map<string, DigestRow[]>();
  for (const r of rows) byAuthor.set(r.author_name, [...(byAuthor.get(r.author_name) ?? []), r]);

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8 sm:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">주간 모아보기</h1>
        <span className="text-sm text-zinc-400">지난 {days}일의 진행 로그 · 사람별</span>
        <div className="ml-auto flex gap-1 rounded-md border border-zinc-200 p-0.5 text-xs">
          {[7, 14].map((d) => (
            <Link
              key={d}
              href={d === 7 ? '/weekly' : `/weekly?days=${d}`}
              className={`rounded px-2.5 py-1 ${days === d ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-100'}`}
            >
              {d}일
            </Link>
          ))}
        </div>
      </div>

      {silent.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-900">
          <span className="font-medium">이 기간에 로그가 없는 담당자:</span>{' '}
          {silent.map((s) => `${s.name} (진행 중 ${s.open_tasks}건)`).join(', ')}
        </div>
      )}

      {byAuthor.size === 0 ? (
        <p className="mt-16 text-center text-sm text-zinc-400">지난 {days}일 동안 남긴 진행 로그가 없습니다.</p>
      ) : (
        <div className="mt-6 space-y-6">
          {[...byAuthor.entries()].map(([author, items]) => (
            <section key={author} className="rounded-2xl border border-zinc-200 p-4">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <Avatar name={author} src={null} size={24} />
                {author}
                <span className="text-xs font-normal text-zinc-400">업무 {items.length}건</span>
              </h2>
              <div className="mt-3 space-y-3">
                {items.map((it, i) => (
                  <div key={i} className="rounded-xl bg-zinc-50/80 px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium">{it.page_title}</span>
                      {it.page_status && (
                        <span className={`rounded px-1.5 py-0.5 text-[10px] ${statusClass(it.page_status, statuses)}`}>
                          {it.page_status}
                        </span>
                      )}
                      {it.progress !== null && <span className="text-xs tabular-nums text-zinc-500">{it.progress}%</span>}
                      <span className="ml-auto text-[11px] text-zinc-400">담당 {it.assignee_name}</span>
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm text-zinc-700">{it.updates}</p>
                    {it.blockers && (
                      <p className="mt-1.5 whitespace-pre-wrap rounded-md bg-red-50 px-2 py-1 text-sm text-red-700">
                        ⛔ {it.blockers}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="mt-8 text-xs text-zinc-400">
        기간 중 담당자가 바뀌어도 정확하도록 &ldquo;로그를 쓴 사람&rdquo; 기준으로 묶습니다. 텍스트로 복사해 주간보고에 붙여 쓰세요.
      </p>
    </div>
  );
}
