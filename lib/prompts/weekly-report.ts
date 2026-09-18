/**
 * 주간보고 초안 프롬프트. 재료는 weekly_digest() / silent_members() 결과만 쓴다.
 * 모델이 없는 사실을 만들지 않게 "주어진 로그 밖의 내용은 쓰지 말 것"을 명시한다.
 */
import type { Database } from '@/types/db';

type Fn = Database['public']['Functions'];
export type DigestRow = Fn['weekly_digest']['Returns'][number];
export type SilentRow = Fn['silent_members']['Returns'][number];

export const WEEKLY_REPORT_SYSTEM = `당신은 팀 업무 현황 도구 TeamHub 의 주간보고 작성 보조자입니다.
입력으로 지난 기간의 진행 로그(담당자별·업무별로 묶인 원문)와 미입력자 명단을 받습니다.

원칙
- 주어진 로그에 없는 사실·수치·계획을 만들어 쓰지 않습니다. 추정이 필요하면 "(추정)" 을 붙입니다.
- 한국어, 간결한 업무 문체("~함", "~중")를 씁니다. 존칭·인사말·서론은 쓰지 않습니다.
- 진행률과 상태는 로그의 값을 그대로 씁니다.
- blocker(막힘) 는 원문을 살려 옮기고, 누가 무엇을 기다리는지 드러나게 씁니다.
- 미입력자는 반드시 이름을 명시합니다. 이것이 입력률을 끌어올리는 장치입니다.

출력은 아래 마크다운 구조를 그대로 따릅니다. 제목(#)은 쓰지 않고 ## 부터 시작합니다.

## 팀 전체 요약
- 3~5줄. 이번 기간 핵심 성과, 주요 리스크, 전체 분위기.

## 담당자별 진행
### {담당자 이름}
- {업무 제목} — {상태}, {진행률}%
  - 주요 진행 내용을 1~3줄로 요약
(담당자마다 반복. 로그를 남긴 사람 기준으로 묶는다)

## 막힌 사항
- {업무 제목} ({담당자}): {막힘 내용 원문 요약} → 필요한 조치/대상
(없으면 "- 없음")

## 다음 주 예정
- 로그에서 "예정", "다음", "내일", "~할 것" 등으로 드러난 항목만. 없으면 "- 로그에 명시된 예정 사항 없음"

## 미입력자
- 이번 기간 진행 로그를 한 건도 남기지 않은 담당자. "이름 (진행 중 업무 N건, 마지막 기록 YYYY-MM-DD 또는 없음)" 형식.
(없으면 "- 전원 입력 완료 👍")`;

export function buildWeeklyReportPrompt(params: {
  digest: DigestRow[];
  silent: SilentRow[];
  days: number;
  from: string;
  to: string;
}): string {
  const { digest, silent, days, from, to } = params;

  const byAuthor = new Map<string, DigestRow[]>();
  for (const row of digest) {
    const list = byAuthor.get(row.author_name) ?? [];
    list.push(row);
    byAuthor.set(row.author_name, list);
  }

  const lines: string[] = [];
  lines.push(`기간: ${from} ~ ${to} (최근 ${days}일)`);
  lines.push('');
  lines.push('=== 진행 로그 (작성자별) ===');
  if (byAuthor.size === 0) lines.push('(이 기간에 남겨진 진행 로그가 없습니다)');
  for (const [author, rows] of byAuthor) {
    lines.push('');
    lines.push(`# ${author}`);
    for (const r of rows) {
      lines.push(`## 업무: ${r.page_title} | 상태: ${r.page_status ?? '-'} | 진행률: ${r.progress ?? 0}% | 담당자: ${r.assignee_name}`);
      lines.push('로그:');
      lines.push(r.updates);
      if (r.blockers) {
        lines.push('막힘:');
        lines.push(r.blockers);
      }
    }
  }
  lines.push('');
  lines.push('=== 미입력자 (진행 중 업무가 있는데 이 기간 로그 0건) ===');
  if (silent.length === 0) lines.push('(없음)');
  for (const s of silent) {
    lines.push(`- ${s.name} / 진행 중 업무 ${s.open_tasks}건 / 마지막 기록 ${s.last_log_at ? s.last_log_at.slice(0, 10) : '없음'}`);
  }
  lines.push('');
  lines.push('위 재료로 주간보고 초안을 작성해 주세요.');
  return lines.join('\n');
}
