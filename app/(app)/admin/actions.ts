'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateTempPassword } from '@/lib/password';
import { JOB_TITLES, RANKS, type Tables } from '@/lib/types';

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('로그인이 필요합니다');
  const { data } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (!data?.is_admin) throw new Error('관리자만 할 수 있습니다');
  return { supabase, userId: user.id };
}

const wrap = async <T,>(fn: () => Promise<T>): Promise<Result<T>> => {
  try {
    const data = await fn();
    revalidatePath('/admin');
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};

export type NewMember = {
  name: string;
  email: string;
  unitId: string | null;
  rank: string | null;
  jobTitle: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function createOne(m: NewMember): Promise<{ email: string; tempPassword: string }> {
  const name = m.name.trim();
  const email = m.email.trim().toLowerCase();
  if (!name) throw new Error('이름이 비어 있습니다');
  if (!EMAIL_RE.test(email)) throw new Error(`이메일 형식이 아닙니다: ${email}`);
  if (m.rank && !(RANKS as readonly string[]).includes(m.rank)) throw new Error(`직급 값이 올바르지 않습니다: ${m.rank}`);
  if (m.jobTitle && !(JOB_TITLES as readonly string[]).includes(m.jobTitle)) throw new Error(`직책 값이 올바르지 않습니다: ${m.jobTitle}`);

  const admin = createAdminClient();
  const tempPassword = generateTempPassword();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true, // 메일 발송 없이 바로 로그인 가능
    user_metadata: { full_name: name },
  });
  if (error) throw new Error(error.message.includes('already') ? `이미 등록된 이메일입니다: ${email}` : error.message);
  const uid = data.user.id;

  // handle_new_user 트리거가 profiles 행을 만든 뒤 소속·직급·직책·첫 로그인 변경 플래그를 채운다
  const { error: pErr } = await admin
    .from('profiles')
    .update({ name, unit_id: m.unitId, rank: m.rank, job_title: m.jobTitle, must_change_password: true })
    .eq('id', uid);
  if (pErr) throw new Error(pErr.message);

  return { email, tempPassword };
}

export async function createMember(m: NewMember) {
  return wrap(async () => {
    await requireAdmin();
    return createOne(m);
  });
}

/**
 * 일괄 등록. 한 줄에 "이름, 이메일, 소속, 직급, 직책" (소속 이후는 선택).
 * 소속은 조직 이름으로 적는다 (예: 회계팀). 실패한 줄은 사유와 함께 돌려준다.
 */
export async function createMembersBulk(text: string) {
  return wrap(async () => {
    const { supabase } = await requireAdmin();
    const { data: units } = await supabase.from('org_units').select('id, name');
    const unitByName = new Map((units ?? []).map((u) => [u.name.replace(/\s+/g, ''), u.id]));

    const results: { line: string; ok: boolean; tempPassword?: string; error?: string }[] = [];
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      const [name, email, unitName, rank, jobTitle] = line.split(/\s*[,\t]\s*/);
      try {
        let unitId: string | null = null;
        if (unitName) {
          unitId = unitByName.get(unitName.replace(/\s+/g, '')) ?? null;
          if (!unitId) throw new Error(`조직을 찾을 수 없습니다: ${unitName}`);
        }
        const r = await createOne({ name, email, unitId, rank: rank || null, jobTitle: jobTitle || null });
        results.push({ line, ok: true, tempPassword: r.tempPassword });
      } catch (e) {
        results.push({ line, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }
    return results;
  });
}

export async function resetPassword(userId: string) {
  return wrap(async () => {
    await requireAdmin();
    const admin = createAdminClient();
    const tempPassword = generateTempPassword();
    const { error } = await admin.auth.admin.updateUserById(userId, { password: tempPassword });
    if (error) throw new Error(error.message);
    const { error: pErr } = await admin.from('profiles').update({ must_change_password: true }).eq('id', userId);
    if (pErr) throw new Error(pErr.message);
    return { tempPassword };
  });
}

export async function updateMember(
  userId: string,
  patch: { unitId?: string | null; rank?: string | null; jobTitle?: string | null; isAdmin?: boolean; name?: string },
) {
  return wrap(async () => {
    const { userId: me } = await requireAdmin();
    if (patch.isAdmin === false && userId === me) throw new Error('자기 자신의 관리자 권한은 뺄 수 없습니다');
    const admin = createAdminClient();
    const row: Tables['profiles']['Update'] = {};
    if ('unitId' in patch) row.unit_id = patch.unitId;
    if ('rank' in patch) row.rank = patch.rank;
    if ('jobTitle' in patch) row.job_title = patch.jobTitle;
    if ('isAdmin' in patch) row.is_admin = patch.isAdmin;
    if (patch.name !== undefined) row.name = patch.name.trim();
    const { error } = await admin.from('profiles').update(row).eq('id', userId);
    if (error) throw new Error(error.message);
  });
}

/** 비활성화 = 로그인 차단(ban) + deactivated_at. 행은 남긴다 (멘션·로그 무결성) */
export async function setActive(userId: string, active: boolean) {
  return wrap(async () => {
    const { userId: me } = await requireAdmin();
    if (!active && userId === me) throw new Error('자기 자신은 비활성화할 수 없습니다');
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: active ? 'none' : '876000h',
    });
    if (error) throw new Error(error.message);
    const { error: pErr } = await admin
      .from('profiles')
      .update({ deactivated_at: active ? null : new Date().toISOString() })
      .eq('id', userId);
    if (pErr) throw new Error(pErr.message);
  });
}

/**
 * 이 사람이 담당인 "아직 안 끝난" 업무.
 * 퇴사·휴직으로 비활성화할 때, 담당자가 그대로 남아 유령 업무가 되는 것을 막는다.
 */
export async function openTasksOf(userId: string) {
  return wrap(async () => {
    const { supabase } = await requireAdmin();
    const { data: statuses } = await supabase.from('page_statuses').select('name, kind');
    const openNames = (statuses ?? [])
      .filter((s) => s.kind === '대기' || s.kind === '진행' || s.kind === '보류')
      .map((s) => s.name);
    if (openNames.length === 0) return { count: 0, titles: [] as string[] };
    const { data, error } = await supabase
      .from('pages')
      .select('id, title')
      .eq('type', 'task')
      .eq('assignee_id', userId)
      .in('status', openNames)
      .is('archived_at', null)
      // 개인 메모 안의 업무는 본인만 보는 것이라 넘기지 않는다
      .neq('visibility', '개인')
      .order('updated_at', { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { count: (data ?? []).length, titles: (data ?? []).slice(0, 5).map((t) => t.title) };
  });
}

/**
 * 담당 업무 일괄 재배정. 넘긴 내역은 각 업무의 진행 로그에도 남는다
 * (나중에 "이거 왜 내 앞으로 왔지?" 를 답할 수 있어야 한다).
 */
export async function reassignTasks(fromUserId: string, toUserId: string) {
  return wrap(async () => {
    const { supabase, userId: me } = await requireAdmin();
    if (fromUserId === toUserId) throw new Error('같은 사람에게는 넘길 수 없습니다');

    const { data: statuses } = await supabase.from('page_statuses').select('name, kind');
    const openNames = (statuses ?? [])
      .filter((s) => s.kind === '대기' || s.kind === '진행' || s.kind === '보류')
      .map((s) => s.name);
    if (openNames.length === 0) return { moved: 0 };

    const admin = createAdminClient();
    const { data: names } = await admin
      .from('profiles')
      .select('id, name')
      .in('id', [fromUserId, toUserId]);
    const nameOf = (id: string) => (names ?? []).find((n) => n.id === id)?.name ?? '알 수 없음';

    const { data: tasks, error } = await admin
      .from('pages')
      .select('id, status, progress')
      .eq('type', 'task')
      .eq('assignee_id', fromUserId)
      .in('status', openNames)
      .is('archived_at', null)
      // service role 이라 RLS 를 통과한다 → 개인 메모 업무는 여기서 직접 제외해야 한다
      .neq('visibility', '개인');
    if (error) throw new Error(error.message);
    const rows = tasks ?? [];
    if (rows.length === 0) return { moved: 0 };

    const { error: upErr } = await admin
      .from('pages')
      .update({ assignee_id: toUserId })
      .in('id', rows.map((t) => t.id));
    if (upErr) throw new Error(upErr.message);

    // 진행 로그에 흔적 (append-only, status_snapshot 은 건드리지 않는다)
    const note = `담당자 변경: ${nameOf(fromUserId)} → ${nameOf(toUserId)} (계정 비활성화에 따른 인수인계)`;
    await admin.from('page_updates').insert(
      rows.map((t) => ({
        page_id: t.id,
        author_id: me,
        content: note,
        progress_snapshot: t.progress,
        status_snapshot: null,
        blocker: null,
      })),
    );

    return { moved: rows.length };
  });
}

// ---------- 조직도 ----------
export async function createUnit(input: { parentId: string | null; name: string; level: '본부' | '실' | '팀' }) {
  return wrap(async () => {
    const { supabase } = await requireAdmin();
    const { data: max } = await supabase
      .from('org_units')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await supabase.from('org_units').insert({
      parent_id: input.parentId,
      name: input.name.trim(),
      level: input.level,
      sort_order: (max?.sort_order ?? 0) + 10,
    });
    if (error) throw new Error(error.message);
  });
}

export async function updateUnit(
  id: string,
  patch: { name?: string; parentId?: string | null; sortOrder?: number; writeScope?: '전원' | '리더' | '지정' },
) {
  return wrap(async () => {
    const { supabase } = await requireAdmin();
    if (patch.parentId === id) throw new Error('자기 자신을 상위 조직으로 지정할 수 없습니다');
    const row: Tables['org_units']['Update'] = {};
    if (patch.name !== undefined) row.name = patch.name.trim();
    if ('parentId' in patch) row.parent_id = patch.parentId;
    if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
    if (patch.writeScope !== undefined) row.write_scope = patch.writeScope;
    const { error } = await supabase.from('org_units').update(row).eq('id', id);
    if (error) throw new Error(error.message);
  });
}

/** '지정' 공간의 작성 가능 인원 교체 (전체 교체 방식) */
export async function setUnitWriters(unitId: string, userIds: string[]) {
  return wrap(async () => {
    const { supabase } = await requireAdmin();
    const { error: delErr } = await supabase.from('org_unit_writers').delete().eq('unit_id', unitId);
    if (delErr) throw new Error(delErr.message);
    if (userIds.length > 0) {
      const { error } = await supabase
        .from('org_unit_writers')
        .insert(userIds.map((user_id) => ({ unit_id: unitId, user_id })));
      if (error) throw new Error(error.message);
    }
  });
}

export async function deleteUnit(id: string) {
  return wrap(async () => {
    const { supabase } = await requireAdmin();
    const [{ count: kids }, { count: activeMembers }, { count: livePages }, { count: trashedPages }] =
      await Promise.all([
        supabase.from('org_units').select('id', { count: 'exact', head: true }).eq('parent_id', id),
        // 비활성(퇴사 처리) 멤버는 세지 않는다 — 삭제 시 소속이 '미지정' 으로 풀린다
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('unit_id', id).is('deactivated_at', null),
        supabase.from('pages').select('id', { count: 'exact', head: true }).eq('unit_id', id).is('archived_at', null),
        supabase.from('pages').select('id', { count: 'exact', head: true }).eq('unit_id', id).not('archived_at', 'is', null),
      ]);
    if (kids) throw new Error('하위 조직이 있어 삭제할 수 없습니다. 먼저 옮기거나 삭제하세요');
    if (activeMembers) throw new Error(`소속 인원 ${activeMembers}명이 있어 삭제할 수 없습니다. 먼저 소속을 옮기세요`);
    if (livePages || trashedPages) {
      const parts = [];
      if (livePages) parts.push(`페이지 ${livePages}개`);
      if (trashedPages) parts.push(`보관함의 페이지 ${trashedPages}개`);
      throw new Error(
        `이 공간에 ${parts.join(' + ')} 가 있어 삭제할 수 없습니다. ` +
          (livePages ? '페이지 상단에서 다른 공간으로 옮기거나 보관 후 ' : '') +
          '보관함에서 복구해 옮기거나 영구 삭제하세요',
      );
    }
    // 비활성 멤버의 소속을 미리 풀어 준다 (FK set null 과 같지만 명시적으로)
    const admin = createAdminClient();
    const { error: unsetErr } = await admin.from('profiles').update({ unit_id: null }).eq('unit_id', id);
    if (unsetErr) throw new Error(unsetErr.message);
    const { error } = await supabase.from('org_units').delete().eq('id', id);
    if (error) throw new Error(error.message);
  });
}
