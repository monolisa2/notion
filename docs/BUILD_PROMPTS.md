# Claude Code 빌드 프롬프트 팩

각 Phase 를 **순서대로 하나씩** 붙여 넣는다.
한 번에 여러 Phase 를 던지면 컨텍스트가 넘쳐 품질이 떨어진다.
Phase 가 끝날 때마다 실제로 화면을 열어 확인하고 커밋한다.

---

## Phase 0 — 프로젝트 준비

```
Next.js(App Router) + TypeScript + Tailwind 로 프로젝트를 초기화하고
Supabase 클라이언트를 붙여줘.

- supabase/migrations/ 의 0001~0005 를 순서대로 로컬 DB 에 적용
  (0006_labels_optional.sql 은 일단 건너뛴다)
- supabase gen types typescript 로 types/db.ts 생성
- lib/supabase/client.ts (브라우저), lib/supabase/server.ts (서버 컴포넌트) 분리
- 구글 OAuth 로그인 + 미들웨어 세션 갱신
- 로그인하면 handle_new_user 트리거로 profiles 가 자동 생성되는지 확인

완료 후 마이그레이션 적용 결과와 생성된 테이블 목록을 보여줘.
```

---

## Phase 1 — 페이지 트리 + 에디터

이게 전체에서 가장 오래 걸린다. 서두르지 말 것.

```
페이지 CRUD 와 사이드바 트리를 만들어줘.

사이드바
- v_page_tree 를 path 순으로 한 번에 받아 클라이언트에서 트리로 조립
- 접기/펼치기 상태는 컴포넌트 state 로만 (localStorage 쓰지 말 것)
- 각 항목 우클릭 메뉴: 하위 페이지 추가 / 업무로 전환 / 이름 변경 / 보관
- 드래그 앤 드롭 이동은 move_page(page_id, parent_id, after_id) RPC 만 호출.
  sort_order 를 직접 계산하지 말 것
- 순환 이동(자기 후손 아래로 이동)은 DB 트리거가 예외를 던진다.
  그 예외를 잡아 "페이지를 자신의 하위로 이동할 수 없습니다" 토스트로 표시

에디터
- BlockNote 를 붙이고 본문을 pages.content(JSONB)에 저장
- 제목은 별도 input, 본문 첫 블록과 섞지 말 것
- 자동저장: 700ms 디바운스. 저장 중/저장됨 상태를 우상단에 조용히 표시
- 저장은 lib/mentions.ts 의 savePage() 를 통해서만 (멘션 동기화가 여기 묶여 있다)

CRDT / Yjs / 커서 공유는 구현하지 말 것. CLAUDE.md 4절 참고.
```

---

## Phase 2 — 업무 속성 + 진행 로그 입력

**여기가 제품의 심장이다.** 입력이 30초를 넘기면 프로젝트가 실패한다.

```
type='task' 페이지의 속성 편집과 진행 로그 입력을 만들어줘.

속성 바 (페이지 상단, 한 줄)
- 상태(대기/진행/검토/완료/보류/드롭) 드롭다운
- 담당자 아바타 선택
- 진행률, 기한, 우선순위
- 각 필드는 변경 즉시 optimistic 업데이트 후 저장

진행 로그 입력 — 가장 중요
- 어디서든 단축키로 뜨는 모달. 별도 페이지 이동 금지
- 구성은 정확히 3개:
    1) 텍스트 한 줄 ("오늘 뭘 했나요?") — @ 입력 시 멘션 자동완성
    2) 진행률 슬라이더 (현재 값이 기본으로 채워져 있어야 함)
    3) "막힌 게 있나요?" 토글 → 열면 blocker 입력
- 제출 시 page_updates 에 INSERT 만 하면 트리거가 pages.progress/status 를
  자동 갱신한다. pages 를 따로 UPDATE 하지 말 것
- 필드를 더 추가하지 말 것. 어떤 이유로도.

페이지 하단
- 해당 페이지의 진행 로그 타임라인 (최신순, 작성자 아바타 + 날짜 + 내용)
- blocker 가 있는 로그는 시각적으로 구분
- 로그 수정/삭제 버튼은 만들지 말 것 (append-only)
```

---

## Phase 3 — 멘션 + 알림 (앱 내)

```
사람 멘션과 앱 내 알림을 만들어줘.

멘션 입력
- BlockNote 의 Mention 확장으로 @ 자동완성 (profiles 에서 deactivated_at is null)
- 노드에 userId 를 저장. 이름 문자열로 저장하지 말 것
- 본문/댓글 모두 지원

동기화
- 본문은 savePage(), 댓글은 saveComment() 를 통해서만
  (내부에서 sync_page_mentions / sync_comment_mentions RPC 를 호출한다)
- mentions 테이블에 직접 INSERT 하지 말 것. diff 로직이 깨진다

알림 UI
- 헤더 벨 아이콘 + 안 읽은 개수 배지
- notifications 를 recipient_id = 내 id 로 Realtime 구독
- 드롭다운에 kind 별 아이콘/문구 구분 (mention / assigned / comment)
- 항목 클릭 → 해당 페이지로 이동 + mark_notifications_read RPC
- "모두 읽음" 버튼

댓글
- 페이지 하단 댓글 스레드 (1단계 대댓글만)
- 해결(resolve) 토글
```

---

## Phase 4 — 대시보드

```
대시보드 화면을 만들어줘. 위젯은 정확히 5개. 더 만들지 말 것.

1. 실시간 활동 피드 (v_activity_feed, 최근 7일)
   - page_updates 를 Realtime 구독해 새 로그가 즉시 위에 쌓이게
2. 담당자별 현황 (v_assignee_summary)
   - 진행 업무 수, 평균 진행률, 기한 초과 건수
3. 기한 리스크 (v_due_risk)
   - risk_level 별 색상: 초과=빨강, 오늘=주황, 임박=노랑
4. 정체 업무 (v_stale_tasks)
   - stale_days 내림차순. 이게 관리자가 제일 먼저 보는 카드다
5. 막힌 업무 (v_blocked_tasks)
   - blocker 원문을 그대로 노출

뷰는 이미 만들어져 있으니 SELECT 만 하면 된다. 집계를 클라이언트에서
다시 계산하지 말 것.

업무 목록 화면도 함께
- 테이블 / 칸반(status 기준) 두 가지 뷰 토글
- 필터: 담당자, 상태, 기한, (라벨 마이그레이션을 실행했다면 라벨)
```

---

## Phase 5 — 네이버웍스 알림 발송

앱을 안 켜놓은 사람에게 안 닿으면 멘션 기능은 죽는다.

```
Supabase Edge Function 으로 네이버웍스 DM 발송을 만들어줘.

supabase/functions/push-notifications/index.ts
- notifications 에서 pushed_at is null AND created_at > now() - 1 hour 인 행 조회
- profiles.naverworks_id 가 있는 수신자에게만 발송
- 네이버웍스 Bot API 로 DM (title + preview + 페이지 딥링크)
- 성공 시 pushed_at, 실패 시 push_error 기록
- 같은 실행 내 동일 수신자 여러 건은 하나의 메시지로 묶어 보냄

트리거 방식
- pg_cron 으로 1분마다 호출 (Supabase Dashboard 에서 설정)
- 또는 notifications INSERT 시 DB webhook. 후자가 빠르지만
  5분 묶음 처리와 충돌할 수 있으니 pg_cron 쪽을 기본으로 한다

환경변수: NAVERWORKS_BOT_ID, NAVERWORKS_CLIENT_ID,
NAVERWORKS_CLIENT_SECRET, NAVERWORKS_SERVICE_ACCOUNT, APP_BASE_URL
```

---

## Phase 6 — 주간보고 자동 생성

```
주간보고 초안 생성 기능을 만들어줘.

- weekly_digest(p_days => 7) RPC 로 담당자별 진행 로그를 묶어 받는다
- 그 결과를 LLM 에 넣어 보고서 초안을 생성
  (Anthropic API. 기존 HR 브리핑에서 쓰던 패턴과 동일)
- 프롬프트는 lib/prompts/weekly-report.ts 로 분리
- 출력 구조: 팀 전체 요약 → 담당자별 진행 → 막힌 사항 → 다음 주 예정
- 생성 결과는 새 page(type='doc')로 저장하고 에디터에서 바로 수정 가능하게
- 미입력자(해당 기간 page_updates 가 0건인 사람)를 명시적으로 표시할 것.
  이게 입력률을 끌어올리는 가장 강한 장치다
```

---

## Phase 7 — 미입력 리마인드

```
매일 진행 로그를 안 올린 담당자에게 리마인드를 보내줘.

- pg_cron 으로 평일 17:30 실행
- 조건: 진행 중(대기/진행/검토) 업무를 가진 사람 중
       오늘 page_updates 를 한 건도 안 올린 사람
- enqueue_notification(kind => 'stale') 로 큐에 넣고 Phase 5 가 발송
- 문구는 압박하지 말고 가볍게:
  "오늘 진행 상황을 한 줄 남겨주세요 (진행 중 업무 3건)"
- 본인이 끌 수 있게 profiles.notify_due 를 존중 (enqueue_notification 이 이미 처리)
```

---

## 파일럿 판단 기준

2주 돌린 뒤 아래를 보고 전사 확장을 결정한다. 기능 추가보다 이 숫자가 먼저다.

| 지표 | 목표 |
|---|---|
| 일일 진행 로그 입력률 (진행 업무 보유자 기준) | 70% 이상 |
| 3일 이상 정체 업무 비율 | 20% 이하 |
| 멘션 알림 클릭률 | 50% 이상 |
| 주간보고 초안 수정량 | 절반 미만 고쳐서 바로 쓸 수 있으면 성공 |

입력률이 50% 아래면 기능을 더 만들지 말고 **입력 UX 를 다시 깎아야 한다.**
