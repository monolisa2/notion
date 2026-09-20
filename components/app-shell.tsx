'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchTree } from '@/lib/pages';
import type { Me, OrgUnitRow, PageTreeRow, SidebarPageLite } from '@/lib/types';
import { Sidebar } from '@/components/sidebar/sidebar';
import { ProgressLogProvider } from '@/components/progress-log-provider';
import { TreeContext } from '@/components/tree-context';
import { NewPageProvider } from '@/components/new-page-provider';
import { QuickSwitcher } from '@/components/quick-switcher';

/**
 * 앱 공통 레이아웃: 사이드바 + 본문.
 * pages 테이블을 Realtime 으로 구독해 트리를 다시 받는다 (postgres_changes, 팀 규모용).
 */
export function AppShell({
  me,
  initialTree,
  units,
  favorites,
  recents,
  writerUnits = [],
  children,
}: {
  me: Me;
  initialTree: PageTreeRow[];
  units: OrgUnitRow[];
  favorites: SidebarPageLite[];
  recents: SidebarPageLite[];
  writerUnits?: string[];
  children: React.ReactNode;
}) {
  const [tree, setTree] = useState<PageTreeRow[]>(initialTree);
  const supabaseRef = useRef(createClient());
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      setTree(await fetchTree(supabaseRef.current));
    } catch {
      // 일시적 네트워크 오류는 다음 변경 때 다시 시도된다
    }
  }, []);

  // 변경 이벤트가 연달아 오면 300ms 로 묶어서 한 번만 다시 받는다
  const scheduleRefresh = useCallback(() => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(() => void refresh(), 300);
  }, [refresh]);

  useEffect(() => {
    const supabase = supabaseRef.current;
    const channel = supabase
      .channel('pages-tree')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pages' }, scheduleRefresh)
      .subscribe();
    return () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [scheduleRefresh]);

  // 모바일: 사이드바를 드로어로 (링크를 누르면 닫힌다)
  const [navOpen, setNavOpen] = useState(false);

  return (
    <TreeContext.Provider value={{ rows: tree, units }}>
      <ProgressLogProvider me={me} rows={tree}>
        <NewPageProvider me={me} onCreated={refresh}>
          <div className="flex h-dvh w-full overflow-hidden bg-white">
            {navOpen && (
              <div
                className="fixed inset-0 z-30 bg-black/30 md:hidden"
                onMouseDown={() => setNavOpen(false)}
                aria-hidden="true"
              />
            )}
            <div
              className={[
                'h-full max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:transition-transform max-md:duration-200',
                navOpen ? 'max-md:translate-x-0 max-md:shadow-2xl' : 'max-md:-translate-x-full',
              ].join(' ')}
              onClickCapture={(e) => {
                // 사이드바 안에서 페이지로 이동하면 드로어를 닫는다
                if ((e.target as HTMLElement).closest('a')) setNavOpen(false);
              }}
            >
              <Sidebar me={me} rows={tree} units={units} favorites={favorites} recents={recents} writerUnits={writerUnits} onChanged={refresh} />
            </div>
            <main className="min-w-0 flex-1 overflow-y-auto">
              {/* 모바일 상단바 */}
              <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-zinc-200 bg-white/95 px-3 py-2 backdrop-blur md:hidden">
                <button
                  type="button"
                  aria-label="메뉴 열기"
                  onClick={() => setNavOpen(true)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-100"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <span className="text-sm font-semibold text-zinc-800">TeamHub</span>
              </div>
              {children}
            </main>
            <QuickSwitcher rows={tree} favorites={favorites} recents={recents} />
          </div>
        </NewPageProvider>
      </ProgressLogProvider>
    </TreeContext.Provider>
  );
}
