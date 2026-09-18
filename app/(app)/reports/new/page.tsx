import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { WeeklyReportGenerator } from '@/components/reports/weekly-report-generator';
import type { Me } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function NewReportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: profile }, silent] = await Promise.all([
    supabase.from('profiles').select('name, avatar_url, is_admin').eq('id', user.id).maybeSingle(),
    supabase.rpc('silent_members', { p_days: 7 }),
  ]);
  const me: Me = {
    id: user.id,
    name: profile?.name ?? '나',
    email: user.email ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    isAdmin: profile?.is_admin ?? false,
  };

  return <WeeklyReportGenerator me={me} silent={silent.data ?? []} />;
}
