'use client';

import { useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { touchVisit } from '@/lib/pages';

/** 페이지를 열면 "최근 항목" 용 방문 기록을 남긴다 (실패해도 조용히) */
export function VisitTracker({ pageId }: { pageId: string }) {
  const supabase = useMemo(() => createClient(), []);
  useEffect(() => {
    void touchVisit(supabase, pageId).catch(() => {});
  }, [supabase, pageId]);
  return null;
}
