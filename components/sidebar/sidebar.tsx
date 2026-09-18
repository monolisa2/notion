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
  createPage,
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
import type { Me, PageTreeRow } from '@/lib/types';
import { ContextMenu, type MenuItem } from './context-menu';
import { useProgressLog } from '@/components/progress-log-provider';
import { NotificationBell } from '@/components/notifications/notification-bell';

type DropPos = 'before' | 'after' | 'inside';
type DropTarget = { id: string; pos: DropPos } | { id: null; pos: 'root' };

export function Sidebar({
  me,
  rows,
  onChanged,
}: {
  me: Me;
  rows: PageTreeRow[];
  onChanged: () => Promise<void>;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { open: openLog } = useProgressLog();
  const router = useRouter();
  const pathname = usePathname();
  const currentId = pathname.startsWith('/p/') ? pathname.slice(3).split('/')[0] : null;

  const tree = useMemo(() => buildTree(rows), [rows]);

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

  const addChild = (parentId: string | null) =>
    run('페이지 추가', async () => {
      const id = await createPage(supabase, { parentId, createdBy: me.id });
      if (parentId) expand(parentId);
      router.push(`/p/${id}`);
    });

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
      // 빈 공간에 놓기 → 루트 맨 뒤
      parentId = null;
      const sibs = tree.filter((n) => n.id !== pageId);
      afterId = sibs.length ? sibs[sibs.length - 1].id : null;
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
              ? 'bg-zinc-200/70 font-medium dark:bg-zinc-800'
              : 'hover:bg-zinc-200/50 dark:hover:bg-zinc-800/60',
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

          <span className="w-5 shrink-0 text-center text-sm leading-none" aria-hidden="true">
            {node.icon ?? (node.type === 'task' ? '☑' : '📄')}
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

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-zinc-200 bg-zinc-100/70 dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="flex items-center gap-2 px-3 py-3">
        {me.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={me.avatarUrl} alt="" className="h-6 w-6 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-300 text-xs dark:bg-zinc-700">
            {me.name.slice(0, 1)}
          </span>
        )}
        <Link href="/" className="truncate text-sm font-semibold">
          TeamHub
        </Link>
        <span className="ml-auto" />
        <NotificationBell meId={me.id} />
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
          >
            로그아웃
          </button>
        </form>
      </div>

      <div className="px-2">
        <NavLink href="/" label="대시보드" icon="▦" active={pathname === '/'} />
        <NavLink href="/tasks" label="업무 목록" icon="☑" active={pathname.startsWith('/tasks')} />
        <div className="my-1 border-t border-zinc-200 dark:border-zinc-800" />
        <button
          type="button"
          onClick={() => addChild(null)}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <span className="text-base leading-none">＋</span> 새 페이지
        </button>
        <button
          type="button"
          onClick={() => openLog()}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <span className="text-base leading-none">✎</span> 진행 로그 남기기
          <kbd className="ml-auto text-[10px] text-zinc-400">⌃⇧L</kbd>
        </button>
      </div>

      <nav
        className="mt-1 flex-1 overflow-y-auto px-2 pb-8"
        onDragOver={(e) => {
          if (!dragIdRef.current) return;
          e.preventDefault();
          if (!dropTarget || dropTarget.id !== null) setDropTarget({ id: null, pos: 'root' });
        }}
        onDrop={(e) => {
          e.preventDefault();
          void handleDrop({ id: null, pos: 'root' });
        }}
      >
        {tree.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-zinc-400">
            아직 페이지가 없습니다.
            <br />위 &ldquo;새 페이지&rdquo;로 시작하세요.
          </p>
        ) : (
          <ul className="space-y-px">{tree.map((n) => renderNode(n, 0))}</ul>
        )}
        {dropTarget?.id === null && dragId && (
          <div className="mx-1 mt-1 h-0.5 rounded bg-blue-500" />
        )}
      </nav>

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems(menu.node)} onClose={() => setMenu(null)} />
      )}
    </aside>
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
      <span className="w-4 text-center text-xs leading-none" aria-hidden="true">
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
