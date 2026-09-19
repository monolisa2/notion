'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/errors';
import { colorClass, STATUS_COLOR_KEYS } from '@/lib/status-style';
import type { StatusKind, StatusRow } from '@/lib/types';

const KINDS: { value: StatusKind; hint: string }[] = [
  { value: '대기', hint: '아직 시작 전 (진행 중으로 집계)' },
  { value: '진행', hint: '하는 중 (진행 중으로 집계)' },
  { value: '완료', hint: '끝남 — 이 상태가 되면 진행률 100% 처리' },
  { value: '보류', hint: '멈춰 둠' },
  { value: '드롭', hint: '하지 않기로 함' },
];

function friendly(e: unknown) {
  const msg = errorMessage(e);
  if (msg.includes('violates foreign key')) return '이 상태를 쓰는 업무가 있어 삭제할 수 없습니다. 먼저 업무들의 상태를 바꿔주세요';
  if (msg.includes('row-level security')) return '상태 편집 권한이 없습니다 (관리자·팀장·실장·본부장만)';
  if (msg.includes('duplicate key')) return '같은 이름의 상태가 이미 있습니다';
  return msg;
}

/**
 * 칸반 상태(구분값) 관리 — 본부 공통.
 * 편집 권한은 RLS(관리자 + 팀장·실장·본부장)가 최종 결정한다.
 */
export function StatusManager({ statuses }: { statuses: StatusRow[] }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState<StatusKind>('진행');
  const [newColor, setNewColor] = useState('cyan');

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      toast.error(`${label} 실패: ${friendly(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const rename = (row: StatusRow, name: string) => {
    const next = name.trim();
    if (!next || next === row.name) return;
    void run('이름 변경', async () => {
      const { error } = await supabase.from('page_statuses').update({ name: next }).eq('id', row.id);
      if (error) throw error;
    });
  };
  const setField = (row: StatusRow, patch: { kind?: string; color?: string }) =>
    void run('변경', async () => {
      const { error } = await supabase.from('page_statuses').update(patch).eq('id', row.id);
      if (error) throw error;
    });
  const move = (idx: number, dir: -1 | 1) => {
    const other = statuses[idx + dir];
    const cur = statuses[idx];
    if (!other || !cur) return;
    void run('순서 변경', async () => {
      // 두 항목의 순서를 맞바꾼다
      const { error: e1 } = await supabase.from('page_statuses').update({ sort_order: other.sort_order }).eq('id', cur.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('page_statuses').update({ sort_order: cur.sort_order }).eq('id', other.id);
      if (e2) throw e2;
    });
  };
  const remove = (row: StatusRow) => {
    if (!window.confirm(`상태 "${row.name}" 을 삭제할까요? 이 상태를 쓰는 업무가 있으면 삭제되지 않습니다.`)) return;
    void run('삭제', async () => {
      const { error } = await supabase.from('page_statuses').delete().eq('id', row.id);
      if (error) throw error;
      toast.success('삭제했습니다');
    });
  };
  const add = () => {
    const name = newName.trim();
    if (!name) return;
    void run('추가', async () => {
      const maxOrder = Math.max(0, ...statuses.map((s) => s.sort_order));
      const { error } = await supabase
        .from('page_statuses')
        .insert({ name, kind: newKind, color: newColor, sort_order: maxOrder + 100 });
      if (error) throw error;
      setNewName('');
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600 outline-none hover:bg-zinc-50"
        title="칸반 상태(구분값)를 본부 공통으로 편집"
      >
        ⚙️ 상태 관리
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30 bg-black/30" onMouseDown={() => setOpen(false)} />
          <div className="fixed left-1/2 top-1/2 z-40 max-h-[80vh] w-[min(560px,94vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-4 shadow-xl">
            <div className="flex items-center">
              <h3 className="text-sm font-semibold">업무 상태 관리 (본부 공통)</h3>
              <button type="button" onClick={() => setOpen(false)} className="ml-auto rounded px-2 text-zinc-400 hover:bg-zinc-100" aria-label="닫기">
                ✕
              </button>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              이름·색·순서를 바꾸면 칸반 열과 모든 업무에 바로 반영됩니다. &ldquo;의미&rdquo;는 대시보드 집계와
              완료 처리 기준이라 이름과 별개로 정해 주세요.
            </p>

            <ul className="mt-3 space-y-1.5">
              {statuses.map((row, i) => (
                <li key={row.id} className="flex items-center gap-1.5 rounded-lg border border-zinc-100 px-2 py-1.5">
                  <span className={`h-4 w-4 shrink-0 rounded ${colorClass(row.color)}`} aria-hidden="true" />
                  <input
                    defaultValue={row.name}
                    disabled={busy}
                    onBlur={(e) => rename(row, e.target.value)}
                    className="w-24 min-w-0 rounded border border-transparent px-1 py-0.5 text-sm hover:border-zinc-200 focus:border-blue-400 focus:outline-none"
                    aria-label="상태 이름"
                  />
                  <select
                    value={row.color}
                    disabled={busy}
                    onChange={(e) => setField(row, { color: e.target.value })}
                    className="rounded-md border border-zinc-200 px-1 py-0.5 text-xs outline-none"
                    aria-label="색"
                  >
                    {STATUS_COLOR_KEYS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <select
                    value={row.kind}
                    disabled={busy}
                    onChange={(e) => setField(row, { kind: e.target.value })}
                    className="rounded-md border border-zinc-200 px-1 py-0.5 text-xs outline-none"
                    aria-label="의미"
                    title={KINDS.find((k) => k.value === row.kind)?.hint}
                  >
                    {KINDS.map((k) => (
                      <option key={k.value} value={k.value} title={k.hint}>
                        의미: {k.value}
                      </option>
                    ))}
                  </select>
                  <span className="ml-auto flex items-center gap-0.5">
                    <button type="button" disabled={busy || i === 0} onClick={() => move(i, -1)} className="rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100 disabled:opacity-30" aria-label="위로">
                      ▲
                    </button>
                    <button type="button" disabled={busy || i === statuses.length - 1} onClick={() => move(i, 1)} className="rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100 disabled:opacity-30" aria-label="아래로">
                      ▼
                    </button>
                    <button type="button" disabled={busy} onClick={() => remove(row)} className="rounded px-1.5 py-0.5 text-xs text-red-500 hover:bg-red-50" aria-label="삭제">
                      삭제
                    </button>
                  </span>
                </li>
              ))}
            </ul>

            <form
              className="mt-3 flex items-center gap-1.5 rounded-lg border border-dashed border-zinc-300 px-2 py-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                add();
              }}
            >
              <span className={`h-4 w-4 shrink-0 rounded ${colorClass(newColor)}`} aria-hidden="true" />
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="새 상태 이름"
                className="w-28 min-w-0 rounded border border-zinc-200 px-1.5 py-0.5 text-sm outline-none focus:border-blue-400"
              />
              <select value={newColor} onChange={(e) => setNewColor(e.target.value)} className="rounded-md border border-zinc-200 px-1 py-0.5 text-xs outline-none" aria-label="색">
                {STATUS_COLOR_KEYS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select value={newKind} onChange={(e) => setNewKind(e.target.value as StatusKind)} className="rounded-md border border-zinc-200 px-1 py-0.5 text-xs outline-none" aria-label="의미">
                {KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    의미: {k.value}
                  </option>
                ))}
              </select>
              <button type="submit" disabled={busy || !newName.trim()} className="ml-auto rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-40">
                추가
              </button>
            </form>
          </div>
        </>
      )}
    </>
  );
}
