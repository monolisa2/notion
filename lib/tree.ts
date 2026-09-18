import type { PageTreeRow, PageType } from './types';

export type TreeNode = {
  id: string;
  parentId: string | null;
  title: string;
  icon: string | null;
  type: PageType;
  status: string | null;
  sortOrder: number;
  depth: number;
  children: TreeNode[];
};

/**
 * v_page_tree 의 평면 행을 트리로 조립한다.
 * 형제 순서는 sort_order → title. (path 정렬은 조상→후손 순서만 보장한다)
 * 부모가 목록에 없는 행(부모가 보관된 경우 등)은 루트로 올린다.
 */
export function buildTree(rows: PageTreeRow[]): TreeNode[] {
  const nodes = new Map<string, TreeNode>();
  for (const r of rows) {
    if (!r.id) continue;
    nodes.set(r.id, {
      id: r.id,
      parentId: r.parent_id,
      title: r.title ?? '제목 없음',
      icon: r.icon,
      type: (r.type as PageType) ?? 'doc',
      status: r.status,
      sortOrder: r.sort_order ?? 1000,
      depth: r.depth ?? 0,
      children: [],
    });
  }

  const roots: TreeNode[] = [];
  for (const n of nodes.values()) {
    const parent = n.parentId ? nodes.get(n.parentId) : undefined;
    if (parent) parent.children.push(n);
    else roots.push(n);
  }

  const sortRec = (list: TreeNode[]) => {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, 'ko'));
    for (const n of list) sortRec(n.children);
  };
  sortRec(roots);
  return roots;
}

export function findNode(nodes: TreeNode[], id: string): TreeNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const hit = findNode(n.children, id);
    if (hit) return hit;
  }
  return null;
}

/** 자기 자신 포함 모든 후손 id */
export function collectSubtreeIds(node: TreeNode): string[] {
  const out: string[] = [];
  const walk = (n: TreeNode) => {
    out.push(n.id);
    n.children.forEach(walk);
  };
  walk(node);
  return out;
}

/** 루트에서 해당 노드까지의 조상 id (자기 자신 제외) */
export function ancestorIds(nodes: TreeNode[], id: string): string[] {
  const path: string[] = [];
  const walk = (list: TreeNode[], trail: string[]): boolean => {
    for (const n of list) {
      if (n.id === id) {
        path.push(...trail);
        return true;
      }
      if (walk(n.children, [...trail, n.id])) return true;
    }
    return false;
  };
  walk(nodes, []);
  return path;
}

/** 부모의 자식 목록 (부모가 null 이면 루트) */
export function siblingsOf(nodes: TreeNode[], parentId: string | null): TreeNode[] {
  if (parentId === null) return nodes;
  return findNode(nodes, parentId)?.children ?? [];
}
