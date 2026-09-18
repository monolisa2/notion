import type { OrgUnitRow } from './types';

export type OrgNode = OrgUnitRow & { id: string; children: OrgNode[] };

export function buildOrgTree(units: OrgUnitRow[]): OrgNode[] {
  const nodes = new Map<string, OrgNode>();
  for (const u of units) if (u.id) nodes.set(u.id, { ...u, id: u.id, children: [] });
  const roots: OrgNode[] = [];
  for (const n of nodes.values()) {
    const parent = n.parent_id ? nodes.get(n.parent_id) : undefined;
    if (parent) parent.children.push(n);
    else roots.push(n);
  }
  const sortRec = (l: OrgNode[]) => {
    l.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    l.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

/** 내 소속에서 루트까지의 조직 id (자신 포함) */
export function chainOf(units: OrgUnitRow[], unitId: string | null): Set<string> {
  const byId = new Map(units.map((u) => [u.id, u]));
  const out = new Set<string>();
  let cur = unitId;
  while (cur && byId.has(cur) && !out.has(cur)) {
    out.add(cur);
    cur = byId.get(cur)!.parent_id;
  }
  return out;
}

export function unitLabel(units: OrgUnitRow[], id: string | null | undefined) {
  return units.find((u) => u.id === id)?.name ?? '';
}
