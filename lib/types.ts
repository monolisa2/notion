import type { Database } from '@/types/db';

export type Tables = Database['public']['Tables'];
export type Views = Database['public']['Views'];

export type PageRow = Tables['pages']['Row'];
export type ProfileRow = Tables['profiles']['Row'];
export type PageTreeRow = Views['v_page_tree']['Row'];
export type OrgUnitRow = Views['v_org_units']['Row'];
export type PageVisibility = '본부' | '소속' | '개인';
export const RANKS = ['사원', '주임', '대리', '과장', '차장', '부장'] as const;
export const JOB_TITLES = ['팀원', '팀장', '실장', '본부장'] as const;

export type PageType = 'doc' | 'task';
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
