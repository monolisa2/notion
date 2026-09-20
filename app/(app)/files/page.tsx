import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, getSessionUser } from '@/lib/supabase/server';
import { FileDownload } from '@/components/file-download';

export const dynamic = 'force-dynamic';

function fmtBytes(n: number) {
  if (!n) return '0 KB';
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** Supabase 무료 플랜 스토리지 한도 */
const STORAGE_LIMIT = 1024 * 1024 * 1024;

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
  const user = await getSessionUser(supabase);
  if (!user) redirect('/login');

  // 버킷 전체 용량 (내가 볼 수 없는 페이지의 파일까지 포함한 진짜 합계)
  const usagePromise = supabase.rpc('storage_usage_bytes').then((r) => Number(r.data ?? 0));

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
  // 용량 큰 파일 — 공간을 줄여야 할 때 제일 먼저 볼 목록
  const biggest = groups
    .flatMap(({ page, files }) =>
      files.map((f) => ({
        page,
        name: f.name,
        size: ((f.metadata as Record<string, unknown>)?.size as number) ?? 0,
      })),
    )
    .sort((a, b) => b.size - a.size)
    .slice(0, 10);

  const usedBytes = Math.max(await usagePromise, totalBytes);
  const usedPct = Math.min(100, Math.round((usedBytes / STORAGE_LIMIT) * 100));
  const tone = usedPct >= 90 ? 'bg-red-500' : usedPct >= 70 ? 'bg-amber-500' : 'bg-blue-500';

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8 sm:px-8">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">파일 모아보기</h1>
        <span className="text-sm text-zinc-400">내가 볼 수 있는 파일 {totalCount}개</span>
      </div>

      {/* 남은 용량 — 꽉 차면 업로드가 그냥 실패하므로 미리 보이게 */}
      <section className="mt-4 rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex flex-wrap items-baseline gap-2 text-sm">
          <span className="font-medium">저장 공간</span>
          <span className="tabular-nums text-zinc-600 dark:text-zinc-300">
            {fmtBytes(usedBytes)} / 1 GB
          </span>
          <span className="tabular-nums text-zinc-400">({usedPct}%)</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-200/80 dark:bg-zinc-800">
          <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(1, usedPct)}%` }} />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-zinc-400">
          {usedPct >= 90
            ? '거의 다 찼습니다. 큰 파일은 지우거나 사내 드라이브 링크로 바꿔 주세요 — 한도를 넘으면 업로드가 실패합니다.'
            : usedPct >= 70
              ? '용량이 70% 를 넘었습니다. 큰 파일은 사내 드라이브 링크로 올리는 것을 권합니다.'
              : '무료 플랜 한도는 1GB 입니다. 한 파일은 50MB 까지, 그보다 크면 링크로 공유하세요.'}
        </p>
      </section>

      {biggest.length > 0 && (
        <details className="mt-3 rounded-xl border border-zinc-200 px-4 py-2 dark:border-zinc-800">
          <summary className="cursor-pointer text-sm text-zinc-600 dark:text-zinc-300">용량이 큰 파일 {biggest.length}개</summary>
          <ul className="mt-2 divide-y divide-zinc-50 dark:divide-zinc-800">
            {biggest.map((f) => (
              <li key={`${f.page.id}/${f.name}`} className="flex items-center gap-3 py-1.5 text-sm">
                <span className="w-16 shrink-0 text-right text-xs tabular-nums text-zinc-500">{fmtBytes(f.size)}</span>
                <span className="min-w-0 flex-1 truncate">{displayName(f.name)}</span>
                <Link href={`/p/${f.page.id}`} className="shrink-0 truncate text-xs text-zinc-400 hover:underline">
                  {f.page.title}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}

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
