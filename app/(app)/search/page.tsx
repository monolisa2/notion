import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { unitLabel } from '@/lib/org';
import type { OrgUnitRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

function highlight(text: string, q: string) {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-yellow-100 px-0.5">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams;
  const query = q.trim();
  const supabase = await createClient();
  const [{ data: results, error }, { data: units }] = await Promise.all([
    query ? supabase.rpc('search_pages', { p_q: query, p_limit: 50 }) : Promise.resolve({ data: [], error: null }),
    supabase.from('v_org_units').select('*'),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8 sm:px-10">
      <form action="/search" method="get" className="flex items-center gap-2">
        <input
          name="q"
          defaultValue={query}
          autoFocus
          placeholder="제목·본문에서 찾기"
          className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-base outline-none focus:border-zinc-500"
        />
        <button type="submit" className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white">검색</button>
      </form>

      {error && <p className="mt-4 text-sm text-red-600">검색 실패: {error.message}</p>}

      {query && (
        <p className="mt-4 text-xs text-zinc-400">
          &ldquo;{query}&rdquo; 결과 {results?.length ?? 0}건 · 내가 볼 수 있는 페이지만
        </p>
      )}

      <ul className="mt-3 divide-y divide-zinc-100 rounded-xl border border-zinc-200">
        {query && (results ?? []).length === 0 && !error && (
          <li className="px-4 py-10 text-center text-sm text-zinc-400">결과가 없습니다</li>
        )}
        {(results ?? []).map((r) => (
          <li key={r.id}>
            <Link href={`/p/${r.id}`} className="block px-4 py-3 hover:bg-zinc-50">
              <div className="flex items-center gap-2 text-sm">
                <span className="w-5 text-center">{r.icon ?? (r.type === 'task' ? '☑' : '📄')}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{highlight(r.title, query)}</span>
                <span className="shrink-0 text-xs text-zinc-400">
                  {r.visibility === '개인' ? '개인 메모' : unitLabel((units ?? []) as OrgUnitRow[], r.unit_id)} · {r.updated_at.slice(0, 10)}
                </span>
              </div>
              {r.snippet && (
                <p className="mt-1 line-clamp-2 pl-7 text-xs text-zinc-500">{highlight(r.snippet.replace(/\s+/g, ' ').trim(), query)}</p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
