// supabase/functions/push-notifications/index.ts
//
// notifications 큐에서 아직 발송되지 않은 알림을 집어 네이버웍스 봇 DM 으로 보낸다.
//   - pushed_at is null AND created_at > now() - 1 hour
//   - profiles.naverworks_id 가 있는 수신자에게만
//   - 같은 실행 내 동일 수신자 여러 건은 하나의 메시지로 묶는다
//   - 성공 시 pushed_at, 실패 시 push_error 기록
//
// 호출: pg_cron → pg_net (1분 주기). README.md 참고.
// 인증: Authorization: Bearer <service_role key> 또는 x-cron-secret 헤더.
//
// 환경변수 (supabase secrets set ...):
//   NAVERWORKS_BOT_ID, NAVERWORKS_CLIENT_ID, NAVERWORKS_CLIENT_SECRET,
//   NAVERWORKS_SERVICE_ACCOUNT, NAVERWORKS_PRIVATE_KEY (PEM, 줄바꿈은 \n),
//   APP_BASE_URL (예: https://teamhub.vercel.app), CRON_SECRET (선택)
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 는 플랫폼이 자동 주입한다.

import { createClient } from 'npm:@supabase/supabase-js@2';

type NotificationRow = {
  id: string;
  recipient_id: string;
  kind: string;
  page_id: string | null;
  title: string;
  preview: string | null;
  created_at: string;
  recipient: { naverworks_id: string | null; name: string } | null;
};

const env = (k: string, required = true) => {
  const v = Deno.env.get(k);
  if (!v && required) throw new Error(`환경변수 ${k} 가 없습니다`);
  return v ?? '';
};

// ---------- 네이버웍스 인증 (Service Account JWT → access token) ----------

const b64url = (data: ArrayBuffer | string) => {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN [A-Z ]+-----/, '')
    .replace(/-----END [A-Z ]+-----/, '')
    .replace(/\s+/g, '');
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

async function getAccessToken(): Promise<string> {
  const clientId = env('NAVERWORKS_CLIENT_ID');
  const clientSecret = env('NAVERWORKS_CLIENT_SECRET');
  const serviceAccount = env('NAVERWORKS_SERVICE_ACCOUNT');
  const key = await importPrivateKey(env('NAVERWORKS_PRIVATE_KEY'));

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({ iss: clientId, sub: serviceAccount, iat: now, exp: now + 3600 }),
  );
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(`${header}.${payload}`),
  );
  const assertion = `${header}.${payload}.${b64url(sig)}`;

  const res = await fetch('https://auth.worksmobile.com/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      assertion,
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'bot',
    }),
  });
  if (!res.ok) throw new Error(`토큰 발급 실패 ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

async function sendDm(token: string, botId: string, userId: string, text: string) {
  const res = await fetch(
    `https://www.worksapis.com/v1.0/bots/${encodeURIComponent(botId)}/users/${encodeURIComponent(userId)}/messages`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: { type: 'text', text } }),
    },
  );
  if (!res.ok) throw new Error(`DM 실패 ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

// ---------- 메시지 조립 ----------

const KIND_LABEL: Record<string, string> = {
  mention: '멘션',
  assigned: '배정',
  comment: '댓글',
  due_soon: '기한',
  stale: '리마인드',
};

function composeMessage(rows: NotificationRow[], baseUrl: string): string {
  const lines: string[] = [];
  lines.push(rows.length === 1 ? '[TeamHub] 새 알림' : `[TeamHub] 새 알림 ${rows.length}건`);
  for (const n of rows) {
    lines.push('');
    lines.push(`• (${KIND_LABEL[n.kind] ?? n.kind}) ${n.title}`);
    if (n.preview) lines.push(`  ${n.preview.replace(/\s+/g, ' ').slice(0, 140)}`);
    if (n.page_id) lines.push(`  ${baseUrl.replace(/\/$/, '')}/p/${n.page_id}`);
  }
  return lines.join('\n').slice(0, 1900); // 네이버웍스 텍스트 길이 여유
}

// ---------- 핸들러 ----------

Deno.serve(async (req) => {
  // 인증
  const auth = req.headers.get('authorization') ?? '';
  const cronSecret = Deno.env.get('CRON_SECRET');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  const okByBearer = auth === `Bearer ${serviceKey}`;
  const okBySecret = !!cronSecret && req.headers.get('x-cron-secret') === cronSecret;
  if (!okByBearer && !okBySecret) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createClient(env('SUPABASE_URL'), serviceKey, {
    auth: { persistSession: false },
  });
  const baseUrl = env('APP_BASE_URL');
  const botId = env('NAVERWORKS_BOT_ID');

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('notifications')
    .select(
      'id, recipient_id, kind, page_id, title, preview, created_at, recipient:profiles!notifications_recipient_id_fkey(naverworks_id, name)',
    )
    .is('pushed_at', null)
    .gt('created_at', since)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as unknown as NotificationRow[];
  if (rows.length === 0) return Response.json({ sent: 0, skipped: 0, failed: 0 });

  // 네이버웍스 ID 없는 수신자 → 발송 불가로 종결 (재시도 방지)
  const noTarget = rows.filter((r) => !r.recipient?.naverworks_id);
  if (noTarget.length > 0) {
    await supabase
      .from('notifications')
      .update({ pushed_at: new Date().toISOString(), push_error: 'naverworks_id 없음' })
      .in('id', noTarget.map((r) => r.id));
  }

  // 수신자별 묶음
  const byRecipient = new Map<string, NotificationRow[]>();
  for (const r of rows) {
    if (!r.recipient?.naverworks_id) continue;
    const list = byRecipient.get(r.recipient_id) ?? [];
    list.push(r);
    byRecipient.set(r.recipient_id, list);
  }
  if (byRecipient.size === 0) return Response.json({ sent: 0, skipped: noTarget.length, failed: 0 });

  let token: string;
  try {
    token = await getAccessToken();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase
      .from('notifications')
      .update({ push_error: msg.slice(0, 500) })
      .in('id', [...byRecipient.values()].flat().map((r) => r.id));
    return Response.json({ error: msg }, { status: 502 });
  }

  let sent = 0;
  let failed = 0;
  for (const [, list] of byRecipient) {
    const ids = list.map((r) => r.id);
    try {
      await sendDm(token, botId, list[0].recipient!.naverworks_id!, composeMessage(list, baseUrl));
      await supabase
        .from('notifications')
        .update({ pushed_at: new Date().toISOString(), push_error: null })
        .in('id', ids);
      sent += ids.length;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabase.from('notifications').update({ push_error: msg.slice(0, 500) }).in('id', ids);
      failed += ids.length;
    }
  }

  return Response.json({ sent, skipped: noTarget.length, failed, recipients: byRecipient.size });
});
