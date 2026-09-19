'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/errors';
import { createPage } from '@/lib/pages';
import type { PageRow } from '@/lib/types';

type Item = { text: string; assigneeId: string | null };
type Person = { id: string; name: string };

/** BlockNote 문서에서 체크 안 된 체크리스트 항목을 뽑는다 (텍스트 + 첫 멘션) */
function extractActionItems(doc: unknown): Item[] {
  const out: Item[] = [];
  const walk = (blocks: unknown) => {
    if (!Array.isArray(blocks)) return;
    for (const raw of blocks) {
      const block = raw as { type?: string; props?: Record<string, unknown>; content?: unknown; children?: unknown };
      if (block.type === 'checkListItem' && block.props?.checked !== true) {
        let text = '';
        let assigneeId: string | null = null;
        if (Array.isArray(block.content)) {
          for (const raw2 of block.content) {
            const node = raw2 as { type?: string; text?: string; props?: Record<string, unknown> };
            if (node.type === 'text' && node.text) text += node.text;
            else if (node.type === 'mention') {
              if (!assigneeId && typeof node.props?.userId === 'string') assigneeId = node.props.userId;
              if (typeof node.props?.label === 'string') text += `@${node.props.label}`;
            }
          }
        }
        text = text.trim();
        if (text) out.push({ text: text.slice(0, 80), assigneeId });
      }
      walk(block.children);
    }
  };
  walk(doc);
  return out;
}

/**
 * 회의록의 액션 아이템(체크 안 된 체크리스트)을 하위 업무로 한 번에 만든다.
 * 담당자는 항목의 첫 @멘션으로 미리 채운다.
 */
export function ActionItemPromoter({ page, meId, people }: { page: PageRow; meId: string; people: Person[] }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const found = useMemo(() => extractActionItems(page.content), [page.content]);
  const [rows, setRows] = useState<{ picked: boolean; text: string; assigneeId: string; due: string }[]>([]);

  if (found.length === 0) return null;

  const openDialog = () => {
    setRows(found.map((f) => ({ picked: true, text: f.text, assigneeId: f.assigneeId ?? '', due: '' })));
    setOpen(true);
  };

  const create = async () => {
    const targets = rows.filter((r) => r.picked && r.text.trim());
    if (targets.length === 0) return;
    setBusy(true);
    try {
      for (const r of targets) {
        const id = await createPage(supabase, {
          parentId: page.id,
          createdBy: meId,
          type: 'task',
          title: r.text.trim(),
        });
        if (r.assigneeId || r.due) {
          await supabase
            .from('pages')
            .update({ assignee_id: r.assigneeId || null, due_date: r.due || null })
            .eq('id', id);
        }
      }
      toast.success(`업무 ${targets.length}건을 만들었습니다 (하위 페이지)`);
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(`업무 만들기 실패: ${errorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mx-auto w-full max-w-[900px] px-6 pt-2 sm:px-12">
        <button
          type="button"
          onClick={openDialog}
          className="flex w-full items-center gap-2 rounded-lg border border-dashed border-blue-300 bg-blue-50/50 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50"
        >
          <span aria-hidden="true">⚡</span>
          액션 아이템 {found.length}건을 업무로 만들기
          <span className="ml-auto text-xs text-blue-400">담당자·기한 붙여서 하위 업무로</span>
        </button>
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onMouseDown={() => setOpen(false)} />
          <div className="fixed left-1/2 top-1/2 z-50 max-h-[80vh] w-[min(620px,94vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-4 shadow-xl">
            <h3 className="text-sm font-semibold">액션 아이템 → 업무</h3>
            <p className="mt-1 text-xs text-zinc-500">
              체크 안 된 액션 아이템입니다. 만들 것만 체크하고 담당자·기한을 붙이세요. 이 페이지의 하위 업무로 생성됩니다.
            </p>
            <ul className="mt-3 space-y-1.5">
              {rows.map((r, i) => (
                <li key={i} className="flex flex-wrap items-center gap-1.5 rounded-lg border border-zinc-100 px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={r.picked}
                    onChange={(e) => setRows((prev) => prev.map((x, j) => (j === i ? { ...x, picked: e.target.checked } : x)))}
                    aria-label="만들기 대상"
                  />
                  <input
                    value={r.text}
                    onChange={(e) => setRows((prev) => prev.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                    className="min-w-0 flex-1 rounded border border-transparent px-1 py-0.5 text-sm hover:border-zinc-200 focus:border-blue-400 focus:outline-none"
                    aria-label="업무 제목"
                  />
                  <select
                    value={r.assigneeId}
                    onChange={(e) => setRows((prev) => prev.map((x, j) => (j === i ? { ...x, assigneeId: e.target.value } : x)))}
                    className="rounded-md border border-zinc-200 px-1 py-0.5 text-xs outline-none"
                    aria-label="담당자"
                  >
                    <option value="">담당자</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={r.due}
                    onChange={(e) => setRows((prev) => prev.map((x, j) => (j === i ? { ...x, due: e.target.value } : x)))}
                    className="rounded-md border border-zinc-200 px-1 py-0.5 text-xs outline-none"
                    aria-label="기한"
                  />
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-zinc-200 px-3 py-1 text-xs hover:bg-zinc-50">
                취소
              </button>
              <button
                type="button"
                disabled={busy || rows.every((r) => !r.picked)}
                onClick={() => void create()}
                className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {busy ? '만드는 중…' : `업무 ${rows.filter((r) => r.picked).length}건 만들기`}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
