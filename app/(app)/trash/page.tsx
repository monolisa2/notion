import { createClient, getSessionUser } from '@/lib/supabase/server';
import { TrashList } from './trash-list';
import type { OrgUnitRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function TrashPage() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  const [{ data: rows }, { data: units }, { data: me }] = await Promise.all([
    supabase.from('v_trash').select('*'),
    supabase.from('v_org_units').select('*'),
    supabase.from('profiles').select('is_admin').eq('id', user!.id).maybeSingle(),
  ]);
  return <TrashList rows={rows ?? []} units={(units ?? []) as OrgUnitRow[]} meId={user!.id} isAdmin={me?.is_admin ?? false} />;
}
