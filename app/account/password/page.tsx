import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PasswordForm } from './password-form';

export default async function PasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ first?: string }>;
}) {
  const { first } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-semibold tracking-tight">
          {first ? '비밀번호를 새로 정해주세요' : '비밀번호 변경'}
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          {first
            ? '관리자가 준 임시 비밀번호는 한 번만 쓰입니다. 본인만 아는 비밀번호로 바꿔주세요.'
            : `${user.email} 계정의 비밀번호를 바꿉니다.`}
        </p>
        <div className="mt-6">
          <PasswordForm first={!!first} />
        </div>
      </div>
    </main>
  );
}
