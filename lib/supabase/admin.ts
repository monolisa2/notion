import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/db';

/**
 * service_role 클라이언트. RLS 를 우회하므로 서버 액션 안에서 requireAdmin() 뒤에만 쓴다.
 * 계정 생성 / 비밀번호 초기화 / 비활성화(ban) 같은 auth.admin 작업 전용.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다 (.env.local / Vercel 환경변수)');
  }
  return createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
