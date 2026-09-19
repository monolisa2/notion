/**
 * 화면마다 반복해서 읽는 "기준 데이터" (조직도 · 업무 상태 목록).
 *
 * 레이아웃과 페이지가 같은 요청에서 각각 조회하면 왕복이 두 배가 된다.
 * React `cache()` 로 감싸 **요청 한 번당 한 번만** 조회한다
 * (요청이 끝나면 캐시도 사라지므로 사용자 간에 섞이지 않는다).
 */
import { cache } from 'react';
import { createClient, getSessionUser } from './supabase/server';
import { DEFAULT_STATUSES, type OrgUnitRow, type StatusRow } from './types';

export const getUnits = cache(async (): Promise<OrgUnitRow[]> => {
  const sb = await createClient();
  const { data } = await sb.from('v_org_units').select('*');
  return (data ?? []) as OrgUnitRow[];
});

export const getStatuses = cache(async (): Promise<StatusRow[]> => {
  const sb = await createClient();
  const { data } = await sb.from('page_statuses').select('*').order('sort_order');
  return data && data.length > 0 ? data : DEFAULT_STATUSES;
});

/** 내 프로필 — 레이아웃·페이지가 중복 조회하지 않도록 요청당 1회 */
export const getMyProfile = cache(async () => {
  const sb = await createClient();
  const user = await getSessionUser(sb);
  if (!user) return null;
  const { data } = await sb
    .from('profiles')
    .select('id, name, is_admin, job_title, unit_id')
    .eq('id', user.id)
    .maybeSingle();
  return data;
});
