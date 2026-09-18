# TeamHub — 팀 업무 현황 협업 도구

Claude Code 는 이 파일을 매 세션 자동으로 읽는다. 작업 전 반드시 준수할 것.

---

## 1. 이 프로젝트가 무엇인가

노션 클론이 **아니다.** 노션이 못 하는 것을 만든다.

> 누가 무엇을 하고 있고, 오늘 무엇을 했고, 어디서 막혀 있는지를
> 팀 전원이 30초 안에 입력하고 한 화면에서 보는 도구.

노션은 "현재 상태"만 보여준다. 이 도구는 **"어떻게 여기까지 왔는지"**(`page_updates`)를
보여주고, 그 로그를 재료로 주간보고를 자동 생성한다. 이게 유일한 차별점이다.
`page_updates` 관련 기능을 깎아내는 제안은 하지 말 것.

**범위: 팀 단위 파일럿 (10~15명).** 전사 확장은 지금 고려하지 않는다.

---

## 2. 기술 스택 (변경 금지)

| 영역 | 선택 | 비고 |
|---|---|---|
| 프레임워크 | Next.js (App Router) + TypeScript | |
| DB / Auth / Realtime | Supabase | |
| 에디터 | **BlockNote** | 노션 UI 가 거의 그대로 딸려 옴 |
| 스타일 | Tailwind CSS | |
| 배포 | Vercel | |
| 외부 알림 | 네이버웍스 봇 API (Supabase Edge Function) | |

---

## 3. 데이터 모델 핵심 3가지

### (1) 모든 것이 페이지다
`pages` 하나로 문서와 업무를 모두 표현한다. `type = 'doc' | 'task'`.
업무는 속성(status/assignee/progress/due_date)이 붙은 페이지일 뿐이다.
`projects` 같은 별도 테이블을 만들지 말 것. 무한 중첩이 막힌다.

### (2) 무한 중첩 = parent_id + ltree path
- `parent_id` 가 진실의 원천, `path` 는 조회 성능용 캐시
- **`path` 를 애플리케이션에서 직접 쓰지 말 것.** 트리거가 관리한다
- UUID 의 하이픈은 ltree 라벨로 못 쓴다 → `replace(id::text,'-','_')`. 이미 처리됨
- 페이지 이동은 `move_page(page_id, parent_id, after_id)` RPC 만 사용
- 사이드바 트리는 `v_page_tree` 를 `path` 순으로 한 번에 받아 클라이언트에서 조립

### (3) 블록 중첩은 직접 만들지 않는다
페이지 중첩(하위 페이지)과 블록 중첩(문단 안의 문단)은 다른 문제다.
후자는 직접 구현 시 수개월이 걸린다. BlockNote 에 전부 위임하고,
본문은 `pages.content` JSONB 에 통째로 저장한다.
드래그 재정렬·슬래시 커맨드·되돌리기 스택을 직접 구현하지 말 것.

---

## 4. 절대 하지 말 것

- **CRDT / 실시간 공동편집 구현 금지.** Yjs, 커서 공유, OT 전부 범위 밖.
  필드 단위 자동저장 + "○○님이 방금 수정함" 배너 + optimistic UI 로 충분하다.
- **`localStorage` 에 업무 데이터 저장 금지.** 진실의 원천은 항상 Supabase.
- **`page_updates` 에 UPDATE / DELETE 금지.** append-only. 오기재는 새 로그로 정정.
  (RLS 에 해당 정책이 아예 없다. 우회하려 하지 말 것)
- **`@팀전체` 그룹 멘션 금지.** 한 번 남용되면 전원이 알림을 꺼버린다.
- **뷰 생성 시 `security_invoker = true` 누락 금지.** 빠지면 RLS 우회 구멍이 된다.
- 조직 정보(회사/본부/팀)를 `profiles` 에 하드코딩 금지 → `org_snapshots` 사용.
  10월 합병으로 소속이 전부 바뀌기 때문이다.

---

## 5. 멘션(사람 태그) 규칙

- 저장 형태는 **user id**. `"@신민철"` 문자열 저장 금지 (동명이인·개명 시 붕괴)
- 본문 JSON 안에만 두면 "나를 언급한 글 모아보기"가 불가능 → `mentions` 테이블에 색인
- 동기화는 **반드시 diff 방식** (`sync_page_mentions` RPC).
  전체 삭제 후 재삽입하면 이미 읽은 알림이 '안 읽음'으로 되돌아간다
- 알림 피로 방지 2종은 필수:
  - 자기 자신 멘션 → 알림 없음
  - 같은 페이지 5분 내 반복 멘션 → 1건으로 묶음
  (둘 다 `enqueue_notification` 에 구현됨. 이 함수를 우회해 직접 INSERT 하지 말 것)
- 멘션과 담당자 지정은 목적이 다르므로 문구를 분리한다
  - 담당자 지정 → "○○ 업무가 회원님께 배정되었습니다"
  - 멘션 → "○○님이 회원님을 언급했습니다"

---

## 6. 대시보드에 올릴 것 — 정확히 5개

위젯 욕심을 내지 말 것. 실제로 사람들이 보는 건 이것뿐이다.

| 위젯 | 소스 |
|---|---|
| 오늘/이번 주 업데이트 피드 (실시간) | `v_activity_feed` |
| 담당자별 진행 업무 수 + 평균 진행률 | `v_assignee_summary` |
| 기한 임박·초과 | `v_due_risk` |
| **3일 이상 업데이트 없는 업무** ← 관리자가 제일 원하는 지표 | `v_stale_tasks` |
| 막힌 업무 (blocker) | `v_blocked_tasks` |

---

## 7. 입력 UX — 이 프로젝트의 진짜 리스크

기술이 아니라 **입력 이탈**이다. 다른 시스템과 달리 매일 전원이 입력해야 굴러간다.

- 진행 로그 입력은 **텍스트 한 줄 + 진행률 슬라이더 + (선택)막힌 사유**. 끝.
  30초를 넘기는 순간 아무도 안 쓴다
- 별도 페이지로 이동시키지 말고 어디서든 뜨는 모달/바텀시트로
- 상태 변경, 진행률, 로그 작성이 **한 곳에서** 끝나야 한다
  (`page_updates` INSERT 트리거가 `pages.progress`/`status` 를 자동 동기화한다)
- 필드 추가 요청이 오면 기본적으로 거절하고 이 원칙을 상기시킨다

---

## 8. Realtime

- 팀 규모이므로 `postgres_changes` 로 충분. 구독 테이블은
  `pages`, `page_updates`, `comments`, `notifications`
- 100~200 동시접속을 넘기면 `broadcast` 채널로 교체해야 한다 (지금은 불필요)
- 구독은 반드시 언마운트 시 `removeChannel` 로 정리

---

## 9. 코딩 규약

- 서버 컴포넌트 기본, 상호작용 필요한 곳만 `'use client'`
- Supabase 타입은 `supabase gen types typescript` 로 생성해 `types/db.ts` 에 둔다.
  손으로 타입을 적지 말 것
- DB 변경은 항상 `supabase/migrations/` 에 새 파일로. 기존 마이그레이션 수정 금지
- 한국어 UI. 날짜는 `YYYY-MM-DD`, 상태 값은 DB 와 동일한 한글 문자열 사용
- 에러는 삼켜 로그만 찍지 말고 사용자에게 토스트로 노출

---

## 10. 마이그레이션 실행 순서

```
0001_core.sql            확장, profiles, org_snapshots, pages, ltree 트리거
0002_activity.sql        page_updates, comments
0003_mentions.sql        mentions, notifications, 알림 함수
0004_dashboard.sql       뷰 5종 + weekly_digest()
0005_rls.sql             RLS + Realtime publication
0006_labels_optional.sql 분류 라벨 — 필요 없으면 파일 삭제
```
