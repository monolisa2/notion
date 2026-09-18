import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function Home() {
  const supabase = await createClient();
  const { data: recent } = await supabase
    .from('pages')
    .select('id, title, type, status, updated_at')
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
    .limit(10);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12 sm:px-10">
      <h1 className="text-2xl font-semibold tracking-tight">TeamHub</h1>
      <p className="mt-2 text-sm text-zinc-500">
        왼쪽 사이드바에서 페이지를 고르거나 &ldquo;새 페이지&rdquo;를 만들어 시작하세요.
        항목을 우클릭하면 하위 페이지 추가 · 업무 전환 · 이름 변경 · 보관을 할 수 있고,
        드래그해서 위치를 옮길 수 있습니다.
      </p>

      <h2 className="mt-10 text-sm font-medium text-zinc-500">최근 수정</h2>
      <ul className="mt-3 divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {(recent ?? []).length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-zinc-400">아직 페이지가 없습니다.</li>
        )}
        {(recent ?? []).map((p) => (
          <li key={p.id}>
            <Link
              href={`/p/${p.id}`}
              className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              <span aria-hidden="true">{p.type === 'task' ? '☑' : '📄'}</span>
              <span className="min-w-0 flex-1 truncate">{p.title}</span>
              {p.status && (
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {p.status}
                </span>
              )}
              <span className="text-xs text-zinc-400">{p.updated_at.slice(0, 10)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
