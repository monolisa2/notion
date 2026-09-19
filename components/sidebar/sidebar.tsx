'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/errors';
import { createClient } from '@/lib/supabase/client';
import {
  archivePages,
  convertPageType,
  CYCLE_MOVE_MESSAGE,
  movePage,
  renamePage,
} from '@/lib/pages';
import {
  ancestorIds,
  buildTree,
  collectSubtreeIds,
  findNode,
  siblingsOf,
  type TreeNode,
} from '@/lib/tree';
import type { Me, OrgUnitRow, PageTreeRow, PageVisibility, SidebarPageLite } from '@/lib/types';
import { buildOrgTree, canWriteUnit, chainOf, visibleUnitsFor, type OrgNode } from '@/lib/org';
import { ContextMenu, type MenuItem } from './context-menu';
import { useProgressLog } from '@/components/progress-log-provider';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { useNewPage } from '@/components/new-page-provider';
import { unitLabel } from '@/lib/org';

type DropPos = 'before' | 'after' | 'inside';
type DropTarget = { id: string; pos: DropPos } | { id: null; pos: 'root' };

export function Sidebar({
  me,
  rows,
  units,
  favorites = [],
  recents = [],
  writerUnits = [],
  onChanged,
}: {
  me: Me;
  rows: PageTreeRow[];
  units: OrgUnitRow[];
  favorites?: SidebarPageLite[];
  recents?: SidebarPageLite[];
  writerUnits?: string[];
  onChanged: () => Promise<void>;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { open: openLog } = useProgressLog();
  const router = useRouter();
  const pathname = usePathname();
  const currentId = pathname.startsWith('/p/') ? pathname.slice(3).split('/')[0] : null;

  // 전체 트리(이동 계산용) + 공간별 루트 분리
  const tree = useMemo(() => buildTree(rows), [rows]);
  // 일반 사용자는 내 계열(소속 + 조상 + 후손)만 사이드바에 보인다. 관리자는 전부 (조직 관리 필요)
  const sidebarUnits = useMemo(() => visibleUnitsFor(units, me.unitId, me.isAdmin), [units, me.unitId, me.isAdmin]);
  const orgTree = useMemo(() => buildOrgTree(sidebarUnits), [sidebarUnits]);
  const myChain = useMemo(() => chainOf(units, me.unitId), [units, me.unitId]);
  const rowsByUnit = useMemo(() => {
    const m = new Map<string, PageTreeRow[]>();
    const personal: PageTreeRow[] = [];
    for (const r of rows) {
      if (r.visibility === '개인') personal.push(r);
      else if (r.unit_id) m.set(r.unit_id, [...(m.get(r.unit_id) ?? []), r]);
    }
    return { m, personal };
  }, [rows]);
  // 공간(조직) 접기 상태
  const [closedSpaces, setClosedSpaces] = useState<Set<string>>(new Set());
  const toggleSpace = (k: string) =>
    setClosedSpaces((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  // 접기/펼치기는 컴포넌트 state 로만 (localStorage 금지).
  // 현재 페이지의 조상은 기본으로 펼쳐지되, 사용자가 접으면 closed 에 기록해 존중한다.
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const autoOpen = useMemo(
    () => new Set(currentId ? ancestorIds(tree, currentId) : []),
    [tree, currentId],
  );
  const isExpanded = (id: string) => !closed.has(id) && (opened.has(id) || autoOpen.has(id));

  const toggle = (id: string) => {
    if (isExpanded(id)) {
      setOpened((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setClosed((prev) => new Set(prev).add(id));
    } else {
      setClosed((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setOpened((prev) => new Set(prev).add(id));
    }
  };
  const expand = (id: string) => {
    setClosed((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setOpened((prev) => new Set(prev).add(id));
  };

  // ---- 우클릭 메뉴 ----
  const [menu, setMenu] = useState<{ x: number; y: number; node: TreeNode } | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);

  const run = async (label: string, fn: () => Promise<void>) => {
    try {
      await fn();
      await onChanged();
    } catch (e) {
      const msg = errorMessage(e);
      toast.error(`${label} 실패: ${msg}`);
    }
  };

  // 새 페이지: 양식 선택은 NewPageProvider 가 담당
  const { open: openNewPage } = useNewPage();
  const addChild = (parentId: string | null, space?: { unitId: string | null; visibility: PageVisibility }) => {
    if (parentId) {
      const parent = findNode(tree, parentId);
      const row = rows.find((r) => r.id === parentId);
      openNewPage({
        parentId,
        unitId: row?.unit_id ?? null,
        visibility: (row?.visibility as PageVisibility) ?? '본부',
        label: `${parent?.title ?? '페이지'} 의 하위 페이지`,
      });
      return;
    }
    const unitId = space?.unitId ?? null;
    const visibility = space?.visibility ?? '본부';
    openNewPage({
      parentId: null,
      unitId,
      visibility,
      label: visibility === '개인' ? '개인 메모' : unitLabel(units, unitId) || '본부 공용',
    });
  };

  const menuItems = (node: TreeNode): MenuItem[] => [
    { label: '하위 페이지 추가', onClick: () => addChild(node.id) },
    {
      label: node.type === 'task' ? '문서로 전환' : '업무로 전환',
      onClick: () =>
        run('전환', () => convertPageType(supabase, node.id, node.type === 'task' ? 'doc' : 'task')),
    },
    { label: '이름 변경', onClick: () => setRenaming(node.id) },
    {
      label: '보관',
      danger: true,
      onClick: () => {
        const ids = collectSubtreeIds(node);
        const ok =
          ids.length === 1 ||
          window.confirm(`하위 페이지 ${ids.length - 1}개도 함께 보관됩니다. 계속할까요?`);
        if (!ok) return;
        void run('보관', async () => {
          await archivePages(supabase, ids);
          if (currentId && ids.includes(currentId)) router.push('/');
          toast.success('보관했습니다');
        });
      },
    },
  ];

  // ---- 드래그 앤 드롭 ----
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const dragIdRef = useRef<string | null>(null);

  const handleDrop = async (target: DropTarget) => {
    const pageId = dragIdRef.current;
    setDragId(null);
    setDropTarget(null);
    dragIdRef.current = null;
    if (!pageId) return;

    let parentId: string | null;
    let afterId: string | null;

    if (target.id === null) {
      return;
    } else {
      if (target.id === pageId) return;
      const t = findNode(tree, target.id);
      if (!t) return;
      if (target.pos === 'inside') {
        parentId = t.id;
        const kids = t.children.filter((n) => n.id !== pageId);
        afterId = kids.length ? kids[kids.length - 1].id : null;
        expand(t.id);
      } else {
        parentId = t.parentId;
        const sibs = siblingsOf(tree, t.parentId).filter((n) => n.id !== pageId);
        const idx = sibs.findIndex((n) => n.id === t.id);
        afterId = target.pos === 'after' ? t.id : idx > 0 ? sibs[idx - 1].id : null;
      }
    }

    try {
      await movePage(supabase, { pageId, parentId, afterId });
      await onChanged();
    } catch (e) {
      const msg = errorMessage(e);
      // DB 트리거가 순환 이동을 막으면 그 문구를 그대로 보여준다
      toast.error(msg.includes(CYCLE_MOVE_MESSAGE) ? CYCLE_MOVE_MESSAGE : `이동 실패: ${msg}`);
    }
  };

  const posFromEvent = (e: React.DragEvent<HTMLElement>): DropPos => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    if (y < rect.height / 4) return 'before';
    if (y > (rect.height * 3) / 4) return 'after';
    return 'inside';
  };

  // ---- 렌더 ----
  const renderNode = (node: TreeNode, level: number) => {
    const isOpen = isExpanded(node.id);
    const isCurrent = node.id === currentId;
    const isDropping = dropTarget && dropTarget.id === node.id ? dropTarget.pos : null;

    return (
      <li key={node.id}>
        <div
          draggable={renaming !== node.id}
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', node.id);
            dragIdRef.current = node.id;
            setDragId(node.id);
          }}
          onDragEnd={() => {
            setDragId(null);
            setDropTarget(null);
            dragIdRef.current = null;
          }}
          onDragOver={(e) => {
            if (!dragIdRef.current || dragIdRef.current === node.id) return;
            e.preventDefault();
            e.stopPropagation();
            const pos = posFromEvent(e);
            if (!dropTarget || dropTarget.id !== node.id || dropTarget.pos !== pos) {
              setDropTarget({ id: node.id, pos });
            }
          }}
          onDragLeave={(e) => {
            if (dropTarget?.id === node.id && !e.currentTarget.contains(e.relatedTarget as Node)) {
              setDropTarget(null);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void handleDrop({ id: node.id, pos: posFromEvent(e) });
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenu({ x: e.clientX, y: e.clientY, node });
          }}
          className={[
            'group relative flex items-center gap-1 rounded-md pr-1 text-sm',
            isCurrent
              ? 'bg-zinc-200/80 font-medium text-zinc-900'
              : 'text-zinc-700 hover:bg-zinc-200/60',
            dragId === node.id ? 'opacity-40' : '',
            isDropping === 'inside' ? 'ring-2 ring-inset ring-blue-400' : '',
          ].join(' ')}
          style={{ paddingLeft: 4 + level * 14 }}
        >
          {isDropping === 'before' && (
            <span className="pointer-events-none absolute inset-x-1 top-0 h-0.5 bg-blue-500" />
          )}
          {isDropping === 'after' && (
            <span className="pointer-events-none absolute inset-x-1 bottom-0 h-0.5 bg-blue-500" />
          )}

          <button
            type="button"
            aria-label={isOpen ? '접기' : '펼치기'}
            onClick={() => toggle(node.id)}
            className={[
              'flex h-6 w-5 shrink-0 items-center justify-center rounded text-zinc-400 hover:bg-zinc-300/60 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200',
              node.children.length === 0 ? 'invisible' : '',
            ].join(' ')}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              className={`transition-transform ${isOpen ? 'rotate-90' : ''}`}
              aria-hidden="true"
            >
              <path d="M3 1.5 7 5 3 8.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>

          <span className="flex w-5 shrink-0 items-center justify-center text-[13px] leading-none" aria-hidden="true">
            {node.icon ? (
              node.icon
            ) : node.type === 'task' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-400"><rect x="3" y="3" width="18" height="18" rx="3" /><path d="m8 12 3 3 5-6" /></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-400"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h5" /></svg>
            )}
          </span>

          {renaming === node.id ? (
            <RenameInput
              initial={node.title}
              onDone={(title) => {
                setRenaming(null);
                if (title !== null && title !== node.title) {
                  void run('이름 변경', () => renamePage(supabase, node.id, title));
                }
              }}
            />
          ) : (
            <Link
              href={`/p/${node.id}`}
              className="min-w-0 flex-1 truncate py-1"
              onDoubleClick={(e) => {
                e.preventDefault();
                setRenaming(node.id);
              }}
            >
              {node.title}
            </Link>
          )}

          {node.type === 'task' && node.status && (
            <span className="shrink-0 rounded bg-zinc-200 px-1 text-[10px] text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
              {node.status}
            </span>
          )}

          <button
            type="button"
            aria-label="메뉴"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setMenu({ x: r.left, y: r.bottom, node });
            }}
            className="invisible h-6 w-6 shrink-0 rounded text-zinc-500 hover:bg-zinc-300/60 group-hover:visible dark:hover:bg-zinc-700"
          >
            ⋯
          </button>
        </div>

        {isOpen && node.children.length > 0 && (
          <ul>{node.children.map((c) => renderNode(c, level + 1))}</ul>
        )}
      </li>
    );
  };

  const writerSet = useMemo(() => new Set(writerUnits), [writerUnits]);

  const spaceHeader = (key: string, emoji: string, label: string, badge: string | null, level: number, onAdd: (() => void) | null, mine: boolean) => (
    <div
      className="group flex items-center gap-1 rounded-md pr-1 text-sm font-semibold text-zinc-500 hover:bg-zinc-200/40 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
      style={{ paddingLeft: 4 + level * 10 }}
    >
      <button type="button" onClick={() => toggleSpace(key)} className="flex h-6 w-5 shrink-0 items-center justify-center text-zinc-400" aria-label="접기/펼치기">
        <svg width="10" height="10" viewBox="0 0 10 10" className={`transition-transform ${closedSpaces.has(key) ? '' : 'rotate-90'}`} aria-hidden="true">
          <path d="M3 1.5 7 5 3 8.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>
      <span className="w-5 shrink-0 text-center text-[13px] leading-none" aria-hidden="true">
        {emoji}
      </span>
      <button type="button" onClick={() => toggleSpace(key)} className="min-w-0 flex-1 truncate py-1 text-left">
        {label}
        {mine && <span className="ml-1 rounded bg-blue-100 px-1 text-[9px] font-medium text-blue-700 dark:bg-blue-900/60 dark:text-blue-200">내 소속</span>}
      </button>
      {badge && <span className="text-[10px] font-normal text-zinc-400">{badge}</span>}
      {onAdd && (
        <button
          type="button"
          aria-label="이 공간에 새 페이지"
          onClick={onAdd}
          className="invisible h-6 w-6 rounded text-zinc-500 hover:bg-zinc-300/60 group-hover:visible dark:hover:bg-zinc-700"
        >
          ＋
        </button>
      )}
    </div>
  );

  const renderSpace = (unit: OrgNode, level: number) => {
    const key = unit.id;
    const isRoot = unit.level === '본부';
    const visibility: PageVisibility = isRoot ? '본부' : '소속';
    const pageTree = buildTree(rowsByUnit.m.get(unit.id) ?? []);
    const mine = myChain.has(unit.id) && me.unitId === unit.id;
    const open = !closedSpaces.has(key);
    const writable = canWriteUnit(unit, me, writerSet);
    return (
      <div key={key} className="mt-1">
        {spaceHeader(
          key,
          isRoot ? '🏢' : unit.level === '실' ? '📁' : '👥',
          isRoot ? `${unit.name} 공용` : unit.name ?? '',
          isRoot ? null : `${unit.member_count ?? 0}명`,
          level,
          writable ? () => addChild(null, { unitId: unit.id, visibility }) : null,
          mine,
        )}
        {open && (
          <>
            {pageTree.length > 0 ? (
              <ul className="space-y-px" style={{ paddingLeft: level * 10 }}>
                {pageTree.map((n) => renderNode(n, 1))}
              </ul>
            ) : (
              unit.children.length === 0 && (
                <p className="py-1 text-[11px] text-zinc-400" style={{ paddingLeft: 28 + level * 10 }}>
                  페이지 없음
                </p>
              )
            )}
            {unit.children.map((c) => renderSpace(c, level + 1))}
          </>
        )}
      </div>
    );
  };

  const renderPersonal = () => {
    const key = 'personal';
    const pageTree = buildTree(rowsByUnit.personal);
    return (
      <div key={key} className="mt-3 border-t border-zinc-200 pt-2 dark:border-zinc-800">
        {spaceHeader(key, '📝', '개인 메모', '나만 봄', 0, () => addChild(null, { unitId: null, visibility: '개인' }), false)}
        {!closedSpaces.has(key) &&
          (pageTree.length > 0 ? (
            <ul className="space-y-px">{pageTree.map((n) => renderNode(n, 1))}</ul>
          ) : (
            <p className="py-1 pl-7 text-[11px] text-zinc-400">메모 없음</p>
          ))}
      </div>
    );
  };

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-zinc-200/80 bg-[#f7f7f5] text-sm">
      <div className="flex items-center gap-2 px-3 pb-1 pt-3">
        {me.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={me.avatarUrl} alt="" className="h-6 w-6 rounded-md" referrerPolicy="no-referrer" />
        ) : (
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-800 text-[11px] font-semibold text-white">
            {me.name.slice(0, 1)}
          </span>
        )}
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate font-semibold text-zinc-800">{me.name}</div>
          <div className="truncate text-[11px] text-zinc-500">
            {[unitLabel(units, me.unitId), me.rank, me.jobTitle].filter(Boolean).join(' · ') || 'TeamHub'}
          </div>
        </div>
        <NotificationBell meId={me.id} />
        <div className="relative">
          <button
            type="button"
            title="계정"
            aria-label="계정 메뉴"
            onClick={() => setAccountOpen((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-200"
          >
            ⋯
          </button>
          {accountOpen && (
            <>
              <div className="fixed inset-0 z-10" onMouseDown={() => setAccountOpen(false)} />
              <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-zinc-200 bg-white p-1 text-sm shadow-lg">
                <Link href="/account/password" onClick={() => setAccountOpen(false)} className="block rounded-md px-3 py-1.5 hover:bg-zinc-100">
                  비밀번호 변경
                </Link>
                <form action="/auth/signout" method="post">
                  <button type="submit" className="block w-full rounded-md px-3 py-1.5 text-left hover:bg-zinc-100">
                    로그아웃
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 검색 */}
      <form action="/search" method="get" className="px-2 pb-1">
        <label className="flex items-center gap-2 rounded-md border border-zinc-200/80 bg-white px-2 py-1 text-zinc-400 focus-within:border-zinc-400">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input
            name="q"
            placeholder="검색"
            className="w-full bg-transparent text-sm text-zinc-800 outline-none placeholder:text-zinc-400"
          />
        </label>
      </form>

      <div className="px-2">
        <NavLink href="/" label="홈" icon="🏠" active={pathname === '/'} />
        <NavLink href="/tasks" label="업무" icon="✅" active={pathname.startsWith('/tasks')} />
        <NavLink href="/calendar" label="캘린더" icon="📅" active={pathname.startsWith('/calendar')} />
        <NavLink href="/collections/meeting" label="모아보기" icon="🗂️" active={pathname.startsWith('/collections')} />
        <button
          type="button"
          onClick={() => openLog()}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <span className="w-5 text-center text-[13px] leading-none">✏️</span> 진행 로그 남기기
          <kbd className="ml-auto text-[10px] text-zinc-400">⌃⇧L</kbd>
        </button>
      </div>

      <nav
        className="mt-2 flex-1 overflow-y-auto px-2 pb-8"
        onDragOver={(e) => {
          if (!dragIdRef.current) return;
          e.preventDefault();
        }}
      >
        {favorites.length > 0 && (
          <div className="mb-1">
            <div className="px-1 py-1 text-[11px] font-semibold text-zinc-400">⭐ 즐겨찾기</div>
            <ul className="space-y-px">
              {favorites.map((f) => (
                <li key={f.id}>
                  <LitePageLink p={f} active={currentId === f.id} />
                </li>
              ))}
            </ul>
          </div>
        )}
        {recents.length > 0 && (
          <div className="mb-1">
            <div className="px-1 py-1 text-[11px] font-semibold text-zinc-400">🕘 최근 항목</div>
            <ul className="space-y-px">
              {recents.slice(0, 5).map((f) => (
                <li key={f.id}>
                  <LitePageLink p={f} active={currentId === f.id} />
                </li>
              ))}
            </ul>
          </div>
        )}
        {orgTree.map((root) => renderSpace(root, 0))}
        {renderPersonal()}
        <div className="mt-3 border-t border-zinc-200 pt-2">
          <NavLink href="/trash" label="보관함" icon="🗑️" active={pathname.startsWith('/trash')} />
          {me.isAdmin && <NavLink href="/admin" label="관리자 설정" icon="⚙️" active={pathname.startsWith('/admin')} />}
        </div>
      </nav>

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems(menu.node)} onClose={() => setMenu(null)} />
      )}

    </aside>
  );
}

function LitePageLink({ p, active }: { p: SidebarPageLite; active: boolean }) {
  return (
    <Link
      href={`/p/${p.id}`}
      className={`flex items-center gap-1.5 rounded-md px-1 py-1 text-sm ${
        active ? 'bg-zinc-200/80 font-medium text-zinc-900' : 'text-zinc-700 hover:bg-zinc-200/60'
      }`}
    >
      <span className="flex w-5 shrink-0 items-center justify-center text-[13px] leading-none">{p.icon ?? (p.type === 'task' ? '✅' : '📄')}</span>
      <span className="min-w-0 flex-1 truncate">{p.title}</span>
      {p.type === 'task' && p.status && (
        <span className="shrink-0 rounded bg-zinc-200 px-1 text-[10px] text-zinc-600">{p.status}</span>
      )}
    </Link>
  );
}

function NavLink({ href, label, icon, active }: { href: string; label: string; icon: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
        active
          ? 'bg-zinc-200/70 font-medium dark:bg-zinc-800'
          : 'text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800'
      }`}
    >
      <span className="w-5 text-center text-[13px] leading-none" aria-hidden="true">
        {icon}
      </span>
      {label}
    </Link>
  );
}

function RenameInput({
  initial,
  onDone,
}: {
  initial: string;
  onDone: (title: string | null) => void;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onDone(value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onDone(value);
        if (e.key === 'Escape') onDone(null);
      }}
      className="min-w-0 flex-1 rounded border border-blue-400 bg-white px-1 py-0.5 text-sm outline-none dark:bg-zinc-950"
    />
  );
}
