/**
 * 브라우저용 Supabase 클라이언트 ('use client' 컴포넌트에서만 사용).
 * 세션은 쿠키에 저장되며 @supabase/ssr 이 서버와 공유한다.
 */
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/db';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!,
  );
}
