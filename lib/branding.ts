/**
 * 화면에 보이는 사이트 이름.
 *
 * 이름을 바꾸려면 **이 값 하나만** 고치면 된다 — 로그인 화면, 사이드바,
 * 브라우저 탭, 홈 인사말, 사용법 양식이 전부 이걸 쓴다.
 *
 * 여기서 안 쓰는 곳이 두 군데 있다 (앱 코드가 아니라서 import 가 안 된다):
 *   · supabase/functions/push-notifications — 네이버웍스 봇 (Deno)
 *   · package.json 의 name — npm 패키지 이름이라 화면에 안 나온다
 */
export const APP_NAME = 'TEAM_HUB';
