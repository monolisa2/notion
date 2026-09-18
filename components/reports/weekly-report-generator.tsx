'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/errors';
import { createPage } from '@/lib/pages';
import { savePage } from '@/lib/mentions';
import type { Me } from '@/lib/types';
import type { SilentRow } from '@/lib/prompts/weekly-report';

// 마크다운 → BlockNote 블록 변환은 브라우저의 에디터 인스턴스가 한다 (SSR 끔)
const MarkdownToBlocks = dynamic(() => import('./markdown-to-blocks'), { ssr: false });

type Phase = 'idle' | 'streaming' | 'done' | 'saving';

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function WeeklyReportGenerator({ me, silent }: { me: Me; silent: SilentRow[] }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [days, setDays] = useState(7);
  const [phase, setPhase] = useState<Phase>('idle');
  const [markdown, setMarkdown] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const convertRef = useRef<((md: string) => unknown) | null>(null);

  const generate = async () => {
    setMarkdown('');
    setPhase('streaming');
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch('/api/weekly-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMarkdown(acc);
      }
      setPhase('done');
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        setPhase('idle');
        return;
      }
      toast.error(`생성 실패: ${errorMessage(e)}`);
      setPhase('idle');
    }
  };

  const saveAsPage = async () => {
    if (!convertRef.current) {
      toast.error('변환기가 아직 준비되지 않았습니다. 잠시 후 다시 시도하세요.');
      return;
    }
    setPhase('saving');
    try {
      const blocks = convertRef.current(markdown);
      const title = `주간보고 ${today()}`;
      const id = await createPage(supabase, { parentId: null, createdBy: me.id, type: 'doc', title });
      // 저장은 반드시 savePage (멘션 동기화 포함). 보고서에 멘션은 없지만 경로를 통일한다.
      await savePage(supabase, { pageId: id, authorId: me.id, title, content: blocks });
      toast.success('주간보고 페이지를 만들었습니다. 바로 수정할 수 있어요.');
      router.push(`/p/${id}`);
    } catch (e) {
      toast.error(`저장 실패: ${errorMessage(e)}`);
      setPhase('done');
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8 sm:px-10">
      <h1 className="text-2xl font-semibold tracking-tight">주간보고 초안</h1>
      <p className="mt-1 text-sm text-zinc-500">
        진행 로그(page_updates)를 재료로 초안을 만들고, 문서 페이지로 저장해 바로 고쳐 쓸 수 있습니다.
      </p>

      {/* 미입력자 — 생성 전에도 바로 보이게 */}
      <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
        <h2 className="text-sm font-medium text-amber-900 dark:text-amber-200">
          미입력자 {silent.length > 0 ? `${silent.length}명` : '없음'}
          <span className="ml-2 font-normal text-amber-700/80 dark:text-amber-300/80">
            (진행 중 업무가 있는데 최근 {days}일 로그 0건)
          </span>
        </h2>
        {silent.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2 text-sm">
            {silent.map((s) => (
              <li key={s.profile_id} className="rounded-full bg-white px-2.5 py-0.5 text-amber-900 shadow-sm dark:bg-zinc-900 dark:text-amber-200">
                {s.name} · {s.open_tasks}건
                <span className="ml-1 text-xs text-zinc-400">
                  {s.last_log_at ? `마지막 ${s.last_log_at.slice(0, 10)}` : '기록 없음'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-zinc-500">기간</span>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            disabled={phase === 'streaming' || phase === 'saving'}
            className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value={7}>최근 7일</option>
            <option value={14}>최근 14일</option>
            <option value={30}>최근 30일</option>
          </select>
        </label>

        {phase === 'streaming' ? (
          <button
            type="button"
            onClick={() => abortRef.current?.abort()}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            중단
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void generate()}
            disabled={phase === 'saving'}
            className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {phase === 'done' ? '다시 생성' : '초안 생성'}
          </button>
        )}

        {phase === 'done' && (
          <button
            type="button"
            onClick={() => void saveAsPage()}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            페이지로 저장하고 편집
          </button>
        )}
        {phase === 'saving' && <span className="text-sm text-zinc-500">저장 중…</span>}
      </div>

      {(markdown || phase === 'streaming') && (
        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-2 flex items-center gap-2 text-xs text-zinc-400">
            <span>{phase === 'streaming' ? '생성 중…' : '초안 (마크다운 미리보기)'}</span>
            {phase === 'streaming' && <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" />}
          </div>
          <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6">{markdown}</pre>
        </div>
      )}

      {/* 숨은 변환기: 마크다운 → BlockNote 블록 */}
      <MarkdownToBlocks onReady={(fn) => (convertRef.current = fn)} />
    </div>
  );
}
