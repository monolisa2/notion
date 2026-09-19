'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/errors';
import { DEFAULT_STATUSES, type StatusRow } from '@/lib/types';
import { BoardDragGhost, useBoardDrag } from '@/components/board-dnd';
import { useTree } from '@/components/tree-context';
import { useNewPage } from '@/components/new-page-provider';
import { statusClass } from '@/lib/status-style';
import type { PageRow, PageVisibility } from '@/lib/types';

/** 노션처럼 페이지 본문 아래에 하위 페이지를 카드로 보여준다 */
export function SubpageList({ page, statuses = DEFAULT_STATUSES }: { page: PageRow; statuses?: StatusRow[] }) {
  const { rows } = useTree();
  const { open } = useNewPage();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [view, setView] = useState<'list' | 'board'>('list');
  const children = useMemo(
    () =>
      rows
        .filter((r) => r.parent_id === page.id)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || (a.title ?? '').localeCompare(b.title ?? '', 'ko')),
    [rows, page.id],
  );

  const tasks = children.filter((c) => c.type === 'task');
  const moveStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('pages').update({ status }).eq('id', id);
    if (error) toast.error(`상태 변경 실패: ${errorMessage(error)}`);
    else router.refresh();
  };

  return (
    <section className="mx-auto w-full max-w-[900px] px-6 pb-2 sm:px-12">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium text-zinc-500">하위 페이지 {children.length > 0 && `· ${children.length}`}</h2>
        {tasks.length > 0 && (
          <div className="ml-2 flex gap-0.5 rounded-md border border-zinc-200 p-0.5">
            {(['list', 'board'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`rounded px-2 py-0.5 text-[11px] ${view === v ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-100'}`}
              >
                {v === 'list' ? '목록' : '보드'}
              </button>
            ))}
          </div>
        )}
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
      {view === 'board' && tasks.length > 0 && (
        <SubpageBoard tasks={tasks} statuses={statuses} onStatus={moveStatus} />
      )}

      {view === 'list' && children.length > 0 && (
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
                {c.status && <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] ${statusClass(c.status, statuses)}`}>{c.status}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SubpageBoard({
  tasks,
  statuses,
  onStatus,
}: {
  tasks: ReturnType<typeof useTree>['rows'];
  statuses: StatusRow[];
  onStatus: (id: string, status: string) => Promise<void>;
}) {
  const { drag, over, registerColumn, startDrag, suppressClickCapture } = useBoardDrag((id, key) => {
    const t = tasks.find((x) => x.id === id);
    if (t?.status !== key) void onStatus(id, key);
  });

  return (
    <>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {statuses.map((s) => {
          const st = s.name;
          const col = tasks.filter((t) => t.status === st);
          return (
            <div
              key={s.id}
              ref={registerColumn(st)}
              className={`w-44 shrink-0 rounded-lg border p-1.5 transition-colors ${
                over === st ? 'border-blue-400 bg-blue-50/60' : 'border-zinc-200 bg-zinc-50/60'
              }`}
            >
              <div className="flex items-center gap-1.5 px-1 py-0.5">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${statusClass(st, statuses)}`}>{st}</span>
                <span className="text-[10px] text-zinc-400">{col.length}</span>
              </div>
              <ul className="mt-1 space-y-1.5">
                {col.map((t) => (
                  <li
                    key={t.id}
                    onPointerDown={startDrag(t.id!, t.title ?? '')}
                    className={`select-none rounded-md border border-zinc-200 bg-white p-2 text-xs shadow-sm cursor-grab ${
                      drag?.id === t.id ? 'opacity-30' : ''
                    }`}
                  >
                    <Link href={`/p/${t.id}`} draggable={false} onClickCapture={suppressClickCapture} className="block hover:underline">
                      {t.icon ?? '☑'} {t.title}
                    </Link>
                    {t.due_date && <div className="mt-1 text-[10px] text-zinc-400">기한 {t.due_date}</div>}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      {drag && <BoardDragGhost drag={drag} />}
    </>
  );
}
