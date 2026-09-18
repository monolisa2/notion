import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchTree } from '@/lib/pages';
import { AppShell } from '@/components/app-shell';
import type { Me, OrgUnitRow } from '@/lib/types';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: profile }, tree, { data: units }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, email, avatar_url, is_admin, unit_id, rank, job_title, must_change_password')
      .eq('id', user.id)
      .maybeSingle(),
    fetchTree(supabase),
    supabase.from('v_org_units').select('*'),
  ]);

  // 관리자가 만든 계정의 첫 로그인: 비밀번호를 바꿔야 들어올 수 있다
  if (profile?.must_change_password) redirect('/account/password?first=1');

  const me: Me = {
    id: user.id,
    name: profile?.name ?? user.email?.split('@')[0] ?? '사용자',
    email: profile?.email ?? user.email ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    isAdmin: profile?.is_admin ?? false,
    unitId: profile?.unit_id ?? null,
    rank: profile?.rank ?? null,
    jobTitle: profile?.job_title ?? null,
  };

  return (
    <AppShell me={me} initialTree={tree} units={(units ?? []) as OrgUnitRow[]}>
      {children}
    </AppShell>
  );
}
