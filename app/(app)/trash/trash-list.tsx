'use client';

import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/errors';
import { deletePagePermanently, restorePage } from '@/lib/pages';
import { unitLabel } from '@/lib/org';
import type { OrgUnitRow, Views } from '@/lib/types';

type Row = Views['v_trash']['Row'];

export function TrashList({ rows, units, meId, isAdmin }: { rows: Row[]; units: OrgUnitRow[]; meId: string; isAdmin: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const act = async (label: string, fn: () => Promise<void>) => {
    try {
      await fn();
      toast.success(label);
      router.refresh();
    } catch (e) {
      toast.error(`${label} 실패: ${errorMessage(e)}`);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8 sm:px-10">
      <h1 className="text-2xl font-semibold tracking-tight">보관함</h1>
      <p className="mt-1 text-sm text-zinc-500">보관(삭제)한 페이지입니다. 복구하면 원래 자리로 돌아가고, 영구 삭제는 되돌릴 수 없습니다.</p>
      <ul className="mt-6 divide-y divide-zinc-100 rounded-xl border border-zinc-200">
        {rows.length === 0 && <li className="px-4 py-10 text-center text-sm text-zinc-400">보관된 페이지가 없습니다</li>}
        {rows.map((r) => {
          const canDelete = isAdmin || r.created_by === meId;
          return (
            <li key={r.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className="w-5 text-center">{r.icon ?? (r.type === 'task' ? '☑' : '📄')}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{r.title}</span>
                <span className="block text-xs text-zinc-400">
                  {r.visibility === '개인' ? '개인 메모' : unitLabel(units, r.unit_id)} · 보관 {r.archived_at?.slice(0, 10)}
                  {(r.descendants ?? 0) > 0 && ` · 하위 ${r.descendants}개 포함`}
                </span>
              </span>
              <button
                type="button"
                onClick={() => void act('복구했습니다', () => restorePage(supabase, r.id!))}
                className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs hover:bg-zinc-50"
              >
                복구
              </button>
              {canDelete && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`"${r.title}" 을(를) 영구 삭제할까요? 하위 페이지·진행 기록·댓글이 모두 사라지고 되돌릴 수 없습니다.`)) {
                      void act('영구 삭제했습니다', () => deletePagePermanently(supabase, r.id!));
                    }
                  }}
                  className="rounded-md border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50"
                >
                  영구 삭제
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
