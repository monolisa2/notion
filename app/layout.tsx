import type { Metadata } from 'next';
import { Noto_Sans_KR } from 'next/font/google';
import { cookies } from 'next/headers';
import './globals.css';
import { Providers } from '@/components/providers';
import { APP_NAME } from '@/lib/branding';

/*
 * Noto Sans KR — 빌드 때 받아 자체 호스팅한다 (구글 CDN 런타임 의존 없음, 비용 0원).
 * 사람마다 다른 기기 글꼴(맑은 고딕 / Apple SD Gothic Neo)을 쓰면
 * 같은 화면이 컴퓨터마다 다르게 보인다 — 그게 싫어 다시 웹폰트로 돌아왔다.
 * subsets 는 미리 불러올 부분만 고르는 값일 뿐이다 — 한글 글리프는 전부 포함된다.
 */
const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-sans-kr',
  display: 'swap',
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: '경영관리본부 업무 공유 플랫폼',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // 테마는 쿠키로 — 서버 렌더 때부터 적용돼 깜빡임이 없다
  const theme = (await cookies()).get('theme')?.value === 'dark' ? 'dark' : '';
  return (
    <html lang="ko" className={`h-full antialiased ${notoSansKr.variable} ${theme}`} suppressHydrationWarning>
      <head>
      </head>
      <body className="flex min-h-full flex-col bg-white text-zinc-900 dark:bg-[#191919] dark:text-zinc-200">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
