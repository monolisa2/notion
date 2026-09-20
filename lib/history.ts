/**
 * 본문 버전 기록 (0018 page_snapshots).
 *
 * 되돌리기는 savePage() 로 한다 — 멘션 동기화가 거기에 묶여 있어서
 * RPC 로 content 만 바꾸면 멘션 색인이 옛 내용 그대로 남는다.
 * 되돌린 직후의 내용도 트리거가 다시 스냅샷으로 남기므로 "되돌리기의 되돌리기"도 된다.
 */
import type { Db } from './pages';

export type SnapshotRow = {
  id: string;
  title: string;
  content: unknown;
  created_at: string;
  replaced_by: { name: string; avatar_url: string | null } | null;
};

export async function fetchSnapshots(sb: Db, pageId: string): Promise<SnapshotRow[]> {
  const { data, error } = await sb
    .from('page_snapshots')
    .select('id, title, content, created_at, replaced_by:profiles!page_snapshots_replaced_by_fkey(name, avatar_url)')
    .eq('page_id', pageId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []) as unknown as SnapshotRow[];
}

type Node = { type?: string; text?: string; content?: unknown; children?: unknown };

/** 블록 JSON → 미리보기용 평문 (표·멘션까지 파고들지는 않는다) */
export function blocksToText(content: unknown, limit = 400): string {
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (out.join(' ').length > limit) return;
    if (Array.isArray(node)) {
      for (const n of node) walk(n);
      return;
    }
    if (!node || typeof node !== 'object') return;
    const n = node as Node;
    if (typeof n.text === 'string') out.push(n.text);
    if (n.type === 'mention') {
      const label = (n as { props?: { label?: string } }).props?.label;
      if (label) out.push(`@${label}`);
    }
    if (n.content) walk(n.content);
    if (n.children) walk(n.children);
  };
  walk(content);
  const text = out.join(' ').replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

/** 대략적인 분량 — "얼마나 지워졌나"를 보여주기 위한 글자 수 */
export function contentLength(content: unknown): number {
  return blocksToText(content, Number.MAX_SAFE_INTEGER).length;
}

/**
 * 키 순서에 흔들리지 않는 JSON 문자열.
 *
 * Postgres 의 jsonb 는 키를 **자기 방식대로 정렬해서** 돌려준다.
 * 그래서 우리가 보낸 본문과 Realtime 으로 돌아온 본문은 내용이 같아도
 * JSON.stringify 결과가 다르다. 본문이 실제로 바뀌었는지 보려면 이걸 쓴다.
 */
export function stableJson(value: unknown): string {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const src = v as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(src).sort()) out[k] = walk(src[k]);
      return out;
    }
    return v;
  };
  return JSON.stringify(walk(value));
}
