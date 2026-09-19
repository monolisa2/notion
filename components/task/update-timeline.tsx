'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/errors';
import { fetchUpdates, insertProgressLog, type UpdateWithAuthor } from '@/lib/updates';
import { Avatar } from '@/components/avatar';
import { useProgressLog } from '@/components/progress-log-provider';

function formatWhen(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 페이지 하단 진행 로그 타임라인 (최신순) + 바로 쓰는 한 줄 입력.
 * 수정/삭제 버튼은 없다 — append-only. 오기재는 새 로그로 정정한다.
 */
export function UpdateTimeline({ pageId, meId, initial }: { pageId: string; meId?: string; initial: UpdateWithAuthor[] }) {
  const supabase = useMemo(() => createClient(), []);
  const { open: openLog } = useProgressLog();
  const [items, setItems] = useState<UpdateWithAuthor[]>(initial);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

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

  const quickAdd = async () => {
    const content = text.trim();
    if (!content || !meId || saving) return;
    setSaving(true);
    try {
      // 진행률·상태는 현재 값 그대로 (바꾸려면 "자세히" 모달)
      const { data: cur } = await supabase.from('pages').select('progress, status').eq('id', pageId).single();
      await insertProgressLog(supabase, {
        pageId,
        authorId: meId,
        content,
        progress: cur?.progress ?? 0,
        currentStatus: cur?.status ?? null,
        blocker: null,
      });
      setText('');
      setItems(await fetchUpdates(supabase, pageId));
    } catch (e) {
      toast.error(`진행 로그 저장 실패: ${errorMessage(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-3xl px-6 pb-24 sm:px-10">
      <h2 className="text-sm font-medium text-zinc-500">진행 로그 {items.length > 0 && `· ${items.length}`}</h2>

      {/* 바로 쓰는 한 줄 입력 */}
      {meId && (
        <form
          className="mt-2 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void quickAdd();
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="오늘 한 일, 다음 할 일을 한 줄로…"
            className="min-w-0 flex-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400"
            disabled={saving}
          />
          <button
            type="submit"
            disabled={saving || !text.trim()}
            className="shrink-0 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
          >
            남기기
          </button>
          <button
            type="button"
            onClick={() => openLog(pageId)}
            className="shrink-0 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-500 hover:bg-zinc-50"
            title="진행률·막힘까지 함께 기록"
          >
            자세히
          </button>
        </form>
      )}

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-400">
          아직 진행 로그가 없습니다. 위 입력창에 한 줄 남겨보세요 — 진행률까지 바꾸려면 &ldquo;자세히&rdquo;.
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
