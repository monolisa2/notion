/**
 * 기본 프로필 이미지 — 사진을 안 올려도 고를 수 있게.
 *
 * 왜 SVG data URL 인가:
 *   `profiles.avatar_url` 에 그대로 넣으면 사이드바·댓글·업무 목록·멘션 등
 *   **이미 아바타를 그리는 모든 자리가 손대지 않고 그대로 동작한다.**
 *   버킷에 파일을 올리지 않으니 용량(1GB 한도)도 안 먹고, 나중에 지울 것도 없다.
 *
 * 두 종류를 준다:
 *   · 그림  — 선으로 직접 그린 도형. 어떤 기기에서도 똑같이 보인다.
 *   · 이모지 — SVG 안의 글자라 기기 글꼴로 그려진다. 헤드리스 크로뮴에서
 *             컬러로 정상 렌더되는 것을 확인했고, 고르는 화면에서 실제 모습을
 *             그대로 미리 보여주므로 안 보이면 사용자가 안 고르면 된다.
 */

/** 배경색 — 부드러운 파스텔 + 검정 하나 */
const TONES = [
  { key: 'slate', bg: '#e2e8f0', fg: '#475569', label: '회색' },
  { key: 'blue', bg: '#dbeafe', fg: '#2563eb', label: '파랑' },
  { key: 'teal', bg: '#ccfbf1', fg: '#0d9488', label: '청록' },
  { key: 'green', bg: '#dcfce7', fg: '#16a34a', label: '초록' },
  { key: 'amber', bg: '#fef3c7', fg: '#d97706', label: '노랑' },
  { key: 'rose', bg: '#ffe4e6', fg: '#e11d48', label: '분홍' },
  { key: 'violet', bg: '#ede9fe', fg: '#7c3aed', label: '보라' },
  { key: 'stone', bg: '#3f3f46', fg: '#fafafa', label: '검정' },
] as const;

/** 가운데 그림 — 전부 선/면으로만 (글꼴에 기대지 않음) */
const SHAPES = [
  {
    key: 'person',
    label: '사람',
    body: '<circle cx="24" cy="19" r="7.5"/><path d="M10.5 39c0-6.9 6-11.5 13.5-11.5S37.5 32.1 37.5 39z"/>',
  },
  {
    key: 'smile',
    label: '웃는 얼굴',
    body:
      '<circle cx="24" cy="24" r="13" fill="none" stroke="currentColor" stroke-width="2.6"/>' +
      '<circle cx="19.5" cy="21" r="1.9"/><circle cx="28.5" cy="21" r="1.9"/>' +
      '<path d="M18 28.5c1.7 2.2 3.7 3.3 6 3.3s4.3-1.1 6-3.3" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
  },
  {
    key: 'cat',
    label: '고양이',
    body:
      '<path d="M13 16l1.5-6 5.5 4zM35 16l-1.5-6-5.5 4z"/>' +
      '<circle cx="24" cy="25" r="11" fill="none" stroke="currentColor" stroke-width="2.6"/>' +
      '<circle cx="20" cy="23.5" r="1.7"/><circle cx="28" cy="23.5" r="1.7"/>' +
      '<path d="M24 28v2M24 30c-1.2 1.4-3 1.4-4 .4M24 30c1.2 1.4 3 1.4 4 .4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  },
  {
    key: 'sprout',
    label: '새싹',
    body:
      '<path d="M24 38V21" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>' +
      '<path d="M23 24c0-6.5-4.2-10.5-10.5-10.5C12.5 20 16.7 24 23 24z"/>' +
      '<path d="M25 20c0-6.5 4.2-10.5 10.5-10.5C35.5 16 31.3 20 25 20z"/>',
  },
  {
    key: 'coffee',
    label: '커피',
    body:
      '<path d="M13 17h20v10a8 8 0 0 1-8 8h-4a8 8 0 0 1-8-8z" fill="none" stroke="currentColor" stroke-width="2.6"/>' +
      '<path d="M33 20h3a4 4 0 0 1 0 8h-3" fill="none" stroke="currentColor" stroke-width="2.6"/>' +
      '<path d="M19 9v4M25 9v4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  },
  {
    key: 'book',
    label: '책',
    body:
      '<path d="M11 13h10a4 4 0 0 1 4 4v19a4 4 0 0 0-4-3H11zM37 13H27a4 4 0 0 0-4 4v19a4 4 0 0 1 4-3h10z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>',
  },
  { key: 'star', label: '별', body: '<path d="M24 11l4.2 8.6 9.4 1.4-6.8 6.7 1.6 9.5L24 32.7l-8.4 4.5 1.6-9.5-6.8-6.7 9.4-1.4z"/>' },
  { key: 'mountain', label: '산', body: '<path d="M8 35l10-15 6 8.5 5-7 11 13.5z"/><circle cx="34" cy="15" r="3.5"/>' },
] as const;

/** 이모지 — 배경색만 고르면 된다 */
const EMOJIS = [
  '🙂', '😄', '😎', '🤓', '🙌', '👋',
  '🐱', '🐶', '🐰', '🐻', '🦊', '🐧',
  '🌱', '🌸', '🌊', '⛰️', '☕', '🍀',
  '📚', '📝', '📊', '🎯', '⭐', '🔥',
] as const;

export type PresetAvatar = { key: string; label: string; url: string };
export type ToneKey = (typeof TONES)[number]['key'];

function wrap(bg: string, inner: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">` +
    `<rect width="48" height="48" rx="24" fill="${bg}"/>${inner}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const toneOf = (key: string) => TONES.find((t) => t.key === key) ?? TONES[0];

/** 그림 하나의 이미지 주소 */
export function shapeAvatarUrl(shapeKey: string, toneKey: string): string {
  const tone = toneOf(toneKey);
  const shape = SHAPES.find((s) => s.key === shapeKey) ?? SHAPES[0];
  return wrap(tone.bg, `<g fill="${tone.fg}" color="${tone.fg}">${shape.body}</g>`);
}

/** 이모지 하나의 이미지 주소 */
export function emojiAvatarUrl(emoji: string, toneKey: string): string {
  const tone = toneOf(toneKey);
  return wrap(
    tone.bg,
    `<text x="24" y="34" font-size="26" text-anchor="middle">${emoji}</text>`,
  );
}

export const PRESET_TONES = TONES.map((t) => ({ key: t.key, label: t.label, bg: t.bg, fg: t.fg }));
export const PRESET_SHAPES = SHAPES.map((s) => ({ key: s.key, label: s.label }));
export const PRESET_EMOJIS = [...EMOJIS];

/** 우리가 만든 기본 이미지인가 (버킷 파일 정리 대상에서 빼기 위해) */
export function isPresetAvatar(url: string | null): boolean {
  return !!url && url.startsWith('data:image/svg+xml,');
}
