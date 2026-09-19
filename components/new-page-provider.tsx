'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/errors';
import { createPage } from '@/lib/pages';
import { todayStr, type Template } from '@/lib/templates';
import type { Me, PageVisibility } from '@/lib/types';
import { NewPageDialog } from '@/components/new-page-dialog';

export type NewPageTarget = {
  parentId: string | null;
  unitId: string | null;
  visibility: PageVisibility;
  label: string;
};

const Ctx = createContext<{ open: (t: NewPageTarget) => void }>({ open: () => {} });
export const useNewPage = () => useContext(Ctx);

/** 어디서든 "새 페이지(양식 선택)" 를 띄운다. 사이드바 ＋, 우클릭 메뉴, 하위 페이지 목록에서 공용 */
export function NewPageProvider({
  me,
  onCreated,
  children,
}: {
  me: Me;
  onCreated?: () => Promise<void> | void;
  children: React.ReactNode;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [target, setTarget] = useState<NewPageTarget | null>(null);

  const open = useCallback((t: NewPageTarget) => setTarget(t), []);

  const pick = async (t: Template) => {
    const tgt = target;
    setTarget(null);
    if (!tgt) return;
    try {
      const today = todayStr();
      const id = await createPage(supabase, {
        parentId: tgt.parentId,
        createdBy: me.id,
        unitId: tgt.unitId,
        visibility: tgt.visibility,
        type: t.type,
        title: t.title(today),
        icon: t.key === 'blank' ? null : t.icon,
        content: t.content({ author: me.name, today }),
        template: t.key,
        eventDate: t.key === 'meeting' || t.key === 'weekly' || t.key === 'notice' ? today : null,
      });
      await onCreated?.();
      router.push(`/p/${id}`);
    } catch (e) {
      const msg = errorMessage(e);
      toast.error(
        msg.includes('row-level security')
          ? '페이지 추가 실패: 이 공간에 페이지를 만들 권한이 없습니다 (관리자가 작성 권한을 제한한 공간)'
          : `페이지 추가 실패: ${msg}`,
      );
    }
  };

  return (
    <Ctx.Provider value={{ open }}>
      {children}
      {target && <NewPageDialog spaceLabel={target.label} onPick={(t) => void pick(t)} onClose={() => setTarget(null)} />}
    </Ctx.Provider>
  );
}
