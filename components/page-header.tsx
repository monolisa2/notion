'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/errors';
import { setPageSpace } from '@/lib/pages';
import type { OrgUnitRow, PageRow, PageVisibility } from '@/lib/types';

const VIS_LABEL: Record<PageVisibility, string> = {
  본부: '본부 전체 공개',
  소속: '소속 조직만',
  개인: '나만 봄',
};

/**
 * 페이지 상단 메타: 유형 · 공간 · 공개 범위.
 * 루트 페이지만 공간/공개 범위를 바꿀 수 있고, 하위 페이지는 상속 표시만 한다.
 */
export function PageHeader({ page, units }: { page: PageRow; units: OrgUnitRow[] }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const isRoot = page.parent_id === null;
  const isPersonal = page.visibility === '개인';
  const unit = units.find((u) => u.id === page.unit_id);
  const isTask = page.type === 'task';

  const apply = async (patch: { unitId?: string | null; visibility?: PageVisibility }) => {
    setBusy(true);
    try {
      await setPageSpace(supabase, page.id, patch);
      router.refresh();
    } catch (e) {
      toast.error(`변경 실패: ${errorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const chip = 'rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800';
  const sel = 'rounded border border-zinc-200 bg-transparent px-1.5 py-0.5 text-xs outline-none dark:border-zinc-700';

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-2 px-6 pt-6 text-xs text-zinc-400 sm:px-10">
      <span className={chip}>{isTask ? '업무' : '문서'}</span>

      {isPersonal ? (
        <span className={chip}>🔒 개인 메모</span>
      ) : isRoot ? (
        <>
          <select
            value={page.unit_id ?? ''}
            disabled={busy}
            onChange={(e) => void apply({ unitId: e.target.value || null })}
            className={sel}
            aria-label="공간"
          >
            {units.map((u) => (
              <option key={u.id} value={u.id ?? ''}>
                {u.name}
              </option>
            ))}
          </select>
          <select
            value={page.visibility}
            disabled={busy}
            onChange={(e) => void apply({ visibility: e.target.value as PageVisibility })}
            className={sel}
            aria-label="공개 범위"
          >
            <option value="본부">{VIS_LABEL.본부}</option>
            <option value="소속">{VIS_LABEL.소속}</option>
          </select>
        </>
      ) : (
        <span className={chip} title="상위 페이지의 공간·공개 범위를 따릅니다">
          {unit?.name ?? '공간 미지정'} · {VIS_LABEL[page.visibility as PageVisibility] ?? page.visibility}
        </span>
      )}

      <span className="ml-auto">수정 {page.updated_at.slice(0, 10)}</span>
    </div>
  );
}
