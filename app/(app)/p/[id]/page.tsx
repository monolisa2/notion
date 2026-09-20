import { notFound, redirect } from 'next/navigation';
import { createClient, getSessionUser } from '@/lib/supabase/server';
import { getStatuses, getUnits } from '@/lib/reference';
import { PageEditor } from '@/components/editor/page-editor';
import { PropertyBar } from '@/components/task/property-bar';
import { UpdateTimeline } from '@/components/task/update-timeline';
import { fetchUpdates } from '@/lib/updates';
import { fetchComments } from '@/lib/comments';
import { CommentThread } from '@/components/comments/comment-thread';
import type { Me } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { ProgressPanel } from '@/components/task/progress-panel';
import {
  CHILD_TASK_SELECT,
  CHILD_UPDATE_SELECT,
  type ChildTaskLite,
  type ChildUpdateLite,
} from '@/lib/updates';
import { SubpageList } from '@/components/subpage-list';
import { VisitTracker } from '@/components/visit-tracker';
import { NoticeReadStatus } from '@/components/notice-read-status';
import { ActionItemPromoter } from '@/components/task/action-item-promoter';

export default async function PageView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
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
  const [assignees, updates, comments, profile, units, fav, statuses, peopleIds, childTasks, childUpdates] = await Promise.all([
    isTask || page.template === 'meeting'
      ? supabase
          .from('profiles')
          .select('id, name, avatar_url')
          .is('deactivated_at', null)
          .order('name')
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
    isTask ? fetchUpdates(supabase, page.id).catch(() => []) : Promise.resolve([]),
    fetchComments(supabase, page.id).catch(() => []),
    supabase.from('profiles').select('name, avatar_url, is_admin, unit_id, rank, job_title').eq('id', user.id).maybeSingle().then((r) => r.data),
    getUnits(),
    supabase.from('page_favorites').select('page_id').eq('user_id', user.id).eq('page_id', page.id).maybeSingle().then((r) => !!r.data),
    getStatuses(),
    isTask
      ? supabase.from('page_people').select('user_id').eq('page_id', id).then((r) => (r.data ?? []).map((x) => x.user_id))
      : Promise.resolve([] as string[]),
    // 하위 업무 목록 (0014: 있으면 진행률은 평균 자동 계산 — 구성을 그대로 보여준다)
    isTask
      ? supabase
          .from('pages')
          .select(CHILD_TASK_SELECT)
          .eq('parent_id', id)
          .eq('type', 'task')
          .is('archived_at', null)
          .order('sort_order')
          .then((r) => (r.data ?? []) as unknown as ChildTaskLite[])
      : Promise.resolve([] as ChildTaskLite[]),
    // 하위 업무의 최근 진행 기록 (부모 페이지에서 한눈에)
    isTask
      ? supabase
          .from('page_updates')
          .select(CHILD_UPDATE_SELECT)
          .eq('page.parent_id', id)
          .order('created_at', { ascending: false })
          .limit(6)
          .then((r) => (r.data ?? []) as unknown as ChildUpdateLite[])
      : Promise.resolve([] as ChildUpdateLite[]),
  ]);
  const progressAuto = childTasks.length > 0;
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
    // pb-[30vh]: 페이지 끝에서도 조금 더 내려갈 수 있게 남겨 두는 여백.
    // 이게 없으면 마지막 줄이 화면 맨 아래에 붙어서 / 메뉴·@ 메뉴가 잘린다.
    <article className="min-h-full pb-[30vh]">
      <PageHeader
        key={`hdr-${page.id}`}
        page={page}
        units={units}
        isAdmin={me.isAdmin}
        meId={user.id}
        meUnitId={me.unitId}
        isFavorite={fav}
        meName={me.name}
        meAvatarUrl={me.avatarUrl}
      />
      <VisitTracker pageId={page.id} />

      {/* 공지면 읽음 현황 (작성자·관리자에게만 서버가 응답) */}
      {page.pinned && (me.isAdmin || page.created_by === user.id) && <NoticeReadStatus pageId={page.id} />}

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
          initialChildren={childTasks}
          initialChildUpdates={childUpdates}
        />
      )}

      {/* 회의록: 액션 아이템을 하위 업무로 승격 */}
      {page.template === 'meeting' && (
        <ActionItemPromoter key={`actions-${page.id}`} page={page} meId={user.id} people={assignees} />
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
