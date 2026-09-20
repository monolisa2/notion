# TEAM_HUB — 경영관리본부 업무 공유 플랫폼

Claude Code 는 이 파일을 매 세션 자동으로 읽는다. 작업 전 반드시 준수할 것.
요구사항의 원문은 `docs/REQUIREMENTS.md` (v1 확정). 이 파일은 그 문서를 구현할 때의 규칙이다.

---

## 1. 무엇을 만드는가

본부 25~30명(본부 > 실 3 > 팀 4)이 **업무 진행 상황을 공유하고, 회의록·자료·공지를 한곳에 모아 두는**
노션형 내부 플랫폼. 노션을 쓰지 않는 이유는 "우리 방식대로 고칠 수 없어서"다.

- **비용 0원 원칙.** Vercel Hobby · Supabase Free · GitHub Free 만 쓴다. 유료 API(AI 포함) 금지.
- 노션의 뼈대(페이지 중첩, 표·칸반·캘린더 뷰, 팀 공간·권한, 댓글·멘션)를 **고정된 형태**로 구현한다.
  자유 속성·수식·관계형·실시간 공동편집·외부 공개 링크는 범위 밖.
- 만드는 순서와 단계별 범위는 `docs/REQUIREMENTS.md` §7. **한 단계 끝날 때마다 화면을 확인받고 다음으로.**

---

## 2. 기술 스택 (변경 금지)

| 영역 | 선택 |
|---|---|
| 프레임워크 | Next.js 16 (App Router, `proxy.ts`) + TypeScript |
| DB / Auth / Realtime / Storage | Supabase (Free) |
| 에디터 | BlockNote (mantine) — 블록 중첩·슬래시·드래그·되돌리기는 전부 위임 |
| 스타일 | Tailwind CSS 4 |
| 글꼴 | **Pretendard Variable** — npm 패키지(`pretendard`, OFL)를 빌드에 묶어 자체 호스팅. 동적 서브셋 92조각이라 화면에 나온 글자가 든 조각만 내려받고, 가변 글꼴이라 굵기는 한 벌로 끝. `--font-sans` 하나로 관리 |
| 배포 | Vercel |
| 로그인 | **회사 이메일 + 비밀번호.** 가입은 닫고 관리자가 계정 생성(임시 비밀번호, 첫 로그인 변경 강제) |
| 외부 알림 | 네이버웍스 봇 (Edge Function, 코드 보관 중 · 나중에 켬) |

---

## 3. 데이터 모델

### (1) 모든 것이 페이지다
`pages` 하나로 문서·업무를 표현한다. `type = 'doc' | 'task'`. `projects` 같은 별도 테이블 금지.

### (2) 무한 중첩 = parent_id + ltree path
- `parent_id` 가 진실, `path` 는 트리거가 관리하는 캐시. **앱에서 `path` 를 쓰지 말 것**
- 이동은 `move_page(page_id, parent_id, after_id)` RPC 만. `sort_order` 직접 계산 금지
- 사이드바는 `v_page_tree` 를 한 번에 받아 클라이언트에서 조립

### (3) 공간과 공개 범위 (0008)
- `org_units` = 조직 트리(본부/실/팀). 관리자 화면에서 편집. 조직 정보를 `profiles` 에 문자열로 박지 말 것
- `pages.unit_id` = 공간, `pages.visibility` = `'본부'`(전원) | `'소속'`(같은 계열 조직 + 관리자) | `'개인'`(owner 만)
- **하위 페이지는 부모의 공간·공개 범위를 상속한다(트리거).** 루트만 바꿀 수 있고, 앱에서 하위 페이지의 unit/visibility 를 직접 쓰지 말 것
- 가시성은 RLS(`can_view_unit`)가 결정한다. 화면에서 다시 필터링하지 말고 RLS 를 믿을 것. 새 테이블·뷰를 만들면 같은 규칙을 태울 것
- 작성 권한은 `org_units.write_scope`('전원'|'리더'|'지정') + `can_write_unit` RLS (0011). '지정'은 `org_unit_writers`. 관리자 화면에서 설정, 개인 메모는 제한 없음

### (4) 사용자
- `profiles` = 멤버. `unit_id`(소속) `rank`(직급) `job_title`(직책) `is_admin` `deactivated_at` `must_change_password`
- 일반 사용자는 본인 행의 이름·아바타·알림 설정만 바꿀 수 있다(트리거 `profiles_guard`). 권한·소속은 관리자만
- 계정 생성·비밀번호 초기화·비활성화는 `SUPABASE_SERVICE_ROLE_KEY` 를 쓰는 **서버 액션에서만**, `requireAdmin()` 뒤에

---

## 4. 절대 하지 말 것

- 유료 API 호출 코드 추가 금지 (AI, 결제, 유료 메일 발송 등)
- CRDT / 실시간 공동편집 구현 금지. 자동저장 + optimistic UI 로 충분
- `localStorage` 에 업무 데이터 저장 금지. 접기/펼치기 같은 UI 상태만 컴포넌트 state 로
- `page_updates` UPDATE / DELETE 금지 (append-only)
- 뷰 생성 시 `security_invoker = true` 누락 금지
- `service_role` 키를 클라이언트로 보내거나 `NEXT_PUBLIC_` 로 노출 금지
- (2026-09-20 결정 변경) 조직 멘션은 **허용**한다 — 이전의 "`@팀전체` 금지" 규칙은 폐기.
  다만 폭탄이 되지 않게 아래를 반드시 지킬 것:
  · 대상은 `expand_unit_mention`(0020)이 정한다 — **그 페이지를 볼 수 있는 사람만**, 하위 조직까지 펼침
  · 누가 어느 조직인지·누가 그 페이지를 볼 수 있는지는 **DB 가 판단**한다. 앱에서 명단을 만들지 말 것
  · 저장은 `props.unitId` (조직명 문자열 금지)
  · 반복 저장 시 재발송 없음 — `sync_page_mentions` 의 차집합에 맡긴다

---

## 5. 멘션 · 알림

- 멘션 저장은 user id(`props.userId`). 이름 문자열 저장 금지
- 본문은 `savePage()`, 댓글은 `saveComment()` 로만 저장 (내부에서 `sync_*_mentions` diff 동기화)
- **security definer 함수는 열람 권한을 스스로 검사할 것** (`can_view_page`, 0022).
  RLS 를 우회하는 함수라 호출자가 그 페이지를 볼 수 있는지 함수 안에서 확인하지 않으면
  못 보는 페이지의 정보가 샌다 (0019 의 `notice_audience` 가 실제로 그랬다)
- 알림 생성은 `enqueue_notification` 만 (자기 멘션 제외 · 5분 묶음 · 수신 설정 존중). 직접 INSERT 금지
- 미입력 리마인드(0007)는 **권장만** 으로 결정 → 스케줄 등록하지 않음. 켤 때는 요구사항 문서 먼저 갱신
- 기한 임박 알림(0015)은 **켜져 있음** — 평일 09:00 KST, 기한 당일·3일 전 담당자에게 due_soon
- 조직 멘션(0020)은 사람 멘션과 같은 경로(`sync_*_mentions`)를 탄다.
  `savePage`/`saveComment` 가 `extractGroupMentions` → `expand_unit_mention` 으로 펼친 뒤 합친다
- 공지 알림(0019, `kind='notice'`)은 **고정된 공지에서 작성자·관리자가 직접 누를 때만**.
  대상은 `notice_audience` — `pages_select` 와 같은 규칙이라 못 보는 사람에겐 안 간다.
  하루 한 번(같은 공지·같은 사람), 수신 설정(notify_*)은 따르지 않는다(공식 공지)

---

## 6. 화면 원칙

- 한국어 UI, 날짜 `YYYY-MM-DD`, 상태 값은 DB 의 한글 문자열 그대로
- 사이트 이름은 `lib/branding.ts` 의 `APP_NAME` 하나다 (현재 `TEAM_HUB`). 화면에 이름을 리터럴로 박지 말 것 —
  앱 밖이라 못 가져다 쓰는 곳은 두 군데뿐(네이버웍스 Edge Function · `package.json` 의 name)
- **글자 크기의 기준은 `app/globals.css` 의 `html { font-size }` 하나다** (현재 15px — Noto Sans KR 이 커 보여 보정).
  Tailwind 의 text-*·여백이 전부 rem 이라 이 값 하나로 화면 전체가 같이 움직인다.
  px 로 박아 둔 곳은 세 군데뿐 — 사이드바 14px · 에디터 본문 16px · 페이지 제목 40px.
  크기 조절 요청이 오면 개별 컴포넌트를 고치지 말고 이 네 값만 손댈 것
- 업무 상태 목록은 `page_statuses` (0012, 본부 공통). 화면은 이 목록으로 그리고, 집계·완료 판정은 `kind`(`status_kind()`) 로. 이름 리터럴 비교 금지. 편집은 관리자+조직장(RLS)
- 에러는 삼키지 말고 토스트(`sonner`)로. 메시지는 `errorMessage()` 로 뽑는다
- 서버 컴포넌트 기본, 상호작용 필요한 곳만 `'use client'`
- 공지는 **`pinned` 가 기준**이다 (공지 양식 `template='notice'` 는 서식일 뿐).
  전용 화면은 `/notices`. `/collections` 는 **회의록 전용**이고, 주간 정리 문서는 `/weekly`(주간 현황) 안에 있다 —
  한 화면에 탭으로 묶으면 사이드바 메뉴와 이름이 겹쳐 헷갈린다 (화면 하나에 주제 하나).
  공지 작성은 `/notices` 의 "＋ 공지 쓰기" 하나로 — 공간·양식·고정을 사용자가 각각 고르게 하지 말 것.
  **게시 중인 공지(루트의 pinned)는 사이드바 공간 트리에서 뺀다** — 📢 공지 화면에 모여 있으므로.
  하위 페이지가 있으면 같이 뺀다(부모만 빼면 자식이 공간 최상단으로 떠오른다)
  고정 권한은 관리자만이고 **UPDATE·INSERT 양쪽 트리거**가 지킨다(0009 + 0021)
- `업무 찾기`(/tasks)와 `진행 상황`(/team)은 이름이 겹쳐 보이지만 하는 일이 다르다 —
  전자는 **찾고 거르고 바꾸는 도구**(조직으로 거르지 않고 RLS 가 보여 주는 만큼·완료 포함·드래그 편집), 후자는 **읽는 현황판**
  (내 소속·진행 중만·마지막 진행 기록·상하위 트리). 제목 밑 한 줄 설명을 지우지 말 것
- 사이드바 메뉴는 늘리지 말 것. "행동"(진행 로그 남기기)은 메뉴 목록이 아니라 위쪽 버튼으로 두고,
  특정 역할만 쓰는 화면(파일·저장 공간)은 관리자 설정 안으로 넣는다
- 대시보드 위젯은 5개 고정 (`v_stale_tasks` `v_blocked_tasks` `v_due_risk` `v_assignee_summary` `v_activity_feed`). 집계는 뷰에서
- 진행 로그 입력은 텍스트 + 진행률 + (선택)막힘 3개. 필드 추가 요청은 기본 거절
- "내 업무"는 **담당(assignee_id) ∪ 참여(page_people)**. 담당자만 보면 참여자 화면에서 업무가 사라진다
- 본문 되돌리기는 `page_snapshots`(0018) — 트리거가 자동 기록하므로 앱에서 INSERT 하지 말 것.
  되돌리기는 반드시 `savePage()` 로 (멘션 색인 동기화)

---

## 7. 코딩 규약

- DB 변경은 `supabase/migrations/` 에 **새 파일**로. 기존 마이그레이션 수정 금지. 로컬 PostgreSQL 로 적용·검증 후 커밋
- 타입은 생성만: `npm run gen:types` (Supabase CLI) 또는 `DATABASE_URL=... npm run gen:types:db`. 손으로 `types/db.ts` 수정 금지
- Realtime 구독은 언마운트 시 `removeChannel`
- 커밋 전 `npm run typecheck && npm run lint && npm run build`

---

## 8. 마이그레이션 순서

```
0001_core.sql            확장, profiles, org_snapshots, pages, ltree 트리거
0002_activity.sql        page_updates, comments
0003_mentions.sql        mentions, notifications, 알림 함수
0004_dashboard.sql       뷰 5종 + weekly_digest()
0005_rls.sql             RLS + Realtime publication + handle_new_user
0006_labels_optional.sql 분류 라벨 — 사용 안 함 (적용하지 말 것)
0007_stale_reminder.sql  미입력 리마인드 함수 (스케줄은 0008 이 해제)
0008_org_spaces.sql      조직도, 공간, 공개 범위, 프로필 필드, 가시성 RLS
0009_collections_search_storage.sql  양식·행사일·고정, 검색, 보관함 복구, 첨부 버킷
0010_favorites_visits.sql            즐겨찾기, 최근 방문
0011_write_permissions.sql           공간별 페이지 작성 권한 (전원/리더/지정)
0012_custom_statuses.sql             업무 상태 커스터마이징 (page_statuses, kind 기반 집계)
0013_people_log_comments.sql         업무 참여자(page_people) + 진행 로그 답글(comments.update_id)
0014_progress_rollup.sql             부모 업무 진행률 = 하위 업무 평균 (트리거 자동 전파)
0015_notice_reads_due_reminders.sql  공지 읽음 현황(notice_readers) + 기한 임박 알림(cron 켬)
0016_guide_template.sql              양식 'guide' 허용 (template 체크 확장)
0017_search_multiword.sql            검색: 여러 단어 AND + pg_trgm 부분일치 인덱스
0018_page_history_avatars.sql        본문 버전 기록(page_snapshots) + 프로필 사진 버킷(avatars)
0019_notice_notifications.sql        공지 알림(kind='notice') — notice_audience / notify_notice
0020_group_mentions.sql              조직 멘션 — expand_unit_mention (가시성 필터 포함)
0021_notice_write.sql                공지 고정 INSERT 구멍 차단 + 공지 바로 쓰기
0022_review_fixes.sql                공지 대상 조회 권한 검사(can_view_page) + 저장 공간 집계에 avatars 포함
```
