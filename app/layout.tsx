import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: 'TeamHub',
  description: '경영관리본부 업무 공유 플랫폼',
  // 브라우저의 '강제 다크 모드' 도 밝은 화면으로 두게 한다
  other: { 'color-scheme': 'only light' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* 한글 본문 폰트 (무료, CDN) */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="flex min-h-full flex-col bg-white text-zinc-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
