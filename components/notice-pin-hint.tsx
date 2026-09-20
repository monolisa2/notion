'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/errors';
import { setPinned } from '@/lib/pages';

/**
 * "공지 양식으로 썼는데 왜 공지가 아니지?" 를 없애기 위한 안내.
 *
 * 공지 **양식**(template='notice')과 공지 **고정**(pinned)은 별개다.
 * 고정해야 홈 상단에 뜨고, 읽음 현황·알림 보내기를 쓸 수 있다.
 * 고정 권한은 관리자뿐이라 (DB 트리거가 검사) 관리자에게만 버튼을 보여준다.
 */
export function NoticePinHint({ pageId, isAdmin }: { pageId: string; isAdmin: boolean }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();

  if (done) return null;

  const pin = async () => {
    setBusy(true);
    try {
      await setPinned(createClient(), pageId, true);
      setDone(true);
      toast.success('공지로 고정했습니다 — 홈 상단에 표시됩니다');
      router.refresh();
    } catch (e) {
      toast.error(`공지 고정 실패: ${errorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[900px] px-6 pt-2 sm:px-12">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50/40 px-3 py-2 text-xs text-amber-900">
        <span aria-hidden="true">📌</span>
        <span className="min-w-0 flex-1">
          아직 <b>공지로 고정</b>되지 않았습니다. 고정하면 홈 상단에 뜨고, 읽음 현황과 알림 보내기를 쓸 수 있습니다.
        </span>
        {isAdmin ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void pin()}
            className="shrink-0 rounded-md bg-amber-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-amber-700 disabled:bg-amber-300"
          >
            {busy ? '고정하는 중…' : '공지로 고정'}
          </button>
        ) : (
          <span className="shrink-0 text-amber-700/80">고정은 관리자에게 요청하세요</span>
        )}
      </div>
    </div>
  );
}
