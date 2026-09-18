/**
 * 서버 컴포넌트 / Route Handler / Server Action 용 Supabase 클라이언트.
 * 요청마다 새로 만들 것. 요청 간에 공유하면 다른 사용자의 세션이 섞인다.
 */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/db';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // 서버 컴포넌트에서는 쿠키를 쓸 수 없다.
            // 세션 갱신은 proxy.ts(updateSession)가 담당하므로 무시해도 된다.
          }
        },
      },
    },
  );
}
