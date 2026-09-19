'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Reader = { user_id: string; name: string; read_at: string | null };

/**
 * 공지(고정) 페이지의 읽음 현황 — 작성자·관리자에게만 서버(notice_readers RPC)가 응답한다.
 * 권한이 없으면 RPC 가 거부하므로 아무것도 그리지 않는다.
 */
export function NoticeReadStatus({ pageId }: { pageId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [readers, setReaders] = useState<Reader[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void supabase
      .rpc('notice_readers', { p_page: pageId })
      .then(({ data, error }) => {
        if (!cancelled && !error && data) setReaders(data as Reader[]);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, pageId]);

  if (!readers) return null;
  const read = readers.filter((r) => r.read_at);
  const unread = readers.filter((r) => !r.read_at);

  return (
    <div className="mx-auto w-full max-w-[900px] px-6 pt-2 sm:px-12">
      <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-900">
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2">
          <span aria-hidden="true">📌</span>
          <span className="font-medium">
            공지 읽음 {read.length} / {readers.length}
          </span>
          {unread.length > 0 && <span className="text-amber-700">안 읽음 {unread.length}명</span>}
          <span className="ml-auto text-amber-400">{open ? '접기 ▲' : '자세히 ▼'}</span>
        </button>
        {open && (
          <div className="mt-2 space-y-1 border-t border-amber-200/70 pt-2">
            {unread.length > 0 && (
              <p>
                <span className="font-medium">안 읽음:</span> {unread.map((r) => r.name).join(', ')}
              </p>
            )}
            {read.length > 0 && (
              <p className="text-amber-700/80">
                <span className="font-medium">읽음:</span>{' '}
                {read.map((r) => `${r.name} (${r.read_at!.slice(5, 10)})`).join(', ')}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
