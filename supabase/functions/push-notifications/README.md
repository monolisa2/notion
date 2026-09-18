# push-notifications — 네이버웍스 DM 발송

`notifications` 큐에서 `pushed_at is null` 이고 최근 1시간 내 생긴 행을 집어
수신자(`profiles.naverworks_id`)에게 네이버웍스 봇 DM 을 보낸다.
같은 실행 안에서 한 사람에게 여러 건이면 한 메시지로 묶는다.

## 1. 네이버웍스 준비 (Developer Console)

1. https://developers.worksmobile.com → **Console → API 2.0 → App 추가**
   - OAuth Scopes 에 `bot` 추가
   - **Service Account 발급** → `xxx.serviceaccount@...` 값 메모
   - **Private Key 발급** → `.key` 파일 다운로드 (한 번만 받을 수 있음)
   - Client ID / Client Secret 메모
2. **Console → Bot → 등록** → Bot ID 메모. "관리자 승인" 후 사용 가능
3. 관리자 화면에서 봇을 회사에 공개하고, 수신자들이 봇을 추가해 두어야 DM 이 도착한다
4. 각 사용자의 네이버웍스 사용자 ID(이메일 형식 또는 userId)를 `profiles.naverworks_id` 에 넣는다

## 2. 배포

```bash
supabase functions deploy push-notifications

supabase secrets set \
  NAVERWORKS_BOT_ID=... \
  NAVERWORKS_CLIENT_ID=... \
  NAVERWORKS_CLIENT_SECRET=... \
  NAVERWORKS_SERVICE_ACCOUNT=... \
  NAVERWORKS_PRIVATE_KEY="$(cat private_YYYYMMDD.key)" \
  APP_BASE_URL=https://<배포 주소> \
  CRON_SECRET=<임의의 긴 문자열>
```

`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` 는 플랫폼이 자동 주입한다.

## 3. 1분마다 호출 (pg_cron + pg_net)

Supabase Dashboard → Database → Extensions 에서 `pg_cron`, `pg_net` 을 켠 뒤
SQL Editor 에서 실행 (URL 과 secret 은 본인 값으로):

```sql
select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/push-notifications', 'push_fn_url');
select vault.create_secret('<CRON_SECRET 과 같은 값>', 'push_cron_secret');
select vault.create_secret('<service_role key>', 'push_service_key');

select cron.schedule(
  'push-notifications-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'push_fn_url'),
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'push_service_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')
    ),
    body    := '{}'::jsonb
  );
  $$
);
```

확인: `select * from cron.job;` / 실행 이력 `select * from cron.job_run_details order by start_time desc limit 20;`

DB webhook(INSERT 즉시 호출) 방식도 가능하지만 5분 묶음 처리와 충돌할 수 있어 pg_cron 을 기본으로 한다.

## 4. 수동 테스트

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/push-notifications \
  -H "Authorization: Bearer <service_role key>" -H "x-cron-secret: <CRON_SECRET>"
# → {"sent":N,"skipped":M,"failed":K,"recipients":R}
```

실패한 행은 `notifications.push_error` 에 사유가 남고, 1시간 안에서는 다음 실행 때 재시도된다.
`naverworks_id` 가 없는 수신자는 `pushed_at` 을 채우고 `push_error='naverworks_id 없음'` 으로 종결한다.
