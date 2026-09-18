'use server';

import { createClient } from '@/lib/supabase/server';

/** 비밀번호 변경이 끝난 뒤 "첫 로그인 변경 필요" 표시를 내린다 (본인 행, RLS 통과) */
export async function markPasswordChanged() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('로그인이 필요합니다');
  const { error } = await supabase
    .from('profiles')
    .update({ must_change_password: false })
    .eq('id', user.id);
  if (error) throw new Error(error.message);
}
