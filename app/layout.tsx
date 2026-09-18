import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TeamHub',
  description: '팀 업무 현황 협업 도구',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        {children}
      </body>
    </html>
  );
}
