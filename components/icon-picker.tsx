'use client';

import { useMemo, useState } from 'react';
import { searchEmoji } from '@/lib/emoji';

/**
 * 페이지 아이콘 고르는 창.
 * 290개를 그냥 늘어놓으면 못 찾으니 **한글 검색**과 분류를 같이 둔다.
 * ("회의" "예산" "마감" 처럼 쳐서 찾는다)
 */
export function IconPicker({
  current,
  onPick,
  onClear,
  onClose,
}: {
  current: string | null;
  onPick: (emoji: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const groups = useMemo(() => searchEmoji(q), [q]);

  return (
    <>
      <div className="fixed inset-0 z-10" onMouseDown={onClose} />
      <div className="absolute left-0 top-full z-20 mt-1 w-[332px] rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-zinc-400" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
            }}
            placeholder="검색"
            aria-label="아이콘 검색"
            className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-zinc-400"
          />
          {current && (
            <button
              type="button"
              onClick={onClear}
              className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
            >
              제거
            </button>
          )}
        </div>

        <div className="max-h-[300px] overflow-y-auto overscroll-contain p-2">
          {groups.length === 0 && (
            <p className="px-2 py-10 text-center text-sm text-zinc-400">
              찾는 아이콘이 없습니다.
              <br />
              <span className="text-xs">다른 말로 해보세요 — 예: 문서, 사람, 목표</span>
            </p>
          )}
          {groups.map((g) => (
            <section key={g.name} className="mb-1">
              <h3 className="sticky top-0 bg-white/95 px-1 py-1 text-[11px] font-medium text-zinc-400 backdrop-blur dark:bg-zinc-900/95">
                {g.name}
              </h3>
              <div className="grid grid-cols-8 gap-0.5">
                {g.items.map(([emoji, keywords]) => (
                  <button
                    key={emoji}
                    type="button"
                    title={keywords.split(' ')[0]}
                    onClick={() => onPick(emoji)}
                    className={`flex h-9 w-9 items-center justify-center rounded-md text-xl leading-none hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                      current === emoji ? 'bg-zinc-200 dark:bg-zinc-700' : ''
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
