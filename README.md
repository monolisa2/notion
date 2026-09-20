# TEAM_HUB — 경영관리본부 업무 공유 플랫폼

노션처럼 쓰되 우리 방식대로 고칠 수 있는 내부 도구. 비용 0원(Vercel · Supabase · GitHub 무료 플랜).

- 요구사항: `docs/REQUIREMENTS.md` (v1 확정)
- 구현 규칙: `CLAUDE.md`
- 스키마: `supabase/migrations/0001~0008` (0006 은 사용 안 함)

## 로컬 실행

```bash
npm install
cp .env.example .env.local      # Supabase URL / publishable key / service_role key 입력
npm run dev                     # http://localhost:3000
```

## Supabase 설정 (한 번)

1. SQL Editor 에서 `supabase/migrations/` 의 0001 → 0002 → 0003 → 0004 → 0005 → 0007 → 0008 을 순서대로 실행 (0006 제외)
2. Authentication → Sign In / Providers → **Email**: 켬. **Allow new users to sign up = OFF**, **Confirm email = OFF**
   (계정은 관리자 화면에서 만든다. 메일 발송 설정 불필요)
3. Authentication → Sign In / Providers → Google: 끔 (사용 안 함)
4. Project Settings → API Keys → `service_role` 키를 `.env.local` 의 `SUPABASE_SERVICE_ROLE_KEY` 에 (Vercel 에도 환경변수로)

## 첫 관리자

0008 이 가장 먼저 만들어진 계정을 관리자로 지정한다. 로그인 후 사이드바 **관리자** → 멤버 탭에서
"명단 붙여넣기"로 25명을 한 번에 등록하고, 발급된 임시 비밀번호를 네이버웍스로 전달한다.

## 타입 재생성

```bash
npm run gen:types                                    # Supabase CLI 사용 시
DATABASE_URL=postgresql://... npm run gen:types:db   # CLI 없이 (같은 라이브러리, 같은 출력)
```

## 로컬 DB 검증

```bash
psql -f supabase/tests/_supabase_stub.sql
psql -f supabase/migrations/0001_core.sql   # ... 0005, 0007, 0008
psql -f supabase/tests/smoke.sql
```
