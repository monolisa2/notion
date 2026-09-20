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
/** 빈 제목 3 블록 — 새 페이지의 기본 시작점 */
const h3 = (): Block => ({ type: 'heading', props: { level: 3 }, content: [] });
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
    description: '제목 3 으로 시작. / 를 입력하면 블록 메뉴, @ 로 동료 언급',
    type: 'doc',
    title: () => '제목 없음',
    content: () => [h3(), p()],
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
      h(3, '안건'),
      num('첫 번째 안건'),
      num('두 번째 안건'),
      h(3, '논의 내용'),
      bullet('안건별로 3~5줄. 대화보다 결정과 할 일을 우선 기록'),
      h(3, '결정 사항'),
      bullet('무엇을 하기로 했나 — 누가 결정'),
      h(3, '액션 아이템'),
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
      h(3, '목적'),
      p(b('이 업무가 끝나면 무엇이 달라지나')),
      h(3, '할 일'),
      check('첫 단계'),
      check('두 번째 단계'),
      h(3, '참고'),
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
      h(3, '내용'),
      p(b('공지 내용을 적으세요.')),
      h(3, '요청 사항'),
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
      h(3, '이번 주 한 일'),
      bullet(''),
      h(3, '다음 주 계획'),
      bullet(''),
      h(3, '이슈 / 도움 필요'),
      bullet(''),
    ],
  },
  {
    key: 'guide',
    icon: '📖',
    name: 'TeamHub 사용법 안내',
    description: '처음 오신 분들께 — 본부 공용에 만들어 공지로 고정하세요',
    type: 'doc',
    title: () => 'TeamHub 3분 사용법',
    content: () => [
      quote('처음 오셨나요? 이 페이지만 읽으면 오늘부터 쓸 수 있습니다. (3분)'),
      h(3, '1. 여기는 무엇을 하는 곳인가'),
      p(b('업무 진행 상황을 공유하고, 회의록·자료·공지를 한곳에 모아 두는 우리 본부 공간입니다. ')),
      bullet('사이드바의 "○○ 공용"은 본부 전체가, "내 소속" 공간은 우리 조직이 쓰는 곳'),
      bullet('개인 메모는 나만 보는 공간'),
      h(3, '2. 페이지 만들기'),
      bullet('사이드바에서 공간 이름에 마우스를 올리면 나오는 ＋ 를 누르면 양식 선택(빈 페이지/회의록/업무/공지/주간 정리)'),
      bullet('본문에서 / 를 입력하면 블록 메뉴(제목·표·체크리스트·이미지), @ 를 입력하면 동료 언급'),
      bullet('@ 목록 맨 위에는 조직(실·팀)이 있습니다 — 고르면 그 조직 전원에게 한 번에 알림'),
      bullet('페이지 안에 페이지를 계속 만들 수 있고, 드래그로 옮길 수 있습니다'),
      bullet('제목 위 아이콘 자리를 누르면 이모지를 고를 수 있습니다 — "회의" "예산" 처럼 한글로 검색'),
      h(3, '3. 업무와 진행 로그 — 제일 중요'),
      bullet('업무 페이지 상단에서 상태·담당자·참여자·기한을 정합니다'),
      bullet('일이 진행되면 페이지 아래 "진행 로그"에 한 줄 남기세요 — 한 일 / 다음 할 일'),
      bullet('진행률(%)은 로그를 남기면서만 바뀝니다. 누가 언제 왜 바꿨는지 자동으로 남아요'),
      bullet('하위 업무가 있는 업무의 진행률은 하위 업무들의 평균으로 자동 계산됩니다'),
      bullet('막힌 게 있으면 "막힘 기록"으로 — 대시보드에 빨갛게 떠서 도와줄 사람이 봅니다'),
      h(3, '4. 찾아보기'),
      bullet('어디서든 Ctrl+K (맥은 ⌘K) — 페이지 이름을 두어 글자 치면 바로 이동'),
      bullet('업무: 테이블 / 칸반(드래그로 상태 변경) / 타임라인'),
      bullet('캘린더: 기한과 회의 일정을 달력으로'),
      bullet('공지: 지금 게시 중인 공지를 한곳에 (안 읽은 것은 "새 공지" 로 표시 · 이 안내도 여기 있습니다)'),
      bullet('모아보기: 회의록·주간 정리를 조직·기간별로'),
      bullet('주간 모아보기: 지난 7일 동안 각자 남긴 로그를 사람별로 — 주간회의는 이 화면으로'),
      bullet('검색: 사이드바 맨 위 (제목·본문 전체)'),
      h(3, '5. 알림과 내 계정'),
      bullet('누가 나를 @멘션하거나, 업무를 배정하거나, 기한이 다가오면 사이드바 🔔에 표시됩니다'),
      bullet('공지는 사이드바 📢 공지 > "＋ 공지 쓰기" — 양식과 게시가 한 번에 됩니다 (관리자)'),
      bullet('공지 페이지에서 "📢 알림 보내기" 를 누르면 볼 수 있는 분들께 알림이 갑니다'),
      bullet('왼쪽 위 내 이름 옆 ⋯ > 내 계정 — 프로필 이미지, 이름, 알림 받을 종류를 직접 정합니다'),
      bullet('사진이 없어도 됩니다 — "기본 이미지 고르기" 에서 그림이나 이모지를 고르면 끝'),
      bullet('담당자가 아니어도 "참여자" 로 들어가 있으면 홈의 내 업무에 같이 나옵니다'),
      h(3, '자주 묻는 것'),
      bullet('비밀번호를 잊었다 → 관리자(인사관리실)에게 초기화 요청'),
      bullet('파일은 50MB까지 첨부, 그보다 크면 링크로'),
      bullet('지운 페이지는 보관함에서 복구할 수 있습니다'),
      bullet('본문을 잘못 고쳤다 → 페이지 오른쪽 위 ⋯ > 본문 기록 · 되돌리기 (최근 30개 버전)'),
      bullet('같은 페이지를 다른 사람이 동시에 고치면 위에 경고가 뜹니다 — 그때는 새로 불러오고 쓰세요'),
      p(b('막히면 언제든 인사관리실에 물어보세요. 🙂')),
    ],
  },
];

/** 새 페이지 대화상자에 보여줄 양식 — 사용법 안내는 한 번만 만들면 되므로 제외 */
export const NEW_PAGE_TEMPLATES = TEMPLATES.filter((t) => t.key !== 'guide');

export function todayStr() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
