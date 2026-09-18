import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AdminPanel } from '@/components/admin/admin-panel';
import type { OrgUnitRow } from '@/lib/types';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: me } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (!me?.is_admin) redirect('/');

  const serviceKeyConfigured = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const [{ data: members }, { data: units }, { data: usage }, lastSignIn] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, email, unit_id, rank, job_title, is_admin, deactivated_at, must_change_password, created_at')
      .order('name'),
    supabase.from('v_org_units').select('*'),
    supabase.rpc('storage_usage_bytes'),
    // 마지막 로그인은 auth 쪽 정보라 service role 로만 읽을 수 있다
    serviceKeyConfigured
      ? createAdminClient()
          .auth.admin.listUsers({ perPage: 1000 })
          .then((r) => new Map((r.data?.users ?? []).map((u) => [u.id, u.last_sign_in_at ?? null])))
          .catch(() => new Map<string, string | null>())
      : Promise.resolve(new Map<string, string | null>()),
  ]);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const recentLoginCount = [...lastSignIn.values()].filter((t) => t && new Date(t) > weekAgo).length;

  return (
    <AdminPanel
      meId={user.id}
      recentLoginCount={recentLoginCount}
      members={(members ?? []).map((m) => ({ ...m, last_sign_in_at: lastSignIn.get(m.id) ?? null }))}
      units={(units ?? []) as OrgUnitRow[]}
      serviceKeyConfigured={serviceKeyConfigured}
      storageBytes={Number(usage ?? 0)}
    />
  );
}
