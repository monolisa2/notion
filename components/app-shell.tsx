'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchTree } from '@/lib/pages';
import type { Me, PageTreeRow } from '@/lib/types';
import { Sidebar } from '@/components/sidebar/sidebar';
import { ProgressLogProvider } from '@/components/progress-log-provider';

/**
 * 앱 공통 레이아웃: 사이드바 + 본문.
 * pages 테이블을 Realtime 으로 구독해 트리를 다시 받는다 (postgres_changes, 팀 규모용).
 */
export function AppShell({
  me,
  initialTree,
  children,
}: {
  me: Me;
  initialTree: PageTreeRow[];
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

  return (
    <ProgressLogProvider me={me} rows={tree}>
      <div className="flex h-dvh w-full overflow-hidden">
        <Sidebar me={me} rows={tree} onChanged={refresh} />
        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </ProgressLogProvider>
  );
}
