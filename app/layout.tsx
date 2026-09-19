import type { Metadata } from 'next';
import { Noto_Sans_KR } from 'next/font/google';
import { cookies } from 'next/headers';
import './globals.css';
import { Providers } from '@/components/providers';

// Noto Sans KR — 빌드 시 받아 자체 호스팅한다 (구글 CDN 런타임 의존 없음)
const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-sans-kr',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'TeamHub',
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
