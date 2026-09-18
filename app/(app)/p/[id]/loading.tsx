export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="페이지 불러오는 중">
      <div className="h-10 border-b border-zinc-100" />
      <div className="mx-auto w-full max-w-[900px] px-6 pt-8 sm:px-12">
        <div className="h-14 w-14 rounded-lg bg-zinc-100" />
        <div className="mt-3 h-11 w-2/3 rounded bg-zinc-100" />
        <div className="mt-6 space-y-3">
          <div className="h-4 w-full rounded bg-zinc-100" />
          <div className="h-4 w-11/12 rounded bg-zinc-100" />
          <div className="h-4 w-4/5 rounded bg-zinc-100" />
        </div>
      </div>
    </div>
  );
}
