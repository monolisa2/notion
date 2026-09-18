'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/errors';
import {
  fetchNotifications,
  KIND_META,
  markRead,
  timeAgo,
  type NotificationKind,
  type NotificationRow,
} from '@/lib/notifications';

/**
 * 헤더 벨 + 안 읽은 개수 배지 + 드롭다운.
 * notifications 를 recipient_id = 내 id 로 Realtime 구독한다 (RLS 도 본인 것만 통과).
 */
export function NotificationBell({ meId }: { meId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const reload = async () => {
    try {
      setItems(await fetchNotifications(supabase));
    } catch {
      /* 다음 이벤트에 재시도 */
    }
  };

  useEffect(() => {
    void fetchNotifications(supabase).then(setItems).catch(() => {});
    const channel = supabase
      .channel(`notifications-${meId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${meId}` },
        () => void fetchNotifications(supabase).then(setItems).catch(() => {}),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, meId]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const unread = items.filter((n) => !n.read_at).length;

  const onClickItem = async (n: NotificationRow) => {
    setOpen(false);
    if (!n.read_at) {
      // optimistic
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      markRead(supabase, [n.id]).catch((e) => toast.error(`읽음 처리 실패: ${errorMessage(e)}`));
    }
    if (n.page_id) router.push(`/p/${n.page_id}`);
  };

  const readAll = async () => {
    try {
      setItems((prev) => prev.map((x) => (x.read_at ? x : { ...x, read_at: new Date().toISOString() })));
      await markRead(supabase);
      await reload();
    } catch (e) {
      toast.error(`읽음 처리 실패: ${errorMessage(e)}`);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={`알림 ${unread > 0 ? `${unread}개 안 읽음` : ''}`}
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-red-500 px-1 text-center text-[10px] font-semibold leading-4 text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 w-80 rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center justify-between px-3 py-2 text-xs">
            <span className="font-medium">알림</span>
            <button
              type="button"
              onClick={() => void readAll()}
              disabled={unread === 0}
              className="text-zinc-500 hover:text-zinc-800 disabled:opacity-40 dark:hover:text-zinc-100"
            >
              모두 읽음
            </button>
          </div>
          <ul className="max-h-96 overflow-y-auto border-t border-zinc-100 dark:border-zinc-800">
            {items.length === 0 && (
              <li className="px-3 py-8 text-center text-xs text-zinc-400">알림이 없습니다</li>
            )}
            {items.map((n) => {
              const meta = KIND_META[(n.kind as NotificationKind) ?? 'mention'] ?? KIND_META.mention;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => void onClickItem(n)}
                    className={`flex w-full gap-2.5 px-3 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
                      n.read_at ? '' : 'bg-blue-50/50 dark:bg-blue-950/20'
                    }`}
                  >
                    <span
                      aria-label={meta.label}
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs dark:bg-zinc-800"
                    >
                      {meta.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm leading-snug ${n.read_at ? 'text-zinc-600 dark:text-zinc-300' : 'font-medium'}`}>
                        {n.title}
                      </span>
                      {n.preview && (
                        <span className="mt-0.5 block truncate text-xs text-zinc-500">{n.preview}</span>
                      )}
                      <span className="mt-0.5 block text-[11px] text-zinc-400">{timeAgo(n.created_at)}</span>
                    </span>
                    {!n.read_at && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
