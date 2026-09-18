import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchTree } from '@/lib/pages';
import { AppShell } from '@/components/app-shell';
import type { Me } from '@/lib/types';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: profile }, tree] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, email, avatar_url, is_admin')
      .eq('id', user.id)
      .maybeSingle(),
    fetchTree(supabase),
  ]);

  const me: Me = {
    id: user.id,
    name: profile?.name ?? user.email?.split('@')[0] ?? '사용자',
    email: profile?.email ?? user.email ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    isAdmin: profile?.is_admin ?? false,
  };

  return (
    <AppShell me={me} initialTree={tree}>
      {children}
    </AppShell>
  );
}
