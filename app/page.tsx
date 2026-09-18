import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Phase 0 확인용 홈.
 * 로그인 직후 handle_new_user 트리거가 profiles 행을 만들었는지 이 화면에서 확인한다.
 * (Phase 1 에서 사이드바 + 에디터 레이아웃으로 교체된다)
 */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, name, email, avatar_url, is_admin, created_at')
    .eq('id', user.id)
    .maybeSingle();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">TeamHub</h1>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            로그아웃
          </button>
        </form>
      </header>

      <section className="mt-10 rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-500">Phase 0 — 로그인 확인</h2>

        <dl className="mt-4 grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
          <dt className="text-zinc-500">auth.users.id</dt>
          <dd className="font-mono break-all">{user.id}</dd>
          <dt className="text-zinc-500">이메일</dt>
          <dd>{user.email}</dd>
        </dl>

        <div className="mt-6 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-500">profiles (handle_new_user 트리거)</h3>

          {error && (
            <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              profiles 조회 실패: {error.message}
            </p>
          )}

          {!error && !profile && (
            <p role="alert" className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              profiles 행이 없습니다. 0005_rls.sql 의 on_auth_user_created 트리거가
              적용되었는지 확인하세요.
            </p>
          )}

          {profile && (
            <div className="mt-3 flex items-center gap-4">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt=""
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded-full"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-200 text-lg font-semibold dark:bg-zinc-800">
                  {profile.name.slice(0, 1)}
                </div>
              )}
              <div className="text-sm">
                <p className="font-medium">
                  {profile.name}
                  {profile.is_admin && (
                    <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      관리자
                    </span>
                  )}
                </p>
                <p className="text-zinc-500">{profile.email}</p>
                <p className="text-xs text-zinc-400">
                  생성: {profile.created_at.slice(0, 10)}
                </p>
              </div>
              <span className="ml-auto rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                자동 생성 확인
              </span>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
