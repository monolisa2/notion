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
 * 진행률로부터 자연스럽게 유도한다: 100 → 완료, 대기 상태에서 0 초과 → 진행.
 */
export function deriveStatus(progress: number, currentStatus: string | null): string | null {
  if (progress >= 100) return '완료';
  if (currentStatus === '대기' && progress > 0) return '진행';
  if (currentStatus === '완료' && progress < 100) return '진행';
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
  const { data, error } = await sb
    .from('page_updates')
    .insert({
      page_id: params.pageId,
      author_id: params.authorId,
      content: params.content.trim(),
      progress_snapshot: params.progress,
      status_snapshot: deriveStatus(params.progress, params.currentStatus),
      blocker: params.blocker?.trim() || null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
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
