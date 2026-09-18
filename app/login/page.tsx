import { LoginForm } from './login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold tracking-tight">TeamHub</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">경영관리본부 업무 공유 플랫폼</p>
        <div className="mt-8">
          <LoginForm next={next} />
        </div>
        <p className="mt-6 text-xs text-zinc-400">
          계정은 관리자가 만들어 드립니다. 비밀번호를 잊으셨으면 관리자(인사관리실)에게 초기화를 요청하세요.
        </p>
      </div>
    </main>
  );
}
