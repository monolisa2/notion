'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/errors';
import { archivePages, convertPageType, setPageSpace, setPinned, toggleFavorite } from '@/lib/pages';
import { ancestorIds, buildTree, collectSubtreeIds, findNode } from '@/lib/tree';
import { changeableUnitsFor, unitLabel } from '@/lib/org';
import type { OrgUnitRow, PageRow, PageVisibility } from '@/lib/types';
import { useTree } from '@/components/tree-context';

const VIS_LABEL: Record<PageVisibility, string> = { 본부: '본부 전체', 소속: '소속 조직만', 개인: '나만 봄' };

/**
 * 페이지 상단 (노션식): 브레드크럼(공간 › 상위 페이지 › 현재) · 공개 범위 · ⋯ 메뉴
 */
export function PageHeader({
  page,
  units,
  isAdmin = false,
  meId,
  meUnitId = null,
  isFavorite = false,
}: {
  page: PageRow;
  units: OrgUnitRow[];
  isAdmin?: boolean;
  meId?: string;
  meUnitId?: string | null;
  isFavorite?: boolean;
}) {
  const [fav, setFav] = useState(isFavorite);
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { rows } = useTree();
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const tree = useMemo(() => buildTree(rows), [rows]);
  const crumbs = useMemo(
    () => ancestorIds(tree, page.id).map((id) => findNode(tree, id)).filter(Boolean),
    [tree, page.id],
  );
  const isRoot = page.parent_id === null;
  const isPersonal = page.visibility === '개인';
  const isTask = page.type === 'task';
  const spaceName = isPersonal ? '개인 메모' : unitLabel(units, page.unit_id) || '공간 미지정';
  // 옮긴 뒤에도 내가 볼 수 있는 공간만 선택지로 (RLS 가 그 밖의 이동을 거부한다)
  const spaceOptions = useMemo(() => {
    const list = changeableUnitsFor(units, meUnitId, isAdmin);
    // 현재 공간이 목록에 없으면(예: 다른 실 페이지) 표시용으로만 포함
    if (page.unit_id && !list.some((u) => u.id === page.unit_id)) {
      const cur = units.find((u) => u.id === page.unit_id);
      if (cur) return [cur, ...list];
    }
    return list;
  }, [units, meUnitId, isAdmin, page.unit_id]);

  const apply = async (label: string, fn: () => Promise<void>, after?: () => void) => {
    setBusy(true);
    setMenuOpen(false);
    try {
      await fn();
      after?.();
      router.refresh();
    } catch (e) {
      const msg = errorMessage(e);
      toast.error(
        msg.includes('row-level security')
          ? `${label} 실패: 이 공간·공개 범위로 바꿀 권한이 없습니다 (바꾼 뒤 내가 볼 수 없게 되는 설정)`
          : `${label} 실패: ${msg}`,
      );
    } finally {
      setBusy(false);
    }
  };

  const archive = () => {
    const node = findNode(tree, page.id);
    const ids = node ? collectSubtreeIds(node) : [page.id];
    const ok = ids.length === 1 || window.confirm(`하위 페이지 ${ids.length - 1}개도 함께 보관됩니다. 계속할까요?`);
    if (!ok) return;
    void apply('보관', () => archivePages(supabase, ids), () => {
      toast.success('보관했습니다');
      router.push('/');
    });
  };

  const sel = 'rounded-md px-1.5 py-0.5 text-xs text-zinc-600 outline-none hover:bg-zinc-100';

  return (
    <div className="sticky top-0 z-10 flex items-center gap-1 border-b border-transparent bg-white/90 px-4 py-2 text-[13px] text-zinc-500 backdrop-blur sm:px-6">
      {/* 브레드크럼 */}
      <nav className="flex min-w-0 items-center gap-1 overflow-hidden" aria-label="경로">
        <span className="shrink-0 rounded px-1 py-0.5 text-zinc-500">{spaceName}</span>
        {crumbs.map((c) => (
          <span key={c!.id} className="flex min-w-0 items-center gap-1">
            <span className="text-zinc-300">/</span>
            <Link href={`/p/${c!.id}`} className="truncate rounded px-1 py-0.5 hover:bg-zinc-100 hover:text-zinc-800">
              {c!.icon ? `${c!.icon} ` : ''}{c!.title}
            </Link>
          </span>
        ))}
        <span className="text-zinc-300">/</span>
        <span className="truncate rounded px-1 py-0.5 text-zinc-800">
          {page.icon ? `${page.icon} ` : ''}{page.title}
        </span>
        {page.pinned && <span className="ml-1 shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800">📌 공지</span>}
      </nav>

      <span className="ml-auto" />

      {/* 공개 범위 (루트만 변경) */}
      {isPersonal ? (
        <span className="rounded-md px-1.5 py-0.5 text-xs text-zinc-500">🔒 나만 봄</span>
      ) : isRoot ? (
        <>
          <select
            value={page.unit_id ?? ''}
            disabled={busy}
            onChange={(e) => void apply('공간 변경', () => setPageSpace(supabase, page.id, { unitId: e.target.value || null }))}
            className={sel}
            aria-label="공간"
            title="이 페이지가 속한 공간"
          >
            {spaceOptions.map((u) => (
              <option key={u.id} value={u.id ?? ''}>{u.name}</option>
            ))}
          </select>
          <select
            value={page.visibility}
            disabled={busy}
            onChange={(e) => void apply('공개 범위 변경', () => setPageSpace(supabase, page.id, { visibility: e.target.value as PageVisibility }))}
            className={sel}
            aria-label="공개 범위"
          >
            <option value="본부">{VIS_LABEL.본부}</option>
            <option value="소속">{VIS_LABEL.소속}</option>
          </select>
        </>
      ) : (
        <span className="rounded-md px-1.5 py-0.5 text-xs text-zinc-400" title="상위 페이지의 공간·공개 범위를 따릅니다">
          {VIS_LABEL[page.visibility as PageVisibility] ?? page.visibility}
        </span>
      )}

      <span className="hidden text-xs text-zinc-400 sm:inline">수정 {page.updated_at.slice(0, 10)}</span>

      {meId && (
        <button
          type="button"
          aria-label={fav ? '즐겨찾기 해제' : '즐겨찾기'}
          title={fav ? '즐겨찾기 해제' : '즐겨찾기에 추가 (사이드바 상단)'}
          onClick={() => {
            const next = !fav;
            setFav(next);
            toggleFavorite(supabase, meId, page.id, next)
              .then(() => router.refresh())
              .catch((e) => {
                setFav(!next);
                toast.error(`즐겨찾기 실패: ${errorMessage(e)}`);
              });
          }}
          className={`flex h-7 w-7 items-center justify-center rounded-md hover:bg-zinc-100 ${fav ? 'text-amber-500' : 'text-zinc-400'}`}
        >
          {fav ? '★' : '☆'}
        </button>
      )}

      {/* ⋯ 메뉴 */}
      <div className="relative">
        <button
          type="button"
          aria-label="페이지 메뉴"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100"
        >
          ⋯
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onMouseDown={() => setMenuOpen(false)} />
            <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-zinc-200 bg-white p-1 text-sm shadow-lg">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  // 회의록·공지·주간 정리를 업무로 바꾸면 진행 로그·진행률이 붙는다 — 실수 방지
                  const formDoc = ['meeting', 'notice', 'weekly', 'guide'].includes(page.template ?? '');
                  if (!isTask && formDoc && !window.confirm('이 문서를 업무로 바꾸면 담당자·진행률·진행 로그가 붙습니다. 계속할까요?')) return;
                  void apply('전환', () => convertPageType(supabase, page.id, isTask ? 'doc' : 'task'));
                }}
                className="block w-full rounded-md px-3 py-1.5 text-left hover:bg-zinc-100"
              >
                {isTask ? '문서로 전환' : '업무로 전환'}
              </button>
              {isAdmin && !isPersonal && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void apply('공지 고정', () => setPinned(supabase, page.id, !page.pinned))}
                  className="block w-full rounded-md px-3 py-1.5 text-left hover:bg-zinc-100"
                >
                  {page.pinned ? '공지 고정 해제' : '공지로 고정 (홈 상단)'}
                </button>
              )}
              <button type="button" role="menuitem" onClick={archive} className="block w-full rounded-md px-3 py-1.5 text-left text-red-600 hover:bg-zinc-100">
                보관
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
