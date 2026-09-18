/**
 * 새 페이지 양식(템플릿). 노션의 회의록·업무 템플릿 구조를 조사해 고정 양식으로 만들었다.
 *   회의록: 회의 정보 → 안건 → 논의 → 결정 사항 → 액션 아이템(담당·기한) — "결정과 액션에 책임자가 있어야 기록이 된다"
 * BlockNote 블록 JSON 을 그대로 pages.content 에 넣는다.
 */
import type { PageType } from './types';

type Inline = string | { type: 'text'; text: string; styles: Record<string, boolean> };
type Block = {
  type: string;
  props?: Record<string, unknown>;
  content?: Inline[];
  children?: Block[];
};

const b = (text: string, bold = false): Inline => ({ type: 'text', text, styles: bold ? { bold: true } : {} });
const p = (...content: Inline[]): Block => ({ type: 'paragraph', content });
const h = (level: 1 | 2 | 3, text: string): Block => ({ type: 'heading', props: { level }, content: [b(text)] });
const bullet = (text: string): Block => ({ type: 'bulletListItem', content: [b(text)] });
const num = (text: string): Block => ({ type: 'numberedListItem', content: [b(text)] });
const check = (text: string): Block => ({ type: 'checkListItem', props: { checked: false }, content: [b(text)] });
const quote = (text: string): Block => ({ type: 'quote', content: [b(text)] });
const divider = (): Block => ({ type: 'divider' });
const field = (label: string, value = ''): Block => p(b(`${label}  `, true), b(value));

export type Template = {
  key: string;
  icon: string;
  name: string;
  description: string;
  type: PageType;
  title: (today: string) => string;
  content: (ctx: { author: string; today: string }) => Block[];
};

export const TEMPLATES: Template[] = [
  {
    key: 'blank',
    icon: '📄',
    name: '빈 페이지',
    description: '자유롭게 시작. / 를 입력하면 블록 메뉴, @ 로 동료 언급',
    type: 'doc',
    title: () => '제목 없음',
    content: () => [p()],
  },
  {
    key: 'meeting',
    icon: '📝',
    name: '회의록',
    description: '회의 정보 · 안건 · 논의 · 결정 사항 · 액션 아이템',
    type: 'doc',
    title: (today) => `회의록 ${today}`,
    content: ({ author, today }) => [
      field('일시', `${today} 00:00 ~ 00:00`),
      field('장소 / 방식', '회의실 · 대면'),
      field('참석자', '@ 로 참석자를 언급하세요'),
      field('기록', author),
      divider(),
      h(2, '안건'),
      num('첫 번째 안건'),
      num('두 번째 안건'),
      h(2, '논의 내용'),
      bullet('안건별로 3~5줄. 대화보다 결정과 할 일을 우선 기록'),
      h(2, '결정 사항'),
      bullet('무엇을 하기로 했나 — 누가 결정'),
      h(2, '액션 아이템'),
      check('할 일 — 담당자(@언급) — 기한 YYYY-MM-DD'),
      check('할 일 — 담당자 — 기한'),
      quote('액션 아이템은 페이지를 우클릭해 "업무로 전환"하거나, 업무 목록에서 업무로 만들어 담당자·기한을 붙이세요.'),
    ],
  },
  {
    key: 'task',
    icon: '☑',
    name: '업무',
    description: '상태·담당자·진행률·기한이 붙는 업무 페이지',
    type: 'task',
    title: () => '새 업무',
    content: () => [
      h(2, '목적'),
      p(b('이 업무가 끝나면 무엇이 달라지나')),
      h(2, '할 일'),
      check('첫 단계'),
      check('두 번째 단계'),
      h(2, '참고'),
      bullet('관련 페이지 · 자료 링크'),
      quote('진행 상황은 하단 "진행 기록"에 한 줄씩. 상태·진행률이 따라 바뀝니다.'),
    ],
  },
  {
    key: 'notice',
    icon: '📢',
    name: '공지',
    description: '본부·팀 공지. 대상 · 기한 · 내용',
    type: 'doc',
    title: (today) => `[공지] ${today}`,
    content: ({ today }) => [
      field('대상', '경영관리본부 전체'),
      field('기한 / 일정', today),
      field('문의', '담당자 @언급'),
      divider(),
      h(2, '내용'),
      p(b('공지 내용을 적으세요.')),
      h(2, '요청 사항'),
      check('해야 할 것이 있으면 체크리스트로'),
    ],
  },
  {
    key: 'weekly',
    icon: '🗓',
    name: '주간 정리',
    description: '이번 주 한 일 · 다음 주 계획 · 이슈',
    type: 'doc',
    title: (today) => `주간 정리 ${today}`,
    content: () => [
      h(2, '이번 주 한 일'),
      bullet(''),
      h(2, '다음 주 계획'),
      bullet(''),
      h(2, '이슈 / 도움 필요'),
      bullet(''),
    ],
  },
];

export function todayStr() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 페이지 아이콘으로 고를 수 있는 이모지 (노션처럼 클릭 한 번) */
export const ICON_CHOICES = [
  '📄', '📝', '☑', '📢', '🗓', '📁', '📊', '💡', '🎯', '🔧', '💰', '🧾', '🧮', '🏢', '👥', '🤝',
  '📌', '⭐', '🚀', '✅', '⚠️', '🔒', '📎', '🗂', '🧹', '🌱', '🏗', '🧑‍💼', '📚', '🗒', '🔔', '🎉',
];
