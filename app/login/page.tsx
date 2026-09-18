import { GoogleSignInButton } from './google-sign-in-button';

const ERROR_MESSAGES: Record<string, string> = {
  provider: '구글 인증 서버가 오류를 반환했습니다. Supabase 의 Google Client ID / Secret 을 확인하세요.',
  no_code: '인증 코드가 전달되지 않았습니다. Supabase Redirect URLs 에 이 앱의 /auth/callback 주소가 등록되어 있는지 확인하세요.',
  exchange: '인증 코드를 세션으로 바꾸는 데 실패했습니다. 같은 주소(localhost)로 접속했는지 확인하고 다시 시도하세요.',
  auth_callback: '로그인 처리 중 문제가 발생했습니다. 다시 시도해 주세요.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; detail?: string; next?: string }>;
}) {
  const { error, detail, next } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold tracking-tight">TeamHub</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          누가 무엇을 하고 있고, 어디서 막혀 있는지 한 화면에서.
        </p>

        <div className="mt-8">
          <GoogleSignInButton next={next} />
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
          >
            <p>{ERROR_MESSAGES[error] ?? '알 수 없는 오류가 발생했습니다.'}</p>
            {detail && (
              <p className="mt-2 break-all font-mono text-xs opacity-80">{detail}</p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
