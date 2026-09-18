# TeamHub — 시작하기

팀 업무 현황 협업 도구. 팀 단위 파일럿(10~15명) 기준.

```
CLAUDE.md                        Claude Code 가 매 세션 읽는 규칙
docs/BUILD_PROMPTS.md            Phase 0~7 빌드 프롬프트 (순서대로 붙여넣기)
supabase/migrations/0001~0007    스키마 전체 (0007 = 미입력 리마인드)
supabase/tests/smoke.sql         검증 스크립트 24종
lib/mentions.ts                  멘션 추출 + diff 동기화
```

---

## 1. 실행 순서

```bash
# 1) 리포 만들고 위 파일들을 그대로 넣는다
git init teamhub && cd teamhub

# 2) Supabase 프로젝트 생성 후 마이그레이션 적용
supabase link --project-ref <ref>
supabase db push            # 0001 → 0007 순서로 적용됨

# 0006_labels_optional.sql 은 '합병' '채용' 같은 분류 라벨용.
# 사람 멘션은 0003 에 이미 있으므로, 분류 라벨이 필요 없으면 이 파일을 삭제.

# 3) Claude Code 실행 후 docs/BUILD_PROMPTS.md 의 Phase 0 부터 하나씩
claude
```

---

## 2. 검증 결과

PostgreSQL 16 로컬 클러스터에서 마이그레이션 전체 적용 후 24개 항목을 통과했습니다.

| 검증 항목 | 결과 |
|---|---|
| 4단계 중첩 + ltree path 자동 생성 | 통과 |
| 부모 변경 시 후손 경로 일괄 재작성 | 통과 |
| 순환 이동 차단 (자기 후손 아래로 이동) | 통과 |
| sort_order 중간값 끼워넣기 | 통과 |
| doc 에 업무 속성 입력 시 거부 | 통과 |
| 진행 로그 INSERT 만으로 progress/status 동기화 | 통과 |
| 멘션 재저장 시 read_at 보존 (diff 동기화) | 통과 |
| 자기 자신 멘션 → 알림 없음 | 통과 |
| 5분 내 반복 멘션 → 1건으로 묶음 | 통과 |
| 수신 거부 설정 존중 | 통과 |
| 정체 업무 / 기한 리스크 / 막힌 업무 뷰 | 통과 |
| 완료 처리 시 completed_at·progress 자동 | 통과 |
| RLS: 남의 알림 비노출 | 통과 |
| RLS: 진행 로그 수정·삭제 정책 없음 (append-only) | 통과 |
| 모든 뷰 security_invoker = true | 통과 |
| 멘션 추출: BlockNote(props) / Tiptap(attrs) 양쪽 | 통과 |
| 중첩 블록 멘션의 맥락 분리 | 통과 |

검증 중 잡아서 고친 실제 버그 두 개 (마이그레이션에 주석으로 남겨뒀습니다):

1. **`after update OF path` 트리거가 조용히 건너뛰어짐.** `UPDATE ... OF col` 은
   SQL 문이 그 컬럼을 직접 언급했을 때만 발동합니다. `path` 는 BEFORE 트리거가
   채우는 값이라 `set parent_id = ...` 문에서는 조건이 성립하지 않았고,
   결과적으로 페이지를 옮겨도 하위 페이지들이 따라오지 않았습니다.
2. **순환 이동 검사가 통과되지 않음.** ltree 의 `<@` 는 접두 경로 기준이라
   `001.003.004 <@ 003` 은 false 입니다. 라벨이 아니라 페이지의 전체 경로와
   비교해야 합니다.

로컬에서 재현하려면:

```bash
psql -f supabase/tests/_supabase_stub.sql   # auth 스키마·역할 스텁
psql -f supabase/migrations/0001_core.sql   # ... 0006 까지
psql -f supabase/tests/smoke.sql
```

---

## 3. 아직 정해야 할 것

| 항목 | 기본값 | 바꿀 때 |
|---|---|---|
| 분류 라벨 사용 여부 | 미사용 (0006 삭제) | 나중에 0006 실행하면 됨 |
| 비공개 페이지 | 없음 (팀 전원 공유) | `pages.visibility` + `page_members` 추가 |
| 네이버웍스 봇 | Phase 5 | 봇 등록·토큰 발급이 선행 필요 |
| 파일 첨부 | 범위 밖 | Supabase Storage 로 나중에 |

---

## 4. 파일럿 판단 기준

2주 운영 후 아래 숫자로 판단합니다. 기능 추가보다 이게 먼저입니다.

- 일일 진행 로그 입력률 70% 이상 (진행 업무 보유자 기준)
- 3일 이상 정체 업무 비율 20% 이하
- 주간보고 초안을 절반 미만 고쳐서 쓸 수 있으면 성공

입력률이 50% 아래면 기능을 더 만들지 말고 입력 UX 를 다시 깎아야 합니다.
이 프로젝트가 실패하는 경로는 기술이 아니라 입력 이탈입니다.

---

## 5. 로컬 개발 (Phase 0 결과)

```bash
cp .env.example .env.local     # Supabase URL / key 입력
npm install
npm run dev                    # http://localhost:3000 → /login → Google 로그인
```

- 인증: `@supabase/ssr`. 브라우저는 `lib/supabase/client.ts`, 서버는 `lib/supabase/server.ts`
- 세션 갱신: Next.js 16 은 `middleware.ts` 대신 `proxy.ts` 를 쓴다.
  루트 `proxy.ts` → `lib/supabase/middleware.ts` 의 `updateSession()`.
  로그인하지 않은 요청은 `/login` 으로, `/login` 과 `/auth/*` 는 공개
- 구글 OAuth: Supabase Dashboard → Authentication → Providers → Google 활성화 후
  Redirect URL 에 `<앱 주소>/auth/callback` 추가. Google Cloud Console 의
  승인된 리디렉션 URI 는 `https://<project-ref>.supabase.co/auth/v1/callback`
- 로그인 직후 홈(`/`)에서 `profiles` 행이 자동 생성되었는지 표시한다 (`handle_new_user`)

### 타입 생성

```bash
npm run gen:types                # Supabase CLI 가 있을 때 (supabase start 기준)
DATABASE_URL=postgresql://... npm run gen:types:db   # CLI 바이너리를 못 받는 환경
```

두 명령은 같은 라이브러리(`@supabase/postgrest-typegen`)를 쓰므로 출력이 같다.
`types/db.ts` 는 손으로 고치지 않는다.
