'use client';

import { useEffect, useState } from 'react';

/** html.dark 클래스를 지켜보는 훅 — BlockNote·Toaster 처럼 클래스를 못 읽는 라이브러리용 */
export function useIsDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setDark(el.classList.contains('dark'));
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);
  return dark;
}

/**
 * 밝은/다크 모드 토글. 선호는 쿠키(theme)로 저장해 서버 렌더 때부터 적용된다
 * (localStorage 는 업무 데이터 금지 규칙과 별개로, SSR 깜빡임 때문에 쿠키 사용).
 */
export function ThemeToggle({ className }: { className?: string }) {
  const dark = useIsDark();
  const toggle = () => {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    document.cookie = `theme=${next ? 'dark' : 'light'}; path=/; max-age=31536000; samesite=lax`;
  };
  return (
    <button type="button" onClick={toggle} className={className}>
      {dark ? '☀️ 밝은 모드' : '🌙 다크 모드'}
    </button>
  );
}
