import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AdminPanel } from '@/components/admin/admin-panel';
import type { OrgUnitRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: me } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (!me?.is_admin) redirect('/');

  const [{ data: members }, { data: units }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, email, unit_id, rank, job_title, is_admin, deactivated_at, must_change_password, created_at')
      .order('name'),
    supabase.from('v_org_units').select('*'),
  ]);

  return (
    <AdminPanel
      meId={user.id}
      members={members ?? []}
      units={(units ?? []) as OrgUnitRow[]}
      serviceKeyConfigured={!!process.env.SUPABASE_SERVICE_ROLE_KEY}
    />
  );
}
