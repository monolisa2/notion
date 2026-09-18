export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-4xl animate-pulse px-6 py-10 sm:px-10" aria-busy="true" aria-label="불러오는 중">
      <div className="h-7 w-48 rounded bg-zinc-100" />
      <div className="mt-3 h-4 w-72 rounded bg-zinc-100" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="h-40 rounded-xl bg-zinc-100" />
        <div className="h-40 rounded-xl bg-zinc-100" />
      </div>
      <div className="mt-6 h-64 rounded-xl bg-zinc-100" />
    </div>
  );
}
