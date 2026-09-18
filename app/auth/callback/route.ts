/**
 * 구글 OAuth 콜백. Supabase 가 ?code= 를 붙여 리다이렉트하면
 * 코드를 세션으로 교환하고 쿠키에 저장한다.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const nextParam = searchParams.get('next') ?? '/';
  // open redirect 방지: 같은 오리진의 경로만 허용
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Vercel 등 로드밸런서 뒤에서는 origin 이 내부 주소일 수 있다
      const forwardedHost = request.headers.get('x-forwarded-host');
      const isLocal = process.env.NODE_ENV === 'development';
      if (isLocal) return NextResponse.redirect(`${origin}${next}`);
      if (forwardedHost) return NextResponse.redirect(`https://${forwardedHost}${next}`);
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback`);
}
