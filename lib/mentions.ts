/**
 * 본문 JSON 에서 멘션을 추출해 DB와 동기화한다.
 *
 * 핵심 원칙
 *   1. 멘션은 이름이 아니라 user id 로 저장된다.
 *      "@신민철" 을 문자열로 저장하면 동명이인·개명 시 전부 깨진다.
 *   2. 동기화는 diff 방식. 전체 삭제 후 재삽입 금지.
 *      (SQL 쪽 sync_page_mentions 가 차집합만 처리한다)
 *   3. 저장 요청은 디바운스한다. 타이핑 중 매 키스트로크마다
 *      알림이 나가면 안 된다.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/** 멘션 노드 판별. BlockNote 는 props, Tiptap 은 attrs 를 쓴다. */
type AnyNode = Record<string, unknown> & {
  type?: string;
  props?: Record<string, unknown>;
  attrs?: Record<string, unknown>;
  /** 인라인 배열 | 문자열 | 표(tableContent 객체) */
  content?: AnyNode[] | string | TableContent;
  children?: AnyNode[];
  text?: string;
};

type TableContent = {
  type: 'tableContent';
  rows?: { cells?: (AnyNode[] | { type: 'tableCell'; content?: AnyNode[] })[] }[];
};

/**
 * 블록의 content 를 인라인 노드 배열로 정규화한다.
 * BlockNote 의 표(table) 블록은 content 가 배열이 아니라 { type:'tableContent', rows:[{cells:[...]}] } 객체라서
 * 그대로 순회하면 "object is not iterable" 로 저장이 실패한다.
 */
function inlineNodes(content: AnyNode['content']): AnyNode[] {
  if (!content) return [];
  if (typeof content === 'string') return [{ type: 'text', text: content }];
  if (Array.isArray(content)) return content;
  if (typeof content === 'object' && (content as TableContent).type === 'tableContent') {
    const out: AnyNode[] = [];
    for (const row of (content as TableContent).rows ?? []) {
      for (const cell of row.cells ?? []) {
        const nodes = Array.isArray(cell) ? cell : cell?.content ?? [];
        out.push(...nodes, { type: 'text', text: ' ' });
      }
      out.push({ type: 'text', text: '\n' });
    }
    return out;
  }
  return [];
}

export interface ExtractedMention {
  userId: string;
  label: string;
  /** 알림 미리보기용. 멘션이 들어 있던 블록의 평문. */
  context: string;
}

/** 조직 멘션(@인사관리실) — 저장 형태는 unit id (0020) */
export interface ExtractedGroup {
  unitId: string;
  label: string;
  context: string;
}

const MENTION_TYPES = new Set(['mention', 'userMention']);

function nodeUnitId(node: AnyNode): string | null {
  const bag = { ...(node.attrs ?? {}), ...(node.props ?? {}) } as Record<string, unknown>;
  const raw = bag.unitId ?? bag.unit_id;
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

function nodeUserId(node: AnyNode): string | null {
  const bag = { ...(node.attrs ?? {}), ...(node.props ?? {}) } as Record<string, unknown>;
  const raw = bag.userId ?? bag.id ?? bag.user_id;
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

function nodeLabel(node: AnyNode): string {
  const bag = { ...(node.attrs ?? {}), ...(node.props ?? {}) } as Record<string, unknown>;
  const raw = bag.label ?? bag.name ?? bag.userName;
  return typeof raw === 'string' ? raw : '';
}

/**
 * 블록의 '인라인 내용만' 평문화한다 (멘션은 @이름 으로).
 *
 * children(하위 블록)은 일부러 따라가지 않는다. 하위 블록은 자기만의
 * 맥락을 가져야 하기 때문이다. 여기서 children 까지 훑으면 하위 블록의
 * 멘션이 상위 블록 문장을 맥락으로 물려받아 알림 미리보기가 엉킨다.
 */
function inlineText(node: AnyNode): string {
  const out: string[] = [];
  const walk = (n: AnyNode) => {
    if (typeof n.text === 'string') out.push(n.text);
    if (n.type && MENTION_TYPES.has(n.type)) out.push(`@${nodeLabel(n)}`);
    for (const child of inlineNodes(n.content)) walk(child);
  };
  walk(node);
  return out.join('').replace(/\s+/g, ' ').trim();
}

/** 블록과 그 하위 블록 전체를 평문화한다 (검색·주간보고용). */
function subtreeText(node: AnyNode): string {
  const lines: string[] = [];
  const walk = (n: AnyNode) => {
    const t = inlineText(n);
    if (t) lines.push(t);
    for (const child of n.children ?? []) walk(child);
  };
  walk(node);
  return lines.join('\n');
}

/**
 * 문서 JSON 전체를 훑어 멘션을 뽑는다.
 * 같은 사람이 여러 번 언급되면 첫 번째 등장 맥락만 남긴다.
 */
export function extractMentions(doc: unknown): ExtractedMention[] {
  const found = new Map<string, ExtractedMention>();
  if (!doc || typeof doc !== 'object') return [];

  const visitBlock = (block: AnyNode) => {
    const context = inlineText(block);

    // 이 블록의 인라인 내용만 훑는다 (children 은 아래에서 따로 방문)
    const scan = (n: AnyNode) => {
      if (n.type && MENTION_TYPES.has(n.type)) {
        const userId = nodeUserId(n);
        if (userId && !found.has(userId)) {
          found.set(userId, {
            userId,
            label: nodeLabel(n),
            context: context.slice(0, 200),
          });
        }
      }
      for (const child of inlineNodes(n.content)) scan(child);
    };

    scan(block);
    // 하위 블록은 각자의 맥락을 갖도록 따로 방문
    for (const child of block.children ?? []) visitBlock(child);
  };

  const blocks = Array.isArray(doc) ? (doc as AnyNode[]) : [(doc as AnyNode)];
  for (const b of blocks) visitBlock(b);

  return [...found.values()];
}

/**
 * 조직 멘션만 뽑는다. 사람 멘션과 같은 블록 순회를 쓴다.
 * (extractMentions 는 userId 가 있는 노드만 담으므로 조직 멘션은 그쪽에 섞이지 않는다)
 */
export function extractGroupMentions(doc: unknown): ExtractedGroup[] {
  const found = new Map<string, ExtractedGroup>();
  if (!doc || typeof doc !== 'object') return [];

  const visitBlock = (block: AnyNode) => {
    const context = inlineText(block);
    const scan = (n: AnyNode) => {
      if (n.type && MENTION_TYPES.has(n.type)) {
        const unitId = nodeUnitId(n);
        if (unitId && !found.has(unitId)) {
          found.set(unitId, { unitId, label: nodeLabel(n), context: context.slice(0, 200) });
        }
      }
      for (const child of inlineNodes(n.content)) scan(child);
    };
    scan(block);
    for (const child of block.children ?? []) visitBlock(child);
  };

  const blocks = Array.isArray(doc) ? (doc as AnyNode[]) : [(doc as AnyNode)];
  for (const b of blocks) visitBlock(b);
  return [...found.values()];
}

/**
 * 조직 멘션을 구성원으로 펼친다 (0020).
 *
 * 펼치는 일은 **DB 가 한다** — 누가 그 조직 소속인지, 그리고 그 사람이
 * 이 페이지를 볼 수 있는지는 서버만 알아야 한다.
 * (못 보는 페이지의 알림을 받으면 눌러도 안 열린다)
 *
 * 사람 멘션과 합칠 때는 **사람 멘션이 이긴다** — 직접 부른 맥락이 더 정확하다.
 */
type ExpandedRow = { user_id: string; unit_id: string };

/**
 * 같은 페이지·같은 조직 조합은 한 번만 물어본다.
 * 자동저장은 700ms 마다 도는데, 조직 멘션이 그대로면 매번 물을 이유가 없다.
 * (탭을 닫으면 사라지는 메모리 캐시라 조직 인원이 바뀌어도 다음 방문에 반영된다)
 */
const expandCache = new Map<string, ExpandedRow[]>();

async function expandGroups(
  supabase: SupabaseClient,
  pageId: string,
  groups: ExtractedGroup[],
  target: Map<string, string>,
): Promise<void> {
  if (groups.length === 0) return;
  const units = groups.map((g) => g.unitId).sort();
  const key = `${pageId}|${units.join(',')}`;

  let rows = expandCache.get(key);
  if (!rows) {
    const { data, error } = await supabase.rpc('expand_unit_mention', {
      p_page: pageId,
      p_units: units,
    });
    if (error) throw error;
    rows = (data ?? []) as ExpandedRow[];
    expandCache.set(key, rows);
  }

  const contextOf = new Map(groups.map((g) => [g.unitId, g.context]));
  for (const row of rows) {
    if (target.has(row.user_id)) continue;
    target.set(row.user_id, contextOf.get(row.unit_id) ?? '');
  }
}

/** 문서 전체 평문 (검색·주간보고용) */
export function docToPlainText(doc: unknown): string {
  const blocks = Array.isArray(doc) ? (doc as AnyNode[]) : [doc as AnyNode];
  return blocks.map(subtreeText).filter(Boolean).join('\n');
}

/**
 * 페이지 저장 + 멘션 동기화.
 * savePage 는 디바운스된 호출부(useAutosave)에서만 부른다.
 */
export async function savePage(
  supabase: SupabaseClient,
  params: { pageId: string; authorId: string; title?: string; content: unknown },
): Promise<{ newMentions: number }> {
  const { pageId, authorId, title, content } = params;

  const { error: upErr } = await supabase
    .from('pages')
    .update({ content, ...(title !== undefined ? { title } : {}) })
    .eq('id', pageId);
  if (upErr) throw upErr;

  // 사람 멘션 + 조직 멘션(구성원으로 펼친 것)
  const targets = new Map<string, string>();
  for (const m of extractMentions(content)) targets.set(m.userId, m.context);
  try {
    await expandGroups(supabase, pageId, extractGroupMentions(content), targets);
  } catch {
    // 본문은 위에서 이미 저장됐다. 여기서 줄어든 명단으로 동기화하면
    // 앞서 걸린 조직 멘션이 **지워지므로** 동기화를 통째로 건너뛴다 (다음 저장에 맞춰진다)
    return { newMentions: 0 };
  }

  const contexts: Record<string, string> = {};
  for (const [userId, context] of targets) contexts[userId] = context;

  const { data, error: rpcErr } = await supabase.rpc('sync_page_mentions', {
    p_page_id: pageId,
    p_author_id: authorId,
    p_mentioned: [...targets.keys()],
    p_contexts: contexts,
  });
  if (rpcErr) throw rpcErr;

  return { newMentions: (data as number) ?? 0 };
}

/** 댓글 저장 + 멘션 */
export async function saveComment(
  supabase: SupabaseClient,
  params: { pageId: string; authorId: string; body: unknown; parentId?: string; updateId?: string | null },
): Promise<string> {
  const { data: comment, error } = await supabase
    .from('comments')
    .insert({
      page_id: params.pageId,
      parent_id: params.parentId ?? null,
      update_id: params.updateId ?? null,
      author_id: params.authorId,
      body: params.body,
      body_text: docToPlainText(params.body),
    })
    .select('id')
    .single();
  if (error) throw error;

  const targets = new Map<string, string>();
  for (const m of extractMentions(params.body)) targets.set(m.userId, m.context);
  try {
    await expandGroups(supabase, params.pageId, extractGroupMentions(params.body), targets);
  } catch {
    // 댓글은 이미 등록됐다 — 멘션 알림만 건너뛴다
  }

  if (targets.size > 0) {
    await supabase.rpc('sync_comment_mentions', {
      p_comment_id: comment.id,
      p_mentioned: [...targets.keys()],
    });
  }
  return comment.id;
}
