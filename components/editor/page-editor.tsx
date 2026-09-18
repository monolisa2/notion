'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/errors';
import { createClient } from '@/lib/supabase/client';
import { savePage } from '@/lib/mentions';
import { useAutosave, type SaveStatus } from '@/hooks/use-autosave';
import type { PageRow } from '@/lib/types';

// BlockNote 는 브라우저 전용 (window 사용) → SSR 끔
const BlockNoteEditor = dynamic(() => import('./blocknote-editor'), {
  ssr: false,
  loading: () => <div className="h-40 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-900" />,
});

type Payload = { title: string; content: unknown };

const STATUS_LABEL: Record<SaveStatus, string> = {
  idle: '',
  dirty: '변경됨',
  saving: '저장 중…',
  saved: '저장됨',
  error: '저장 실패',
};

export function PageEditor({ page, userId }: { page: PageRow; userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [title, setTitle] = useState(page.title);
  const latest = useRef<Payload>({ title: page.title, content: page.content });

  const { status, schedule, flush } = useAutosave<Payload>(
    useCallback(
      async (payload) => {
        try {
          // 저장은 반드시 savePage 를 통해서 (멘션 diff 동기화가 묶여 있다)
          await savePage(supabase, {
            pageId: page.id,
            authorId: userId,
            title: payload.title,
            content: payload.content,
          });
        } catch (e) {
          const msg = errorMessage(e);
          toast.error(`저장 실패: ${msg}`);
          throw e;
        }
      },
      [supabase, page.id, userId],
    ),
    700,
  );

  const onTitleChange = (value: string) => {
    setTitle(value);
    latest.current = { ...latest.current, title: value };
    schedule(latest.current);
  };

  const onContentChange = useCallback(
    (doc: unknown) => {
      latest.current = { ...latest.current, content: doc };
      schedule(latest.current);
    },
    [schedule],
  );

  // 탭을 닫거나 새로고침하면 대기 중인 변경을 즉시 저장 시도
  useEffect(() => {
    const onBeforeUnload = () => void flush();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [flush]);

  return (
    <div className="relative mx-auto w-full max-w-3xl px-6 pb-32 pt-10 sm:px-10">
      <div
        className={[
          'pointer-events-none absolute right-6 top-3 text-xs transition-opacity sm:right-10',
          status === 'idle' ? 'opacity-0' : 'opacity-100',
          status === 'error' ? 'text-red-500' : 'text-zinc-400',
        ].join(' ')}
        aria-live="polite"
      >
        {STATUS_LABEL[status]}
      </div>

      {/* 제목은 본문 첫 블록과 섞지 않고 별도 input */}
      <input
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.preventDefault();
        }}
        placeholder="제목 없음"
        aria-label="페이지 제목"
        className="w-full bg-transparent text-3xl font-bold tracking-tight outline-none placeholder:text-zinc-300 dark:placeholder:text-zinc-700"
      />

      <div className="mt-4 -mx-12">
        <BlockNoteEditor initialContent={page.content} onChange={onContentChange} />
      </div>
    </div>
  );
}
