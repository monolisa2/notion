import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './globals.css';
import { Providers } from '@/components/providers';
import { APP_NAME } from '@/lib/branding';

/*
 * Pretendard Variable — npm 패키지를 빌드 때 같이 묶는다 (외부 CDN 의존 없음, 무료 OFL).
 *
 * 동적 서브셋: 92조각으로 쪼개져 있고 각 조각에 unicode-range 가 붙어 있어
 * **화면에 실제로 나온 글자가 든 조각만** 내려받는다. 가변 글꼴이라 굵기는 한 벌로 전부 커버.
 */

export const metadata: Metadata = {
  title: APP_NAME,
  description: '경영관리본부 업무 공유 플랫폼',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // 테마는 쿠키로 — 서버 렌더 때부터 적용돼 깜빡임이 없다
  const theme = (await cookies()).get('theme')?.value === 'dark' ? 'dark' : '';
  return (
    <html lang="ko" className={`h-full antialiased ${theme}`} suppressHydrationWarning>
      <head>
      </head>
      <body className="flex min-h-full flex-col bg-white text-zinc-900 dark:bg-[#191919] dark:text-zinc-200">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
