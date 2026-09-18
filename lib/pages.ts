/**
 * 페이지 조작 헬퍼 (클라이언트/서버 공용).
 * - sort_order / path 를 직접 계산하지 않는다. 이동은 move_page RPC 만 사용.
 * - 본문 저장은 lib/mentions.ts 의 savePage() 를 쓴다 (멘션 동기화가 묶여 있음).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/db';
import type { PageTreeRow, PageType, PageVisibility, Tables } from './types';

export type Db = SupabaseClient<Database>;

export async function fetchTree(sb: Db): Promise<PageTreeRow[]> {
  const { data, error } = await sb.from('v_page_tree').select('*').order('path');
  if (error) throw error;
  return data ?? [];
}

export async function createPage(
  sb: Db,
  params: {
    parentId: string | null;
    createdBy: string;
    type?: PageType;
    title?: string;
    /** 루트 페이지일 때만 의미 있음. 하위 페이지는 부모의 공간/공개범위를 상속한다 */
    unitId?: string | null;
    visibility?: PageVisibility;
    icon?: string | null;
    content?: unknown;
  },
): Promise<string> {
  const type = params.type ?? 'doc';
  const { data, error } = await sb
    .from('pages')
    .insert({
      parent_id: params.parentId,
      created_by: params.createdBy,
      type,
      title: params.title ?? '제목 없음',
      status: type === 'task' ? '대기' : null,
      progress: type === 'task' ? 0 : null,
      icon: params.icon ?? null,
      content: (params.content ?? null) as never,
      ...(params.parentId === null
        ? {
            visibility: params.visibility ?? '본부',
            unit_id: params.visibility === '개인' ? null : (params.unitId ?? null),
          }
        : {}),
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function renamePage(sb: Db, id: string, title: string) {
  const { error } = await sb
    .from('pages')
    .update({ title: title.trim() || '제목 없음' })
    .eq('id', id);
  if (error) throw error;
}

export async function archivePages(sb: Db, ids: string[]) {
  if (ids.length === 0) return;
  const { error } = await sb
    .from('pages')
    .update({ archived_at: new Date().toISOString() })
    .in('id', ids);
  if (error) throw error;
}

/** 문서 ↔ 업무 전환. doc 으로 돌릴 때는 업무 속성을 비워야 제약(pages_task_shape)을 통과한다. */
export async function convertPageType(sb: Db, id: string, to: PageType) {
  const patch =
    to === 'task'
      ? { type: 'task', status: '대기', progress: 0 }
      : { type: 'doc', status: null, assignee_id: null, progress: null, due_date: null,
          priority: null, start_date: null, completed_at: null };
  const { error } = await sb.from('pages').update(patch).eq('id', id);
  if (error) throw error;
}

export const CYCLE_MOVE_MESSAGE = '페이지를 자신의 하위로 이동할 수 없습니다';

export async function movePage(
  sb: Db,
  params: { pageId: string; parentId: string | null; afterId: string | null },
) {
  const { error } = await sb.rpc('move_page', {
    p_page_id: params.pageId,
    // 루트로 옮길 때는 null. 생성된 타입은 string 이지만 SQL 시그니처는 nullable 이다.
    p_parent_id: params.parentId as unknown as string,
    p_after_id: (params.afterId ?? null) as unknown as string | undefined,
  });
  if (error) throw error;
}

/** 루트 페이지의 공간/공개범위 변경 (후손은 트리거가 따라 바꾼다) */
export async function setPageSpace(
  sb: Db,
  id: string,
  patch: { unitId?: string | null; visibility?: PageVisibility },
) {
  const row: Tables['pages']['Update'] = {};
  if ('unitId' in patch) row.unit_id = patch.unitId;
  if (patch.visibility) row.visibility = patch.visibility;
  const { error } = await sb.from('pages').update(row).eq('id', id);
  if (error) throw error;
}

export async function setPageIcon(sb: Db, id: string, icon: string | null) {
  const { error } = await sb.from('pages').update({ icon }).eq('id', id);
  if (error) throw error;
}
