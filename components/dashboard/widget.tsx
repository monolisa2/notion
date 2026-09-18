export function Widget({
  title,
  hint,
  count,
  accent = false,
  children,
}: {
  title: string;
  hint?: string;
  count?: number;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={[
        'flex min-h-40 flex-col rounded-2xl border bg-white p-4 dark:bg-zinc-900',
        accent ? 'border-red-200 dark:border-red-900/60' : 'border-zinc-200 dark:border-zinc-800',
      ].join(' ')}
    >
      <header className="flex items-baseline gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {typeof count === 'number' && (
          <span className={`text-xs tabular-nums ${accent && count > 0 ? 'text-red-600 dark:text-red-400' : 'text-zinc-400'}`}>
            {count}
          </span>
        )}
        {hint && <span className="ml-auto text-[11px] text-zinc-400">{hint}</span>}
      </header>
      <div className="mt-3 flex-1">{children}</div>
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-xs text-zinc-400">{children}</p>;
}
