import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, getSessionUser } from '@/lib/supabase/server';
import { getUnits } from '@/lib/reference';
import { unitLabel } from '@/lib/org';
import { Avatar } from '@/components/avatar';
import { NewNoticeButton } from '@/components/notices/new-notice-button';

export const dynamic = 'force-dynamic';

type NoticeRow = {
  id: string;
  title: string;
  icon: string | null;
  unit_id: string | null;
  visibility: string;
  event_date: string | null;
  created_at: string;
  updated_at: string;
  search_text: string | null;
  author: { name: string; avatar_url: string | null } | null;
};

const SELECT =
  'id, title, icon, unit_id, visibility, event_date, created_at, updated_at, search_text, author:profiles!pages_created_by_fkey(name, avatar_url)';

/** 제목을 뺀 본문 앞부분 (search_text 는 "제목 + 본문" 이라 제목을 덜어낸다) */
function snippet(row: NoticeRow): string {
  const t = (row.search_text ?? '').replace(/\s+/g, ' ').trim();
  const body = t.startsWith(row.title) ? t.slice(row.title.length).trim() : t;
  return body.length > 110 ? `${body.slice(0, 110)}…` : body;
}

/**
 * 공지 — "고정된 공지" 가 기준이다.
 *
 * 공지 양식(template='notice')으로 썼다고 공지가 되는 게 아니라,
 * ⋯ 메뉴에서 **공지로 고정**해야 홈 상단과 이 화면에 올라온다.
 * (모아보기의 공지 탭은 양식 기준이라 헷갈려서 이 화면으로 합쳤다)
 */
export default async function NoticesPage() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect('/login');

  const [{ data: pinned }, { data: past }, units, { data: visits }, { data: me }] = await Promise.all([
    supabase
      .from('pages')
      .select(SELECT)
      .eq('pinned', true)
      .is('archived_at', null)
      .order('event_date', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false })
      .limit(50),
    supabase
      .from('pages')
      .select(SELECT)
      .eq('template', 'notice')
      .eq('pinned', false)
      .is('archived_at', null)
      .order('event_date', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false })
      .limit(50),
    getUnits(),
    supabase.from('page_visits').select('page_id').eq('user_id', user.id),
    supabase.from('profiles').select('name, unit_id, is_admin').eq('id', user.id).maybeSingle(),
  ]);
  const rootUnitId = units.find((u) => !u.parent_id)?.id ?? null;

  const seen = new Set((visits ?? []).map((v) => v.page_id));
  const live = (pinned ?? []) as unknown as NoticeRow[];
  const old = (past ?? []) as unknown as NoticeRow[];

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8 sm:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">공지</h1>
        <span className="text-sm text-zinc-400">게시 중 {live.length}건</span>
        <div className="ml-auto">
          <NewNoticeButton
            isAdmin={me?.is_admin ?? false}
            rootUnitId={rootUnitId}
            myUnitId={me?.unit_id ?? null}
            myUnitName={unitLabel(units, me?.unit_id ?? null) || '내 소속'}
            authorName={me?.name ?? '나'}
          />
        </div>
      </div>

      {live.length === 0 ? (
        <p className="mt-10 rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-center text-sm leading-relaxed text-zinc-400 dark:border-zinc-700">
          게시 중인 공지가 없습니다.
          <br />
          오른쪽 위 <b>＋ 공지 쓰기</b> 를 누르면 바로 씁니다 — 양식과 게시가 함께 됩니다.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {live.map((n) => (
            <li key={n.id}>
              <Link
                href={`/p/${n.id}`}
                className="block rounded-xl border border-amber-200 bg-amber-50/40 px-4 py-3 hover:border-amber-300 hover:bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/10"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg leading-none" aria-hidden="true">{n.icon ?? '📢'}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{n.title}</span>
                  {!seen.has(n.id) && (
                    <span className="shrink-0 rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-medium text-white">새 공지</span>
                  )}
                </div>
                {snippet(n) && <p className="mt-1.5 line-clamp-2 pl-7 text-xs leading-relaxed text-zinc-500">{snippet(n)}</p>}
                <div className="mt-1.5 flex items-center gap-1.5 pl-7 text-[11px] text-zinc-400">
                  {n.author && <Avatar name={n.author.name} src={n.author.avatar_url} size={14} />}
                  <span>{n.author?.name}</span>
                  <span>·</span>
                  <span>{n.visibility === '본부' ? '본부 전체' : unitLabel(units, n.unit_id)}</span>
                  <span>·</span>
                  <span className="tabular-nums">{n.event_date ?? n.created_at.slice(0, 10)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {old.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-medium text-zinc-500">지난 공지</h2>
          <p className="mt-0.5 text-xs text-zinc-400">공지 양식으로 썼지만 지금은 고정돼 있지 않은 글입니다.</p>
          <ul className="mt-3 divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {old.map((n) => (
              <li key={n.id}>
                <Link href={`/p/${n.id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900/60">
                  <span className="w-5 text-center" aria-hidden="true">{n.icon ?? '📢'}</span>
                  <span className="min-w-0 flex-1 truncate">{n.title}</span>
                  <span className="shrink-0 text-xs text-zinc-400">{n.author?.name}</span>
                  <span className="shrink-0 text-xs tabular-nums text-zinc-400">{n.event_date ?? n.created_at.slice(0, 10)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-8 text-xs leading-relaxed text-zinc-400">
        게시 중인 공지는 홈 상단에도 뜹니다. 공지 페이지에서 작성자·관리자는 읽음 현황을 보고 📢 알림을 보낼 수 있습니다.
      </p>
    </div>
  );
}
