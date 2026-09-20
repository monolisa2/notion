'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { PageTreeRow, SidebarPageLite } from '@/lib/types';

type Item = {
  id: string;
  title: string;
  icon: string | null;
  type: string | null;
  /** 오른쪽에 붙는 설명 (즐겨찾기 / 최근 / 본문에서 찾음) */
  hint: string;
};

const ICON = (i: Item) => i.icon ?? (i.type === 'task' ? '☑' : '📄');

function toItem(p: SidebarPageLite, hint: string): Item {
  return { id: p.id, title: p.title, icon: p.icon, type: p.type, hint };
}

/**
 * 빠른 이동 (⌘K / Ctrl+K).
 *
 * 제목 검색은 이미 받아 둔 사이드바 트리에서 즉시 — 타자를 치는 동안 왕복이 없다.
 * 본문 검색은 search_pages RPC 로 250ms 늦춰서 덧붙인다.
 */
export function QuickSwitcher({
  rows,
  favorites,
  recents,
}: {
  rows: PageTreeRow[];
  favorites: SidebarPageLite[];
  recents: SidebarPageLite[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);
  // 검색어와 결과를 같이 들고 있다가, 지금 검색어와 맞을 때만 쓴다
  // (검색어가 바뀐 순간 옛 결과가 잠깐 비치는 것을 막는다)
  const [bodyRes, setBodyRes] = useState<{ q: string; items: Item[] }>({ q: '', items: [] });
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K 로 열고 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setQ('');
    setBodyRes({ q: '', items: [] });
    setCursor(0);
  }, []);

  // 제목 검색 — 트리에서 바로 (공백으로 나눠 모두 포함하는 제목)
  const titleHits = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];
    const out: Item[] = [];
    for (const r of rows) {
      if (!r.id || !r.title) continue;
      const t = r.title.toLowerCase();
      if (words.every((w) => t.includes(w))) {
        out.push({ id: r.id, title: r.title, icon: r.icon, type: r.type, hint: '' });
      }
      if (out.length >= 10) break;
    }
    return out;
  }, [q, rows]);

  // 본문 검색 — 조금 늦춰서
  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) return;
    let alive = true;
    const timer = setTimeout(() => {
      supabase.rpc('search_pages', { p_q: query, p_limit: 10 }).then(({ data }) => {
        if (!alive) return;
        setBodyRes({
          q: query,
          items: (data ?? []).map((r) => ({
            id: r.id,
            title: r.title,
            icon: r.icon,
            type: r.type,
            hint: '본문',
          })),
        });
      });
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [q, supabase]);

  const bodyHits = useMemo(
    () => (bodyRes.q === q.trim() ? bodyRes.items : []),
    [bodyRes, q],
  );

  const items = useMemo(() => {
    if (!q.trim()) {
      return [
        ...favorites.slice(0, 5).map((p) => toItem(p, '즐겨찾기')),
        ...recents.slice(0, 8).map((p) => toItem(p, '최근')),
      ].filter((p, i, all) => all.findIndex((x) => x.id === p.id) === i);
    }
    const seen = new Set(titleHits.map((t) => t.id));
    return [...titleHits, ...bodyHits.filter((b) => !seen.has(b.id))].slice(0, 15);
  }, [q, favorites, recents, titleHits, bodyHits]);

  // 목록이 바뀌면 선택 위치를 범위 안으로
  const safeCursor = items.length === 0 ? 0 : Math.min(cursor, items.length - 1);

  const go = useCallback(
    (item: Item | undefined) => {
      if (!item) return;
      close();
      router.push(`/p/${item.id}`);
    },
    [close, router],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/25 px-4 pt-[12vh]" onMouseDown={close}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-zinc-100 px-3 dark:border-zinc-800">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-zinc-400" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={inputRef}
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setCursor(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') close();
              else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setCursor((c) => (items.length === 0 ? 0 : (Math.min(c, items.length - 1) + 1) % items.length));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setCursor((c) => (items.length === 0 ? 0 : (Math.min(c, items.length - 1) - 1 + items.length) % items.length));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                go(items[safeCursor]);
              }
            }}
            placeholder="페이지 이름으로 바로 가기"
            aria-label="빠른 이동"
            className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-zinc-400"
          />
          <kbd className="shrink-0 rounded border border-zinc-200 px-1.5 py-0.5 text-[10px] text-zinc-400 dark:border-zinc-700">esc</kbd>
        </div>

        <ul className="max-h-80 overflow-y-auto p-1">
          {items.length === 0 && (
            <li className="px-3 py-8 text-center text-sm text-zinc-400">
              {q.trim() ? '찾는 페이지가 없습니다' : '최근 본 페이지가 없습니다'}
            </li>
          )}
          {items.map((item, i) => (
            <li key={item.id}>
              <button
                type="button"
                onMouseEnter={() => setCursor(i)}
                onClick={() => go(item)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm ${
                  i === safeCursor ? 'bg-zinc-100 dark:bg-zinc-800' : ''
                }`}
              >
                <span className="w-5 shrink-0 text-center">{ICON(item)}</span>
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
                {item.hint && <span className="shrink-0 text-[11px] text-zinc-400">{item.hint}</span>}
              </button>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3 border-t border-zinc-100 px-3 py-1.5 text-[11px] text-zinc-400 dark:border-zinc-800">
          <span>↑↓ 이동</span>
          <span>⏎ 열기</span>
          <span className="ml-auto">본문까지 찾으려면 두 글자 이상</span>
        </div>
      </div>
    </div>
  );
}
