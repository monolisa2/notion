import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageEditor } from '@/components/editor/page-editor';

export default async function PageView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: page, error } = await supabase
    .from('pages')
    .select('*')
    .eq('id', id)
    .is('archived_at', null)
    .maybeSingle();

  if (error) throw new Error(`페이지를 불러오지 못했습니다: ${error.message}`);
  if (!page) notFound();

  return (
    <article className="min-h-full">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-6 pt-6 text-xs text-zinc-400 sm:px-10">
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">
          {page.type === 'task' ? '업무' : '문서'}
        </span>
        <span>수정 {page.updated_at.slice(0, 10)}</span>
      </div>
      {/* key 로 페이지 이동 시 에디터를 새로 마운트 */}
      <PageEditor key={page.id} page={page} userId={user.id} />
    </article>
  );
}
