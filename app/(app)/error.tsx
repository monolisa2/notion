'use client';

/** 페이지 렌더 중 오류 — 원인 파악용 digest 를 함께 보여준다 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-3xl" aria-hidden="true">😵</p>
      <h1 className="text-lg font-semibold">페이지를 불러오지 못했습니다</h1>
      <p className="text-sm text-zinc-500">
        잠시 후 다시 시도해 주세요. 계속되면 관리자에게 아래 코드를 알려주세요.
      </p>
      {error.digest && <code className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-600">{error.digest}</code>}
      {error.message && <p className="max-w-full break-all text-xs text-zinc-400">{error.message}</p>}
      <button
        type="button"
        onClick={() => reset()}
        className="mt-2 rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
      >
        다시 시도
      </button>
    </div>
  );
}
