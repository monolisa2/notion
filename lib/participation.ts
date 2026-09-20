/**
 * 업무 "참여자"(page_people, 0013) 조회 헬퍼.
 *
 * 담당자(assignee_id)는 책임자 1명이고, 함께 하는 사람은 page_people 에 들어간다.
 * 그런데 홈·업무 목록·팀 현황이 담당자만 보면 **참여자로 지정된 사람 화면엔 그 업무가 아예 없다.**
 * "내 일"은 담당 ∪ 참여 로 본다.
 */
import type { Db } from './pages';

/** 내가 참여자로 들어가 있는 페이지 id 목록 */
export async function fetchMyParticipations(sb: Db, userId: string): Promise<string[]> {
  const { data } = await sb.from('page_people').select('page_id').eq('user_id', userId);
  return (data ?? []).map((r) => r.page_id as string);
}

export type ParticipantLite = { id: string; name: string; avatar_url: string | null };

/** 여러 페이지의 참여자를 한 번에 — page_id → 사람들 */
export async function fetchParticipantsByPage(
  sb: Db,
  pageIds: string[],
): Promise<Map<string, ParticipantLite[]>> {
  const map = new Map<string, ParticipantLite[]>();
  if (pageIds.length === 0) return map;
  const { data } = await sb
    .from('page_people')
    .select('page_id, user:profiles!page_people_user_id_fkey(id, name, avatar_url)')
    .in('page_id', pageIds);
  for (const row of (data ?? []) as unknown as { page_id: string; user: ParticipantLite | null }[]) {
    if (!row.user) continue;
    const list = map.get(row.page_id) ?? [];
    list.push(row.user);
    map.set(row.page_id, list);
  }
  return map;
}
