'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type BoardDrag = { id: string; label: string; x: number; y: number; w: number };

/**
 * 칸반 카드 드래그를 마우스(포인터) 이벤트로 직접 구현한다.
 * HTML5 drag&drop 은 카드 안의 <a> 가 네이티브 링크 드래그를 가로채 브라우저·입력장치에 따라
 * 동작하지 않는 경우가 있어 쓰지 않는다. 6px 이상 움직이면 드래그로 판정하고,
 * 그 미만이면 클릭(링크 이동)으로 처리한다.
 */
export function useBoardDrag(onDrop: (id: string, columnKey: string) => void) {
  const [drag, setDrag] = useState<BoardDrag | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const columns = useRef(new Map<string, HTMLElement>());
  const session = useRef<{ id: string; label: string; sx: number; sy: number; w: number; active: boolean } | null>(null);
  const suppressClick = useRef(false);
  const onDropRef = useRef(onDrop);
  useEffect(() => {
    onDropRef.current = onDrop;
  }, [onDrop]);

  // 드래그 중 텍스트 선택 방지
  useEffect(() => {
    if (!drag) return;
    document.body.classList.add('select-none');
    return () => document.body.classList.remove('select-none');
  }, [drag]);

  const registerColumn = (key: string) => (el: HTMLElement | null) => {
    if (el) columns.current.set(key, el);
    else columns.current.delete(key);
  };

  const hitTest = (x: number, y: number): string | null => {
    for (const [key, el] of columns.current) {
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return key;
    }
    return null;
  };

  /** 카드에 onPointerDown={startDrag(id, 제목)} 으로 단다 */
  const startDrag = (id: string, label: string) => (e: React.PointerEvent) => {
    if (e.button !== 0) return; // 좌클릭만
    const width = (e.currentTarget as HTMLElement).getBoundingClientRect().width;
    session.current = { id, label, sx: e.clientX, sy: e.clientY, w: width, active: false };

    const move = (ev: PointerEvent) => {
      const st = session.current;
      if (!st) return;
      if (!st.active) {
        if (Math.hypot(ev.clientX - st.sx, ev.clientY - st.sy) < 6) return;
        st.active = true;
        suppressClick.current = true; // 드래그였으면 뒤따르는 클릭(링크 이동)을 막는다
      }
      ev.preventDefault();
      setDrag({ id: st.id, label: st.label, x: ev.clientX, y: ev.clientY, w: st.w });
      setOver(hitTest(ev.clientX, ev.clientY));
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const st = session.current;
      session.current = null;
      if (st?.active) {
        const target = hitTest(ev.clientX, ev.clientY);
        if (target) onDropRef.current(st.id, target);
      }
      setDrag(null);
      setOver(null);
      setTimeout(() => {
        suppressClick.current = false;
      }, 0);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  /** 카드 안 <Link> 에 onClickCapture 로 단다 (드래그 후 클릭 이동 방지) */
  const suppressClickCapture = (e: React.MouseEvent) => {
    if (suppressClick.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return { drag, over, registerColumn, startDrag, suppressClickCapture };
}

/** 커서를 따라다니는 카드 잔상 */
export function BoardDragGhost({ drag }: { drag: BoardDrag }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      style={{ position: 'fixed', left: drag.x + 10, top: drag.y + 8, width: drag.w, zIndex: 1000, pointerEvents: 'none' }}
      className="rotate-1 rounded-lg border border-blue-300 bg-white px-2.5 py-2 text-sm shadow-xl"
      aria-hidden="true"
    >
      {drag.label}
    </div>,
    document.body,
  );
}
