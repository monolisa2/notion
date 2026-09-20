import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, getSessionUser } from '@/lib/supabase/server';
import { getUnits } from '@/lib/reference';
import { unitLabel } from '@/lib/org';
import { AccountForm } from './account-form';

export const dynamic = 'force-dynamic';

/**
 * 내 계정 설정.
 * 일반 사용자가 스스로 바꿀 수 있는 것만 둔다 — 이름 · 프로필 사진 · 알림 수신.
 * 소속·직급·직책·권한은 관리자만 (profiles_guard 트리거가 DB 에서도 막는다).
 */
export default async function AccountPage() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect('/login');

  const [{ data: profile }, units] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, avatar_url, unit_id, rank, job_title, notify_mention, notify_assign, notify_due')
      .eq('id', user.id)
      .maybeSingle(),
    getUnits(),
  ]);
  if (!profile) redirect('/login');

  const org = [unitLabel(units, profile.unit_id), profile.rank, profile.job_title].filter(Boolean).join(' · ');

  return (
    <div className="mx-auto w-full max-w-xl px-6 py-10 sm:px-8">
      <h1 className="text-2xl font-semibold tracking-tight">내 계정</h1>
      <p className="mt-1 text-sm text-zinc-500">{user.email}</p>

      <AccountForm profile={profile} />

      <section className="mt-8 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">소속 정보</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{org || '아직 소속이 지정되지 않았습니다'}</p>
        <p className="mt-2 text-xs leading-relaxed text-zinc-400">
          소속·직급·직책은 관리자(인사관리실)만 바꿀 수 있습니다. 바뀐 내용이 있으면 알려주세요.
        </p>
      </section>

      <section className="mt-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">비밀번호</h2>
        <Link
          href="/account/password"
          className="mt-2 inline-block rounded-md border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          비밀번호 변경
        </Link>
        <p className="mt-2 text-xs text-zinc-400">
          비밀번호를 잊으셨을 때는 관리자(인사관리실)에게 초기화를 요청하세요.
        </p>
      </section>
    </div>
  );
}
