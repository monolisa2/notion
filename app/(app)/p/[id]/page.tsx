import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageEditor } from '@/components/editor/page-editor';
import { PropertyBar } from '@/components/task/property-bar';
import { UpdateTimeline } from '@/components/task/update-timeline';
import { fetchUpdates } from '@/lib/updates';
import { fetchComments } from '@/lib/comments';
import { CommentThread } from '@/components/comments/comment-thread';
import type { Me, OrgUnitRow } from '@/lib/types';
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
  const [assignees, updates, comments, profile, units, fav] = await Promise.all([
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

      {isTask && <PropertyBar key={`props-${page.id}`} page={page} assignees={assignees} meId={user.id} />}
      {isTask && <ProgressPanel key={`progress-${page.id}`} page={page} initialUpdates={updates} />}

      {/* key 로 페이지 이동 시 에디터를 새로 마운트 */}
      <PageEditor key={page.id} page={page} userId={user.id} />

      <SubpageList key={`sub-${page.id}`} page={page} />

      {isTask && <UpdateTimeline key={`updates-${page.id}`} pageId={page.id} meId={user.id} initial={updates} />}

      <CommentThread key={`comments-${page.id}`} pageId={page.id} me={me} initial={comments} />
    </article>
  );
}
