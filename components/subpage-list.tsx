'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useTree } from '@/components/tree-context';
import { useNewPage } from '@/components/new-page-provider';
import { statusClass } from '@/lib/status-style';
import type { PageRow, PageVisibility } from '@/lib/types';

/** 노션처럼 페이지 본문 아래에 하위 페이지를 카드로 보여준다 */
export function SubpageList({ page }: { page: PageRow }) {
  const { rows } = useTree();
  const { open } = useNewPage();
  const children = useMemo(
    () =>
      rows
        .filter((r) => r.parent_id === page.id)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || (a.title ?? '').localeCompare(b.title ?? '', 'ko')),
    [rows, page.id],
  );

  return (
    <section className="mx-auto w-full max-w-[900px] px-6 pb-8 sm:px-12">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium text-zinc-500">하위 페이지 {children.length > 0 && `· ${children.length}`}</h2>
        <button
          type="button"
          onClick={() =>
            open({
              parentId: page.id,
              unitId: page.unit_id,
              visibility: page.visibility as PageVisibility,
              label: `${page.title} 의 하위 페이지`,
            })
          }
          className="ml-auto rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
        >
          ＋ 하위 페이지
        </button>
      </div>
      {children.length > 0 && (
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {children.map((c) => (
            <li key={c.id}>
              <Link
                href={`/p/${c.id}`}
                className="flex items-center gap-3 rounded-xl border border-zinc-200 px-3 py-2.5 text-sm hover:border-zinc-300 hover:bg-zinc-50"
              >
                <span className="w-6 text-center text-lg leading-none">{c.icon ?? (c.type === 'task' ? '☑' : '📄')}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{c.title}</span>
                  <span className="block text-[11px] text-zinc-400">
                    {c.event_date ?? c.due_date ?? c.updated_at?.slice(0, 10)}
                  </span>
                </span>
                {c.status && <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] ${statusClass(c.status)}`}>{c.status}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
