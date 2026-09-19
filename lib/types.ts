import type { Database } from '@/types/db';

export type Tables = Database['public']['Tables'];
export type Views = Database['public']['Views'];

export type PageRow = Tables['pages']['Row'];
export type ProfileRow = Tables['profiles']['Row'];
export type PageTreeRow = Views['v_page_tree']['Row'];
export type OrgUnitRow = Views['v_org_units']['Row'];
/** 사이드바 즐겨찾기·최근용 최소 페이지 정보 */
export type SidebarPageLite = { id: string; title: string; icon: string | null; type: string; status: string | null };
export type PageVisibility = '본부' | '소속' | '개인';
export const RANKS = ['사원', '주임', '대리', '과장', '차장', '부장'] as const;
export const JOB_TITLES = ['팀원', '팀장', '실장', '본부장'] as const;

export type PageType = 'doc' | 'task';
/** 업무 상태 (0012: page_statuses 테이블에서 관리, 본부 공통) */
export type StatusRow = Tables['page_statuses']['Row'];
export type StatusKind = '대기' | '진행' | '완료' | '보류' | '드롭';
/** page_statuses 를 아직 못 받았을 때의 기본 목록 (0012 시드와 동일) */
export const DEFAULT_STATUSES: StatusRow[] = [
  { id: 'd1', name: '대기', kind: '대기', color: 'zinc', sort_order: 100, created_at: '' },
  { id: 'd2', name: '진행', kind: '진행', color: 'blue', sort_order: 200, created_at: '' },
  { id: 'd3', name: '검토', kind: '진행', color: 'violet', sort_order: 300, created_at: '' },
  { id: 'd4', name: '완료', kind: '완료', color: 'emerald', sort_order: 400, created_at: '' },
  { id: 'd5', name: '보류', kind: '보류', color: 'amber', sort_order: 500, created_at: '' },
  { id: 'd6', name: '드롭', kind: '드롭', color: 'zinc', sort_order: 600, created_at: '' },
];
/** @deprecated 0012 이후 화면은 page_statuses 목록을 쓴다 */
export const PAGE_STATUSES = ['대기', '진행', '검토', '완료', '보류', '드롭'] as const;
export type PageStatus = (typeof PAGE_STATUSES)[number];
export const PAGE_PRIORITIES = ['긴급', '높음', '보통', '낮음'] as const;
export type PagePriority = (typeof PAGE_PRIORITIES)[number];

/** 로그인 사용자 최소 정보 (레이아웃 → 클라이언트 전달용) */
export type Me = {
  id: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
  unitId: string | null;
  rank: string | null;
  jobTitle: string | null;
};
