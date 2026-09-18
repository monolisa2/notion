'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchUpdates, type UpdateWithAuthor } from '@/lib/updates';
import { Avatar } from '@/components/avatar';

function formatWhen(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 페이지 하단 진행 로그 타임라인 (최신순).
 * 수정/삭제 버튼은 없다 — append-only. 오기재는 새 로그로 정정한다.
 */
export function UpdateTimeline({ pageId, initial }: { pageId: string; initial: UpdateWithAuthor[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<UpdateWithAuthor[]>(initial);

  useEffect(() => {
    const channel = supabase
      .channel(`updates-${pageId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'page_updates', filter: `page_id=eq.${pageId}` },
        async () => {
          // 작성자 join 이 필요하므로 다시 받는다 (팀 규모에서는 충분히 가볍다)
          try {
            setItems(await fetchUpdates(supabase, pageId));
          } catch {
            /* 다음 이벤트에 재시도 */
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, pageId]);

  return (
    <section className="mx-auto w-full max-w-3xl px-6 pb-24 sm:px-10">
      <h2 className="text-sm font-medium text-zinc-500">진행 로그 {items.length > 0 && `· ${items.length}`}</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-400">
          아직 진행 로그가 없습니다. 상단 &ldquo;진행 기록&rdquo; 또는 ⌃⇧L 로 한 줄 남겨보세요.
        </p>
      ) : (
        <ol className="mt-3 space-y-3">
          {items.map((u) => (
            <li
              key={u.id}
              className={[
                'rounded-xl border px-4 py-3',
                u.blocker
                  ? 'border-red-200 bg-red-50/60 dark:border-red-900/60 dark:bg-red-950/30'
                  : 'border-zinc-200 dark:border-zinc-800',
              ].join(' ')}
            >
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Avatar name={u.author?.name ?? '?'} src={u.author?.avatar_url} size={20} />
                <span className="font-medium text-zinc-700 dark:text-zinc-200">{u.author?.name ?? '알 수 없음'}</span>
                <time dateTime={u.created_at}>{formatWhen(u.created_at)}</time>
                {u.progress_snapshot !== null && (
                  <span className="ml-auto rounded bg-zinc-100 px-1.5 py-0.5 tabular-nums dark:bg-zinc-800">
                    {u.progress_snapshot}%
                  </span>
                )}
                {u.status_snapshot && (
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">{u.status_snapshot}</span>
                )}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{u.content}</p>
              {u.blocker && (
                <p className="mt-2 flex items-start gap-1.5 text-sm text-red-700 dark:text-red-300">
                  <span aria-hidden="true">⛔</span>
                  <span>
                    <span className="font-medium">막힘:</span> {u.blocker}
                  </span>
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
