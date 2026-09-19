import { redirect } from 'next/navigation';
import { createClient, getSessionUser } from '@/lib/supabase/server';
import { getUnits } from '@/lib/reference';
import { fetchTree } from '@/lib/pages';
import { AppShell } from '@/components/app-shell';
import type { Me, SidebarPageLite } from '@/lib/types';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect('/login');

  const [{ data: profile }, tree, units, { data: favorites }, { data: recents }, { data: writerRows }, guidePageId] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, email, avatar_url, is_admin, unit_id, rank, job_title, must_change_password')
      .eq('id', user.id)
      .maybeSingle(),
    fetchTree(supabase),
    getUnits(),
    supabase.from('v_favorite_pages').select('id, title, icon, type, status').eq('user_id', user.id).limit(20),
    supabase.from('v_recent_pages').select('id, title, icon, type, status').eq('user_id', user.id).limit(6),
    // '지정' 공간에서 내가 작성 가능한 조직 (0011 이전 DB 에서는 에러 → 빈 배열)
    supabase.from('org_unit_writers').select('unit_id').eq('user_id', user.id),
    // 사용법 안내는 공간 트리에서 빼고 하단 메뉴로 (0016 이전 DB 면 null)
    supabase
      .from('pages')
      .select('id')
      .eq('template', 'guide')
      .is('archived_at', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then((r) => r.data?.id ?? null),
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
    <AppShell
      me={me}
      initialTree={tree}
      units={units}
      favorites={(favorites ?? []) as SidebarPageLite[]}
      recents={(recents ?? []) as SidebarPageLite[]}
      writerUnits={(writerRows ?? []).map((w) => w.unit_id)}
      guidePageId={guidePageId}
    >
      {children}
    </AppShell>
  );
}
