'use client';

import { useEffect } from 'react';
import { NEW_PAGE_TEMPLATES, type Template } from '@/lib/templates';

export function NewPageDialog({
  spaceLabel,
  onPick,
  onClose,
}: {
  spaceLabel: string;
  onPick: (t: Template) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">새 페이지</h2>
          <span className="text-xs text-zinc-400">{spaceLabel}</span>
        </div>
        <p className="mt-1 text-xs text-zinc-500">양식을 고르면 틀이 채워진 페이지가 바로 열립니다. 내용은 자유롭게 고쳐 쓰세요.</p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {NEW_PAGE_TEMPLATES.map((t) => (
            <li key={t.key}>
              <button
                type="button"
                onClick={() => onPick(t)}
                className="flex w-full items-start gap-3 rounded-xl border border-zinc-200 px-3 py-3 text-left hover:border-zinc-400 hover:bg-zinc-50"
              >
                <span className="text-2xl leading-none">{t.icon}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{t.name}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-zinc-500">{t.description}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
