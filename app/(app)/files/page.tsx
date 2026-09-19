import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { FileDownload } from '@/components/file-download';

export const dynamic = 'force-dynamic';

function fmtBytes(n: number) {
  if (!n) return '';
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** 업로드 경로는 `<pageId>/<uuid36>-<파일명>` — 표시용 이름은 uuid 뒤부터 */
function displayName(name: string) {
  return name.length > 37 && name[36] === '-' ? name.slice(37) : name;
}

/**
 * 파일 모아보기 — 첨부 버킷 전체를 페이지별로 묶어서 보여준다.
 * 내가 볼 수 없는 페이지(RLS)의 파일은 목록에서 빠진다.
 */
export default async function FilesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: folders } = await supabase.storage.from('attachments').list('', { limit: 200 });
  const folderNames = (folders ?? []).filter((f) => !f.id).map((f) => f.name);

  const perFolder = await Promise.all(
    folderNames.map(async (folder) => {
      const { data } = await supabase.storage
        .from('attachments')
        .list(folder, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
      return { folder, files: data ?? [] };
    }),
  );

  // 페이지 제목 (RLS: 안 보이는 페이지는 빠진다 → 그 파일도 숨긴다)
  const { data: pages } = folderNames.length
    ? await supabase.from('pages').select('id, title, icon').in('id', folderNames).is('archived_at', null)
    : { data: [] as { id: string; title: string; icon: string | null }[] };
  const pageById = new Map((pages ?? []).map((p) => [p.id, p]));

  const groups = perFolder
    .filter((g) => pageById.has(g.folder) && g.files.length > 0)
    .map((g) => ({ page: pageById.get(g.folder)!, files: g.files }));
  const totalCount = groups.reduce((n, g) => n + g.files.length, 0);
  const totalBytes = groups.reduce(
    (n, g) => n + g.files.reduce((m, f) => m + (((f.metadata as Record<string, unknown>)?.size as number) ?? 0), 0),
    0,
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8 sm:px-8">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">파일 모아보기</h1>
        <span className="text-sm text-zinc-400">
          {totalCount}개 · {fmtBytes(totalBytes)} (전체 한도 1GB)
        </span>
      </div>

      {groups.length === 0 ? (
        <p className="mt-16 text-center text-sm text-zinc-400">
          아직 첨부 파일이 없습니다. 페이지 본문에서 / 를 입력해 이미지·파일 블록으로 올릴 수 있어요 (50MB 까지).
        </p>
      ) : (
        <div className="mt-6 space-y-5">
          {groups.map(({ page, files }) => (
            <section key={page.id} className="rounded-xl border border-zinc-200">
              <Link
                href={`/p/${page.id}`}
                className="flex items-center gap-2 border-b border-zinc-100 px-4 py-2.5 text-sm font-medium hover:bg-zinc-50"
              >
                <span aria-hidden="true">{page.icon ?? '📄'}</span>
                <span className="truncate">{page.title}</span>
                <span className="ml-auto text-xs font-normal text-zinc-400">{files.length}개</span>
              </Link>
              <ul className="divide-y divide-zinc-50">
                {files.map((f) => (
                  <li key={f.name} className="flex items-center gap-3 px-4 py-2 text-sm">
                    <span aria-hidden="true">📎</span>
                    <span className="min-w-0 flex-1 truncate">{displayName(f.name)}</span>
                    <span className="shrink-0 text-xs tabular-nums text-zinc-400">
                      {fmtBytes(((f.metadata as Record<string, unknown>)?.size as number) ?? 0)}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-zinc-400">{f.created_at?.slice(0, 10)}</span>
                    <FileDownload path={`${page.id}/${f.name}`}>열기</FileDownload>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
