import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageEditor } from '@/components/editor/page-editor';
import { PropertyBar } from '@/components/task/property-bar';
import { UpdateTimeline } from '@/components/task/update-timeline';
import { fetchUpdates } from '@/lib/updates';
import { fetchComments } from '@/lib/comments';
import { CommentThread } from '@/components/comments/comment-thread';
import { DEFAULT_STATUSES, type Me, type OrgUnitRow } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { ProgressPanel } from '@/components/task/progress-panel';
import { SubpageList } from '@/components/subpage-list';
import { VisitTracker } from '@/components/visit-tracker';

export default async function PageView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: page, error } = await supabase
    .from('pages')
    .select('*')
    .eq('id', id)
    .is('archived_at', null)
    .maybeSingle();

  if (error) throw new Error(`페이지를 불러오지 못했습니다: ${error.message}`);
  if (!page) notFound();

  const isTask = page.type === 'task';
  const [assignees, updates, comments, profile, units, fav, statuses, peopleIds, progressAuto] = await Promise.all([
    isTask
      ? supabase
          .from('profiles')
          .select('id, name, avatar_url')
          .is('deactivated_at', null)
          .order('name')
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
    isTask ? fetchUpdates(supabase, page.id) : Promise.resolve([]),
    fetchComments(supabase, page.id),
    supabase.from('profiles').select('name, avatar_url, is_admin, unit_id, rank, job_title').eq('id', user.id).maybeSingle().then((r) => r.data),
    supabase.from('v_org_units').select('*').then((r) => (r.data ?? []) as OrgUnitRow[]),
    supabase.from('page_favorites').select('page_id').eq('user_id', user.id).eq('page_id', page.id).maybeSingle().then((r) => !!r.data),
    supabase.from('page_statuses').select('*').order('sort_order').then((r) => (r.data && r.data.length > 0 ? r.data : DEFAULT_STATUSES)),
    isTask
      ? supabase.from('page_people').select('user_id').eq('page_id', id).then((r) => (r.data ?? []).map((x) => x.user_id))
      : Promise.resolve([] as string[]),
    // 하위 업무가 있으면 진행률은 평균 자동 계산 (0014) — 손 편집을 잠근다
    isTask
      ? supabase
          .from('pages')
          .select('id', { count: 'exact', head: true })
          .eq('parent_id', id)
          .eq('type', 'task')
          .is('archived_at', null)
          .then((r) => (r.count ?? 0) > 0)
      : Promise.resolve(false),
  ]);
  const me: Me = {
    id: user.id,
    name: profile?.name ?? '나',
    email: user.email ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    isAdmin: profile?.is_admin ?? false,
    unitId: profile?.unit_id ?? null,
    rank: profile?.rank ?? null,
    jobTitle: profile?.job_title ?? null,
  };

  return (
    <article className="min-h-full">
      <PageHeader key={`hdr-${page.id}`} page={page} units={units} isAdmin={me.isAdmin} meId={user.id} meUnitId={me.unitId} isFavorite={fav} />
      <VisitTracker pageId={page.id} />

      {isTask && (
        <PropertyBar
          key={`props-${page.id}`}
          page={page}
          assignees={assignees}
          meId={user.id}
          statuses={statuses}
          initialPeople={peopleIds}
        />
      )}
      {isTask && (
        <ProgressPanel
          key={`progress-${page.id}`}
          page={page}
          initialUpdates={updates}
          statuses={statuses}
          autoFromChildren={progressAuto}
        />
      )}

      {/* 하위 페이지를 본문 위에 — 들어오자마자 구조가 보이게 */}
      <SubpageList key={`sub-${page.id}`} page={page} statuses={statuses} />

      {/* key 로 페이지 이동 시 에디터를 새로 마운트 */}
      <PageEditor key={page.id} page={page} userId={user.id} />

      {isTask && (
        <UpdateTimeline key={`updates-${page.id}`} pageId={page.id} meId={user.id} initial={updates} progressAuto={progressAuto} />
      )}

      <CommentThread key={`comments-${page.id}`} pageId={page.id} me={me} initial={comments} />
    </article>
  );
}
