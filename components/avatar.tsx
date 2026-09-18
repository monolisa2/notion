export function Avatar({
  name,
  src,
  size = 24,
  className = '',
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size, fontSize: Math.max(10, size * 0.45) };
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        title={name}
        style={style}
        referrerPolicy="no-referrer"
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }
  return (
    <span
      title={name}
      style={style}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-zinc-300 font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100 ${className}`}
    >
      {name.slice(0, 1)}
    </span>
  );
}
