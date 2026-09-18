'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchActivityFeed, type ActivityRow } from '@/lib/dashboard';
import { timeAgo } from '@/lib/notifications';
import { Avatar } from '@/components/avatar';
import { Empty } from './widget';

/** 최근 7일 활동 피드. page_updates INSERT 를 구독해 새 로그가 즉시 위에 쌓인다. */
export function ActivityFeed({ initial }: { initial: ActivityRow[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<ActivityRow[]>(initial);
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  useEffect(() => {
    const channel = supabase
      .channel('dashboard-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'page_updates' }, (payload) => {
        const newId = (payload.new as { id?: string }).id;
        // 뷰 join(작성자/페이지 제목)이 필요하므로 다시 받는다
        void fetchActivityFeed(supabase)
          .then((data) => {
            setRows(data);
            if (newId) {
              setFresh((prev) => new Set(prev).add(newId));
              setTimeout(() => {
                setFresh((prev) => {
                  const next = new Set(prev);
                  next.delete(newId);
                  return next;
                });
              }, 4000);
            }
          })
          .catch(() => {});
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  if (rows.length === 0) return <Empty>최근 7일간 진행 로그가 없습니다.</Empty>;

  return (
    <ol className="max-h-[32rem] space-y-1 overflow-y-auto pr-1">
      {rows.map((r) => (
        <li
          key={r.id}
          className={`rounded-lg px-2 py-2 transition-colors ${
            r.id && fresh.has(r.id) ? 'bg-blue-50 dark:bg-blue-950/30' : ''
          }`}
        >
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Avatar name={r.author_name ?? '?'} src={r.avatar_url} size={18} />
            <span className="font-medium text-zinc-700 dark:text-zinc-200">{r.author_name}</span>
            <Link href={`/p/${r.page_id}`} className="min-w-0 truncate hover:underline">
              {r.icon ?? '☑'} {r.page_title}
            </Link>
            <span className="ml-auto shrink-0">{r.created_at ? timeAgo(r.created_at) : ''}</span>
          </div>
          <p className="mt-1 text-sm">
            {r.content}
            {r.progress_snapshot !== null && (
              <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {r.progress_snapshot}%
              </span>
            )}
          </p>
          {r.blocker && (
            <p className="mt-1 text-xs text-red-700 dark:text-red-300">⛔ {r.blocker}</p>
          )}
        </li>
      ))}
    </ol>
  );
}
