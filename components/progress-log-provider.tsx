'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ProgressLogModal } from '@/components/task/progress-log-modal';
import type { Me, PageTreeRow } from '@/lib/types';

type Ctx = {
  /** pageId 를 주면 그 업무로, 없으면 현재 페이지(업무일 때) 또는 선택 화면으로 연다 */
  open: (pageId?: string) => void;
};

const ProgressLogContext = createContext<Ctx>({ open: () => {} });
export const useProgressLog = () => useContext(ProgressLogContext);

/**
 * 어디서든 뜨는 진행 로그 모달 + 단축키 (Ctrl/⌘ + Shift + L).
 * 별도 페이지로 이동시키지 않는다 (CLAUDE.md 7절).
 */
export function ProgressLogProvider({
  me,
  rows,
  children,
}: {
  me: Me;
  rows: PageTreeRow[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [state, setState] = useState<{ open: boolean; pageId: string | null }>({
    open: false,
    pageId: null,
  });

  const currentTaskId = useMemo(() => {
    const id = pathname.startsWith('/p/') ? pathname.slice(3).split('/')[0] : null;
    if (!id) return null;
    const row = rows.find((r) => r.id === id);
    return row?.type === 'task' ? id : null;
  }, [pathname, rows]);

  const open = useCallback(
    (pageId?: string) => setState({ open: true, pageId: pageId ?? currentTaskId }),
    [currentTaskId],
  );
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
        e.preventDefault();
        open();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <ProgressLogContext.Provider value={{ open }}>
      {children}
      {state.open && <ProgressLogModal me={me} initialPageId={state.pageId} onClose={close} />}
    </ProgressLogContext.Provider>
  );
}
