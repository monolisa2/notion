import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import './globals.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: 'TeamHub',
  description: '경영관리본부 업무 공유 플랫폼',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // 테마는 쿠키로 — 서버 렌더 때부터 적용돼 깜빡임이 없다
  const theme = (await cookies()).get('theme')?.value === 'dark' ? 'dark' : '';
  return (
    <html lang="ko" className={`h-full antialiased ${theme}`} suppressHydrationWarning>
      <head>
        {/* Freesentation 폰트 프리로드 (본문 기본 굵기) */}
        <link
          rel="preload"
          href="/fonts/freesentation/Freesentation-Regular.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="flex min-h-full flex-col bg-white text-zinc-900 dark:bg-[#191919] dark:text-zinc-200">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
