'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/errors';
import { createClient } from '@/lib/supabase/client';
import { savePage } from '@/lib/mentions';
import { useAutosave, type SaveStatus } from '@/hooks/use-autosave';
import { setPageIcon } from '@/lib/pages';
import { IconPicker } from '@/components/icon-picker';
import { useRouter } from 'next/navigation';
import type { PageRow } from '@/lib/types';
import { stableJson } from '@/lib/history';

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
  const router = useRouter();
  const [title, setTitle] = useState(page.title);
  const [icon, setIcon] = useState<string | null>(page.icon);
  const [iconOpen, setIconOpen] = useState(false);

  const changeIcon = async (next: string | null) => {
    setIcon(next);
    setIconOpen(false);
    try {
      await setPageIcon(supabase, page.id, next);
      router.refresh();
    } catch (e) {
      toast.error(`아이콘 저장 실패: ${errorMessage(e)}`);
    }
  };
  const latest = useRef<Payload>({ title: page.title, content: page.content });
  // 내가 마지막으로 저장한 시각 — Realtime 으로 돌아온 내 저장을 "남의 수정" 으로 오해하지 않기 위해
  const savedAtRef = useRef(0);
  const [remoteEdit, setRemoteEdit] = useState<string | null>(null);

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
          savedAtRef.current = Date.now();
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

  // 다른 사람이 같은 페이지를 저장하면 알려 준다.
  // 공동 편집(CRDT)은 만들지 않기로 했으니, 조용히 덮어쓰는 것만은 막는다.
  useEffect(() => {
    const channel = supabase
      .channel(`page-edit-${page.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pages', filter: `id=eq.${page.id}` },
        (payload) => {
          const row = payload.new as { content: unknown };
          // 내 저장이 돌아온 것 / 본문이 아닌 속성 변경은 무시
          if (Date.now() - savedAtRef.current < 3000) return;
          // jsonb 는 키 순서를 바꿔서 돌려주므로 stableJson 으로 비교한다.
          // (그냥 JSON.stringify 로 비교하면 남이 상태·기한만 바꿔도 본문이 바뀐 걸로 보인다)
          if (stableJson(row.content) === stableJson(latest.current.content)) return;
          setRemoteEdit(new Date().toISOString());
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, page.id]);

  return (
    <div className="relative mx-auto w-full max-w-[900px] px-6 pb-12 pt-4 sm:px-12">
      <div
        className={[
          'pointer-events-none absolute right-6 top-2 text-xs transition-opacity sm:right-12',
          status === 'idle' ? 'opacity-0' : 'opacity-100',
          status === 'error' ? 'text-red-500' : 'text-zinc-400',
        ].join(' ')}
        aria-live="polite"
      >
        {STATUS_LABEL[status]}
      </div>

      {remoteEdit && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span className="flex-1">
            다른 분이 이 페이지를 고쳤습니다. 지금 화면은 옛 내용이라, 계속 쓰면 그분의 수정이 덮어써질 수 있습니다.
          </span>
          <button
            type="button"
            onClick={() => {
              void flush();
              window.location.reload();
            }}
            className="shrink-0 rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700"
          >
            최신 내용 불러오기
          </button>
          <button
            type="button"
            onClick={() => setRemoteEdit(null)}
            className="shrink-0 rounded-md px-2 py-1 text-xs text-amber-800 hover:bg-amber-100"
          >
            나중에
          </button>
        </div>
      )}

      {/* 페이지 아이콘 (노션처럼 제목 위) — 없을 때는 자리를 줄인다 */}
      <div className={`group relative ${icon ? 'mb-2 h-14' : 'h-7'}`}>
        <button
          type="button"
          onClick={() => setIconOpen((v) => !v)}
          aria-label="페이지 아이콘"
          className={[
            icon
              ? 'flex h-14 w-14 items-center justify-center rounded-lg text-[44px] leading-none hover:bg-zinc-100'
              : 'invisible rounded px-1.5 py-0.5 text-xs text-zinc-400 hover:bg-zinc-100 group-hover:visible',
          ].join(' ')}
        >
          {icon ?? <span className="text-xs">아이콘 추가</span>}
        </button>
        {iconOpen && (
          <IconPicker
            current={icon}
            onPick={(e) => void changeIcon(e)}
            onClear={() => void changeIcon(null)}
            onClose={() => setIconOpen(false)}
          />
        )}
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
        className="w-full bg-transparent text-[40px] font-bold leading-tight tracking-tight text-zinc-900 outline-none placeholder:text-zinc-300"
      />

      <div className="mt-3 -mx-12">
        <BlockNoteEditor initialContent={page.content} meId={userId} pageId={page.id} onChange={onContentChange} />
      </div>
    </div>
  );
}
