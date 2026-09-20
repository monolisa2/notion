'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/errors';

type Reader = { user_id: string; name: string; read_at: string | null };

/**
 * 공지(고정) 페이지의 읽음 현황 — 작성자·관리자에게만 서버(notice_readers RPC)가 응답한다.
 * 권한이 없으면 RPC 가 거부하므로 아무것도 그리지 않는다.
 */
export function NoticeReadStatus({ pageId }: { pageId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [readers, setReaders] = useState<Reader[] | null>(null);
  const [open, setOpen] = useState(false);
  // 아직 이 공지 알림을 안 받은 사람 수 (0019). null = 아직 모름
  const [pending, setPending] = useState<number | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void supabase
      .rpc('notice_readers', { p_page: pageId })
      .then(({ data, error }) => {
        if (!cancelled && !error && data) setReaders(data as Reader[]);
      });
    void supabase
      .rpc('notice_pending_count', { p_page: pageId })
      .then(({ data, error }) => {
        if (!cancelled && !error) setPending(Number(data ?? 0));
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, pageId]);

  /** 이 공지를 볼 수 있는 사람들에게 알림을 보낸다 (하루 한 번) */
  const send = async () => {
    if (pending === null) return;
    const ok = window.confirm(
      `이 공지를 볼 수 있는 ${pending}명에게 알림을 보냅니다.\n` +
        '사이드바 🔔 에 표시됩니다. 같은 사람에게 오늘 다시 가지는 않습니다.',
    );
    if (!ok) return;
    setSending(true);
    const { data, error } = await supabase.rpc('notify_notice', { p_page: pageId });
    setSending(false);
    if (error) {
      toast.error(`알림 보내기 실패: ${errorMessage(error)}`);
      return;
    }
    const sent = Number(data ?? 0);
    toast.success(sent > 0 ? `${sent}명에게 알림을 보냈습니다` : '오늘 이미 모두에게 보냈습니다');
    const { data: left } = await supabase.rpc('notice_pending_count', { p_page: pageId });
    setPending(Number(left ?? 0));
  };

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

        {/* 알림 보내기 — 공지는 홈에 뜨지만 앱을 안 열면 모른다 */}
        <div className="mt-2 flex items-center gap-2 border-t border-amber-200/70 pt-2">
          <button
            type="button"
            disabled={sending || pending === null || pending === 0}
            onClick={() => void send()}
            className="rounded-md bg-amber-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-amber-300"
          >
            {sending ? '보내는 중…' : '📢 알림 보내기'}
          </button>
          <span className="text-[11px] text-amber-700/80">
            {pending === null
              ? ''
              : pending > 0
                ? `아직 안 받은 분 ${pending}명 — 사이드바 🔔 에 표시됩니다`
                : '오늘 보낼 대상이 없습니다 (이미 모두 받았거나 대상이 없음)'}
          </span>
        </div>
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
