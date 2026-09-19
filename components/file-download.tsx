'use client';

import { useMemo } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/errors';

/** 비공개 버킷 파일: 클릭 시 1시간짜리 서명 URL 을 만들어 연다 */
export function FileDownload({ path, children }: { path: string; children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  return (
    <button
      type="button"
      onClick={async () => {
        const { data, error } = await supabase.storage.from('attachments').createSignedUrl(path, 3600);
        if (error || !data?.signedUrl) {
          toast.error(`파일 열기 실패: ${error ? errorMessage(error) : '주소 생성 실패'}`);
          return;
        }
        window.open(data.signedUrl, '_blank', 'noopener');
      }}
      className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
    >
      {children}
    </button>
  );
}
