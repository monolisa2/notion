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

/** 특정 조직의 후손 id (자신 포함) */
export function subtreeOf(units: OrgUnitRow[], unitId: string): Set<string> {
  const byParent = new Map<string | null, string[]>();
  for (const u of units) {
    if (!u.id) continue;
    const k = u.parent_id ?? null;
    byParent.set(k, [...(byParent.get(k) ?? []), u.id]);
  }
  const out = new Set<string>();
  const walk = (id: string) => {
    out.add(id);
    (byParent.get(id) ?? []).forEach(walk);
  };
  walk(unitId);
  return out;
}

/**
 * 사이드바에 보여줄 조직: 관리자는 전부, 일반 사용자는 "본부 공용 + 내 소속(과 그 하위)"만.
 *   중간 조상(예: 팀원에게 실 공간)은 사이드바에서 숨긴다 — 페이지 접근 권한(RLS)은 그대로이며
 *   숨긴 공간의 페이지는 홈·검색·모아보기로 접근한다. 소속이 없으면 최상위(본부)만.
 */
/**
 * 페이지를 옮길 수 있는 공간: RLS 가 "옮긴 뒤에도 내가 볼 수 있는 공간"만 허용하므로
 * 선택지도 내 계열(소속 + 조상 + 후손)로 제한한다. 관리자는 전부.
 */
export function changeableUnitsFor(units: OrgUnitRow[], myUnitId: string | null, isAdmin: boolean): OrgUnitRow[] {
  if (isAdmin) return units;
  if (!myUnitId) return units.filter((u) => !u.parent_id);
  const allowed = new Set<string>([...chainOf(units, myUnitId), ...subtreeOf(units, myUnitId)]);
  return units.filter((u) => u.id && allowed.has(u.id));
}

export function visibleUnitsFor(units: OrgUnitRow[], myUnitId: string | null, isAdmin: boolean): OrgUnitRow[] {
  if (isAdmin) return units;
  const roots = new Set(units.filter((u) => !u.parent_id).map((u) => u.id));
  if (!myUnitId) return units.filter((u) => u.id && roots.has(u.id));
  const allowed = new Set<string>([...roots].filter((id): id is string => !!id));
  for (const id of subtreeOf(units, myUnitId)) allowed.add(id);
  return units.filter((u) => u.id && allowed.has(u.id));
}
