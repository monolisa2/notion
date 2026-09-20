'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/errors';
import { createPage } from '@/lib/pages';
import { TEMPLATES, todayStr } from '@/lib/templates';
import type { PageVisibility } from '@/lib/types';

/**
 * 공지 화면에서 바로 공지 쓰기.
 *
 * 전에는 "공간에서 페이지 만들기 → 공지 양식 고르기 → ⋯ 메뉴에서 공지로 고정" 이었다.
 * 공지를 쓰려는 사람이 공간·양식·고정을 각각 알아야 할 이유가 없다.
 *
 * 관리자면 처음부터 고정된 상태(pinned)로 만든다. 관리자가 아니면 DB 가 막으므로
 * (0021 INSERT 트리거) 고정 없이 만들고, 페이지에서 "관리자에게 요청" 안내가 뜬다.
 */
export function NewNoticeButton({
  isAdmin,
  rootUnitId,
  myUnitId,
  myUnitName,
  authorName,
}: {
  isAdmin: boolean;
  rootUnitId: string | null;
  myUnitId: string | null;
  myUnitName: string;
  authorName: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  // 기본은 본부 전체 — 공지는 대개 전원 대상이다
  const [scope, setScope] = useState<'본부' | '소속'>('본부');

  const canTeamScope = !!myUnitId && myUnitId !== rootUnitId;
  const unitId = scope === '소속' ? myUnitId : rootUnitId;

  const write = async () => {
    if (!unitId) {
      toast.error('공간이 지정되지 않아 공지를 만들 수 없습니다. 관리자에게 문의하세요.');
      return;
    }
    setBusy(true);
    try {
      const today = todayStr();
      const tpl = TEMPLATES.find((t) => t.key === 'notice')!;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요합니다');

      // 양식의 "대상" 줄을 실제 범위로 바꿔 둔다 (팀 공지인데 "본부 전체" 로 남으면 잘못된 정보)
      const content = tpl.content({ author: authorName, today }) as {
        content?: { text?: string }[];
      }[];
      const audience = scope === '본부' ? '경영관리본부 전체' : myUnitName;
      const target = content.find((b) => b.content?.[0]?.text?.startsWith('대상'));
      if (target?.content?.[1]) target.content[1].text = audience;

      const id = await createPage(supabase, {
        parentId: null,
        createdBy: user.id,
        type: 'doc',
        title: tpl.title(today),
        icon: tpl.icon,
        template: 'notice',
        unitId,
        visibility: scope as PageVisibility,
        eventDate: today,
        content,
        pinned: isAdmin,
      });
      toast.success(isAdmin ? '공지를 만들었습니다 (게시 중)' : '공지 초안을 만들었습니다 — 고정은 관리자에게 요청하세요');
      router.push(`/p/${id}`);
    } catch (e) {
      toast.error(`공지 만들기 실패: ${errorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      {canTeamScope && (
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value as '본부' | '소속')}
          aria-label="공지 범위"
          className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs outline-none dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="본부">본부 전체</option>
          <option value="소속">{myUnitName}</option>
        </select>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => void write()}
        className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {busy ? '만드는 중…' : '＋ 공지 쓰기'}
      </button>
    </div>
  );
}
