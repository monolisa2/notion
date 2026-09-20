'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/errors';
import { savePage } from '@/lib/mentions';
import { blocksToText, contentLength, fetchSnapshots, type SnapshotRow } from '@/lib/history';
import { Avatar } from '@/components/avatar';

function when(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 본문 기록 보기 (0018).
 * 각 항목은 "그때 바뀌기 **직전**의 내용" 이다 — 되돌리면 그 내용이 돌아온다.
 */
export function PageHistory({
  pageId,
  meId,
  currentContent,
  onClose,
}: {
  pageId: string;
  meId: string;
  currentContent: unknown;
  onClose: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<SnapshotRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SnapshotRow | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchSnapshots(supabase, pageId)
      .then((r) => {
        if (!alive) return;
        setRows(r);
        setSelected(r[0] ?? null);
      })
      .catch((e) => alive && setError(errorMessage(e)));
    return () => {
      alive = false;
    };
  }, [supabase, pageId]);

  const nowLen = contentLength(currentContent);

  const restore = async (snap: SnapshotRow) => {
    if (!window.confirm(`${when(snap.created_at)} 직전 내용으로 되돌립니다.\n지금 본문은 기록에 남으니 다시 되돌릴 수 있습니다.`)) return;
    setBusy(true);
    try {
      await savePage(supabase, { pageId, authorId: meId, title: snap.title, content: snap.content });
      toast.success('되돌렸습니다. 화면을 새로 불러옵니다');
      onClose();
      // router.refresh() 로는 안 된다 — 에디터(BlockNote)는 page.id 로 마운트돼 있어서
      // 서버 데이터만 새로 받으면 화면의 본문은 옛 내용 그대로다.
      // 그 상태에서 한 글자만 쳐도 자동저장이 되돌린 내용을 다시 덮어쓴다.
      window.location.reload();
    } catch (e) {
      toast.error(`되돌리기 실패: ${errorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onMouseDown={onClose}>
      <div
        className="flex h-[min(80vh,640px)] w-full max-w-3xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* 목록 */}
        <div className="flex w-56 shrink-0 flex-col border-r border-zinc-100 dark:border-zinc-800">
          <div className="border-b border-zinc-100 px-3 py-2.5 dark:border-zinc-800">
            <h2 className="text-sm font-semibold">본문 기록</h2>
            <p className="mt-0.5 text-[11px] leading-snug text-zinc-400">바뀌기 직전 내용을 남깁니다</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1">
            {rows === null && <p className="px-2 py-4 text-xs text-zinc-400">불러오는 중…</p>}
            {error && <p className="px-2 py-4 text-xs text-red-600">{error}</p>}
            {rows?.length === 0 && (
              <p className="px-2 py-4 text-xs leading-relaxed text-zinc-400">
                아직 기록이 없습니다. 본문을 고치면 그 직전 내용이 여기에 쌓입니다.
              </p>
            )}
            {rows?.map((s) => {
              const len = contentLength(s.content);
              const shrank = len > 200 && nowLen < len / 2;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelected(s)}
                  className={`block w-full rounded-lg px-2 py-2 text-left text-xs ${
                    selected?.id === s.id ? 'bg-zinc-100 dark:bg-zinc-800' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                  }`}
                >
                  <span className="block font-medium tabular-nums">{when(s.created_at)}</span>
                  <span className="mt-0.5 flex items-center gap-1 text-zinc-500">
                    {s.replaced_by && <Avatar name={s.replaced_by.name} src={s.replaced_by.avatar_url} size={14} />}
                    <span className="truncate">{s.replaced_by?.name ?? '알 수 없음'}님이 수정</span>
                  </span>
                  <span className="mt-0.5 block text-[10px] text-zinc-400">
                    {len.toLocaleString()}자{shrank && <span className="ml-1 text-red-500">· 이후 크게 줄어듦</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 미리보기 */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-2.5 dark:border-zinc-800">
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{selected?.title ?? '미리보기'}</span>
            {selected && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void restore(selected)}
                className="shrink-0 rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
              >
                이 내용으로 되돌리기
              </button>
            )}
            <button type="button" onClick={onClose} aria-label="닫기" className="shrink-0 rounded-md px-2 py-1 text-zinc-400 hover:bg-zinc-100">
              ✕
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {selected ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                {blocksToText(selected.content, 4000) || '(빈 본문)'}
              </p>
            ) : (
              <p className="text-sm text-zinc-400">왼쪽에서 시점을 고르세요.</p>
            )}
          </div>
          <p className="border-t border-zinc-100 px-4 py-2 text-[11px] leading-relaxed text-zinc-400 dark:border-zinc-800">
            미리보기는 글자만 보여줍니다(표·이미지 제외). 되돌리면 그 시점의 본문 전체가 그대로 복원됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
