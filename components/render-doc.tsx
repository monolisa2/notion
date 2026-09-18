import type { ReactNode } from 'react';

type AnyNode = Record<string, unknown> & {
  type?: string;
  text?: string;
  href?: string;
  styles?: Record<string, unknown>;
  props?: Record<string, unknown>;
  content?: AnyNode[] | string;
  children?: AnyNode[];
};

function renderInline(nodes: AnyNode[] | string | undefined, keyPrefix: string): ReactNode[] {
  if (!nodes) return [];
  if (typeof nodes === 'string') return [nodes];
  return nodes.map((n, i) => {
    const key = `${keyPrefix}-${i}`;
    if (n.type === 'mention') {
      const label = String(n.props?.label ?? '');
      return (
        <span key={key} className="bn-mention">
          @{label}
        </span>
      );
    }
    if (n.type === 'link') {
      return (
        <a key={key} href={n.href} target="_blank" rel="noreferrer" className="text-blue-600 underline">
          {renderInline(n.content as AnyNode[], key)}
        </a>
      );
    }
    let el: ReactNode = n.text ?? '';
    const s = n.styles ?? {};
    if (s.code) el = <code className="rounded bg-zinc-100 px-1 text-[0.9em] dark:bg-zinc-800">{el}</code>;
    if (s.bold) el = <strong>{el}</strong>;
    if (s.italic) el = <em>{el}</em>;
    if (s.underline) el = <u>{el}</u>;
    if (s.strike) el = <s>{el}</s>;
    return <span key={key}>{el}</span>;
  });
}

/**
 * BlockNote JSON 을 읽기 전용으로 가볍게 렌더한다 (댓글·알림 미리보기용).
 * 에디터 인스턴스를 띄우지 않으므로 목록에 여러 개 있어도 가볍다.
 */
export function RenderDoc({ doc, className = '' }: { doc: unknown; className?: string }) {
  const blocks = Array.isArray(doc) ? (doc as AnyNode[]) : [];
  return (
    <div className={`space-y-1 text-sm ${className}`}>
      {blocks.map((b, i) => (
        <div key={i}>
          <p className="whitespace-pre-wrap break-words">{renderInline(b.content, `b${i}`)}</p>
          {b.children && b.children.length > 0 && (
            <div className="ml-4 border-l border-zinc-200 pl-2 dark:border-zinc-700">
              <RenderDoc doc={b.children} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
