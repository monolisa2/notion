/**
 * 진행 로그(page_updates) 헬퍼.
 * page_updates 는 append-only. INSERT 만 한다. 트리거가 pages.progress/status 를 동기화한다.
 */
import type { Db } from './pages';
import type { Tables } from './types';

export type PageUpdateRow = Tables['page_updates']['Row'];
export type UpdateWithAuthor = PageUpdateRow & {
  author: { id: string; name: string; avatar_url: string | null } | null;
};

/** 진행률 패널용: 하위 업무 목록 / 하위 업무 최근 기록 (서버·클라이언트 공용) */
export type ChildTaskLite = {
  id: string;
  title: string;
  icon: string | null;
  status: string | null;
  progress: number | null;
  assignee: { name: string; avatar_url: string | null } | null;
};
export type ChildUpdateLite = {
  id: string;
  content: string;
  progress_snapshot: number | null;
  created_at: string;
  author: { name: string; avatar_url: string | null } | null;
  page: { id: string; title: string } | null;
};
export const CHILD_TASK_SELECT =
  'id, title, icon, status, progress, assignee:profiles!pages_assignee_id_fkey(name, avatar_url)';
export const CHILD_UPDATE_SELECT =
  'id, content, progress_snapshot, created_at, author:profiles!page_updates_author_id_fkey(name, avatar_url), page:pages!inner(id, title, parent_id)';

export const UPDATE_SELECT =
  'id, page_id, author_id, content, progress_snapshot, status_snapshot, blocker, created_at, author:profiles!page_updates_author_id_fkey(id, name, avatar_url)';

export async function fetchUpdates(sb: Db, pageId: string, limit = 50): Promise<UpdateWithAuthor[]> {
  const { data, error } = await sb
    .from('page_updates')
    .select(UPDATE_SELECT)
    .eq('page_id', pageId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as UpdateWithAuthor[];
}

/**
 * 상태는 모달에 필드로 노출하지 않는다 (입력 3개 원칙).
 * 진행률로부터 의미(kind) 기준으로 유도한다: 100 → 완료 계열의 첫 상태,
 * 대기 계열에서 0 초과(또는 완료 계열에서 100 미만) → 진행 계열의 첫 상태. (0012)
 */
export function deriveStatus(
  progress: number,
  currentStatus: string | null,
  statuses: { name: string; kind: string; sort_order: number }[],
): string | null {
  const sorted = [...statuses].sort((a, b) => a.sort_order - b.sort_order);
  const firstOf = (kind: string) => sorted.find((s) => s.kind === kind)?.name ?? null;
  const curKind = sorted.find((s) => s.name === currentStatus)?.kind ?? null;
  if (progress >= 100) return curKind === '완료' ? null : firstOf('완료');
  if (curKind === '대기' && progress > 0) return firstOf('진행');
  if (curKind === '완료' && progress < 100) return firstOf('진행');
  return null; // 변경 없음 → coalesce 로 기존 값 유지
}

export async function insertProgressLog(
  sb: Db,
  params: {
    pageId: string;
    authorId: string;
    content: string;
    progress: number;
    currentStatus: string | null;
    blocker: string | null;
  },
): Promise<PageUpdateRow> {
  const { data: statusRows } = await sb.from('page_statuses').select('name, kind, sort_order');
  const { data, error } = await sb
    .from('page_updates')
    .insert({
      page_id: params.pageId,
      author_id: params.authorId,
      content: params.content.trim(),
      progress_snapshot: params.progress,
      status_snapshot: deriveStatus(params.progress, params.currentStatus, statusRows ?? []),
      blocker: params.blocker?.trim() || null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/**
 * 속성 바에서 진행률·상태를 바꿀 때 남기는 자동 기록.
 * 누가 언제 숫자를 조정했는지 타임라인에 그대로 남는다.
 */
export async function insertAutoLog(
  sb: Db,
  params: {
    pageId: string;
    authorId: string;
    content: string;
    progress: number | null;
    status: string | null;
  },
): Promise<void> {
  const { error } = await sb.from('page_updates').insert({
    page_id: params.pageId,
    author_id: params.authorId,
    content: params.content,
    progress_snapshot: params.progress,
    status_snapshot: params.status,
    blocker: null,
  });
  if (error) throw error;
}

/**
 * 진행 로그 본문의 @멘션 알림.
 * page_updates.content 는 평문이라 mentions 색인 대상이 아니다.
 * 알림은 반드시 enqueue_notification 을 통해서 (자기 자신 제외 / 5분 묶음 / 수신 설정 존중).
 */
export async function notifyLogMentions(
  sb: Db,
  params: {
    pageId: string;
    pageTitle: string;
    actorId: string;
    actorName: string;
    content: string;
    mentioned: { id: string; name: string }[];
  },
) {
  const targets = params.mentioned.filter((m) => params.content.includes(`@${m.name}`));
  await Promise.all(
    targets.map((m) =>
      sb.rpc('enqueue_notification', {
        p_recipient: m.id,
        p_actor: params.actorId,
        p_kind: 'mention',
        p_page_id: params.pageId,
        p_title: `${params.actorName}님이 「${params.pageTitle}」 진행 로그에서 회원님을 언급했습니다`,
        p_preview: params.content.slice(0, 200),
        p_dedupe_key: `logmention:${params.pageId}`,
      }),
    ),
  );
}
