/**
 * 요청마다 세션 토큰을 갱신하고, 갱신된 쿠키를 응답에 실어 보낸다.
 * Next.js 16 에서는 middleware.ts 가 proxy.ts 로 이름이 바뀌었다 (루트 proxy.ts 에서 호출).
 *
 * 주의: createServerClient 와 getClaims() 사이에 다른 로직을 넣지 말 것.
 *       토큰 갱신이 빠져 사용자가 무작위로 로그아웃되는 원인이 된다.
 */
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/db';

/** 로그인 없이 접근 가능한 경로 */
const PUBLIC_PATHS = ['/login', '/auth', '/dev-editor'];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // 세션 갱신 (만료 임박 시 refresh token 으로 재발급 → setAll 로 쿠키 반영)
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // supabaseResponse 를 그대로 반환해야 갱신된 쿠키가 브라우저에 전달된다.
  return supabaseResponse;
}
