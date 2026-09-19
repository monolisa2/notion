'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { JOB_TITLES, RANKS, type OrgUnitRow } from '@/lib/types';
import {
  createMember,
  createMembersBulk,
  createUnit,
  deleteUnit,
  resetPassword,
  setActive,
  setUnitWriters,
  updateMember,
  updateUnit,
} from '@/app/(app)/admin/actions';

type Member = {
  id: string;
  name: string;
  email: string | null;
  unit_id: string | null;
  rank: string | null;
  job_title: string | null;
  is_admin: boolean;
  deactivated_at: string | null;
  must_change_password: boolean;
  created_at: string;
  last_sign_in_at?: string | null;
};

function fmtBytes(n: number) {
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
function ago(iso: string | null | undefined) {
  if (!iso) return '없음';
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (d < 1) return '오늘';
  if (d < 2) return '어제';
  return `${Math.floor(d)}일 전`;
}

type Issued = { name: string; email: string; tempPassword: string };

const select =
  'rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs outline-none disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900';
const btn = 'rounded-md border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800';

/** 조직 트리를 들여쓰기 라벨 목록으로 (select 옵션용) */
function unitOptions(units: OrgUnitRow[]) {
  const byParent = new Map<string | null, OrgUnitRow[]>();
  for (const u of units) {
    const k = u.parent_id ?? null;
    byParent.set(k, [...(byParent.get(k) ?? []), u]);
  }
  const out: { id: string; label: string; depth: number; unit: OrgUnitRow }[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const u of (byParent.get(parent) ?? []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))) {
      if (!u.id) continue;
      out.push({ id: u.id, label: `${'　'.repeat(depth)}${u.name}`, depth, unit: u });
      walk(u.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

export function AdminPanel({
  meId,
  members,
  units,
  writers = [],
  serviceKeyConfigured,
  storageBytes = 0,
  recentLoginCount = 0,
}: {
  meId: string;
  members: Member[];
  units: OrgUnitRow[];
  writers?: { unit_id: string; user_id: string }[];
  serviceKeyConfigured: boolean;
  storageBytes?: number;
  recentLoginCount?: number;
}) {
  const STORAGE_LIMIT = 1024 * 1024 * 1024; // 무료 플랜 1GB
  const router = useRouter();
  const [tab, setTab] = useState<'members' | 'org'>('members');
  const [issued, setIssued] = useState<Issued[]>([]);
  const options = useMemo(() => unitOptions(units), [units]);
  const unitName = (id: string | null) => units.find((u) => u.id === id)?.name ?? '미지정';

  const run = async <T,>(p: Promise<{ ok: true; data: T } | { ok: false; error: string }>, done?: (d: T) => void) => {
    const r = await p;
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    done?.(r.data);
    router.refresh();
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8 sm:px-8">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">관리자</h1>
        <div className="ml-4 flex gap-1 rounded-lg border border-zinc-200 p-0.5">
          {(['members', 'org'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium ${tab === t ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-100'}`}
            >
              {t === 'members' ? `👥 멤버 관리 (${members.filter((m) => !m.deactivated_at).length})` : `🏢 조직도 관리 (${units.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        {[
          ['멤버', `${members.filter((m) => !m.deactivated_at).length}명`, `비활성 ${members.filter((m) => m.deactivated_at).length}`],
          ['첫 로그인 대기', `${members.filter((m) => !m.deactivated_at && m.must_change_password).length}명`, '임시 비밀번호 상태'],
          ['최근 7일 로그인', `${recentLoginCount}명`, serviceKeyConfigured ? '' : '서버 키 필요'],
          ['첨부 파일 용량', fmtBytes(storageBytes), `무료 한도 1GB 의 ${Math.round((storageBytes / STORAGE_LIMIT) * 100)}%`],
        ].map(([k, v, d]) => (
          <div key={k} className="rounded-xl border border-zinc-200 p-3">
            <div className="text-[11px] text-zinc-500">{k}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{v}</div>
            {d && <div className="text-[11px] text-zinc-400">{d}</div>}
          </div>
        ))}
      </div>

      {!serviceKeyConfigured && (
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          서버에 <code>SUPABASE_SERVICE_ROLE_KEY</code> 가 없어 계정 생성·비밀번호 초기화·비활성화를 할 수 없습니다.
          .env.local(로컬) 또는 Vercel 환경변수에 넣고 서버를 다시 시작하세요. 소속·직급·권한 변경은 됩니다.
        </p>
      )}

      {issued.length > 0 && <IssuedPasswords items={issued} onClose={() => setIssued([])} />}

      {tab === 'members' ? (
        <MembersTab
          meId={meId}
          members={members}
          options={options}
          unitName={unitName}
          canAuth={serviceKeyConfigured}
          onIssued={(list) => setIssued((prev) => [...list, ...prev])}
          run={run}
        />
      ) : (
        <OrgTab options={options} members={members} writers={writers} run={run} />
      )}
    </div>
  );
}

// ---------------- 멤버 ----------------
function MembersTab({
  meId,
  members,
  options,
  unitName,
  canAuth,
  onIssued,
  run,
}: {
  meId: string;
  members: Member[];
  options: ReturnType<typeof unitOptions>;
  unitName: (id: string | null) => string;
  canAuth: boolean;
  onIssued: (list: Issued[]) => void;
  run: <T>(p: Promise<{ ok: true; data: T } | { ok: false; error: string }>, done?: (d: T) => void) => Promise<void>;
}) {
  const [form, setForm] = useState({ name: '', email: '', unitId: '', rank: '', jobTitle: '팀원' });
  const [bulk, setBulk] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [q, setQ] = useState('');

  const query = q.trim().toLowerCase();
  const visible = members.filter((m) => {
    if (!showInactive && m.deactivated_at) return false;
    if (!query) return true;
    return [m.name, m.email ?? '', unitName(m.unit_id), m.rank ?? '', m.job_title ?? '']
      .join(' ')
      .toLowerCase()
      .includes(query);
  });

  const submitOne = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await run(
      createMember({
        name: form.name,
        email: form.email,
        unitId: form.unitId || null,
        rank: form.rank || null,
        jobTitle: form.jobTitle || null,
      }),
      (d) => {
        onIssued([{ name: form.name, email: d.email, tempPassword: d.tempPassword }]);
        setForm({ name: '', email: '', unitId: form.unitId, rank: '', jobTitle: '팀원' });
        toast.success('계정을 만들었습니다. 임시 비밀번호를 전달하세요');
      },
    );
    setBusy(false);
  };

  const submitBulk = async () => {
    setBusy(true);
    await run(createMembersBulk(bulk), (rows) => {
      const ok = rows.filter((r) => r.ok);
      const bad = rows.filter((r) => !r.ok);
      onIssued(
        ok.map((r) => {
          const [name, email] = r.line.split(/\s*[,\t]\s*/);
          return { name, email, tempPassword: r.tempPassword! };
        }),
      );
      if (bad.length) toast.error(`${bad.length}줄 실패:\n${bad.map((b) => `${b.line} → ${b.error}`).join('\n')}`, { duration: 12000 });
      if (ok.length) toast.success(`${ok.length}명 등록`);
      setBulk(bad.map((b) => b.line).join('\n'));
      if (!bad.length) setBulkOpen(false);
    });
    setBusy(false);
  };

  return (
    <>
      {/* 계정 만들기 */}
      <section className="mt-6 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">계정 만들기</h2>
          <span className="ml-1 text-xs text-zinc-400">실·팀을 만들거나 없애려면 위의 🏢 조직도 관리 탭</span>
          <button type="button" onClick={() => setBulkOpen((v) => !v)} className="text-xs text-blue-600 hover:underline dark:text-blue-400">
            {bulkOpen ? '한 명씩 등록' : '명단 붙여넣기(일괄)'}
          </button>
        </div>

        {bulkOpen ? (
          <div className="mt-3">
            <p className="text-xs text-zinc-500">
              한 줄에 한 명. <b>이름, 이메일, 소속, 직급, 직책</b> 순서로 쉼표(또는 탭) 구분. 소속은 조직 이름 그대로(예: 회계팀). 직급·직책은 비워도 됩니다.
            </p>
            <textarea
              rows={8}
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              placeholder={'유숙진, ysj@enliple.com, 재무팀, 차장, 팀장\n김수연, ksy@enliple.com, 재무팀, 과장, 팀원'}
              className="mt-2 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 font-mono text-xs outline-none focus:border-blue-500 dark:border-zinc-700"
            />
            <button type="button" disabled={busy || !canAuth || !bulk.trim()} onClick={() => void submitBulk()} className="mt-2 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
              {busy ? '등록 중…' : '일괄 등록'}
            </button>
          </div>
        ) : (
          <form onSubmit={submitOne} className="mt-3 grid gap-2 sm:grid-cols-6">
            <input required placeholder="이름" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`${select} py-1.5`} />
            <input required type="email" placeholder="회사 이메일" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={`${select} py-1.5 sm:col-span-2`} />
            <select value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })} className={`${select} py-1.5`}>
              <option value="">소속 선택</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
            <select value={form.rank} onChange={(e) => setForm({ ...form, rank: e.target.value })} className={`${select} py-1.5`}>
              <option value="">직급</option>
              {RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <div className="flex gap-2">
              <select value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} className={`${select} flex-1 py-1.5`}>
                {JOB_TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <button type="submit" disabled={busy || !canAuth} className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
                만들기
              </button>
            </div>
          </form>
        )}
      </section>

      {/* 멤버 표 */}
      <section className="mt-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold">멤버</h2>
          <label className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-2 py-1 text-zinc-400 focus-within:border-zinc-400">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="이름·이메일·소속 검색"
              className="w-44 bg-transparent text-xs text-zinc-800 outline-none placeholder:text-zinc-400"
            />
            {q && (
              <button type="button" onClick={() => setQ('')} aria-label="검색 지우기" className="text-zinc-400 hover:text-zinc-600">×</button>
            )}
          </label>
          {query && <span className="text-xs text-zinc-400">{visible.length}명</span>}
          <label className="flex items-center gap-1.5 text-xs text-zinc-500">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> 비활성 포함
          </label>
        </div>
        <div className="mt-2 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-zinc-50 text-left text-[11px] text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2 font-normal">이름</th>
                <th className="px-3 py-2 font-normal">이메일</th>
                <th className="px-3 py-2 font-normal">소속</th>
                <th className="px-3 py-2 font-normal">직급</th>
                <th className="px-3 py-2 font-normal">직책</th>
                <th className="px-3 py-2 font-normal">관리자</th>
                <th className="px-3 py-2 font-normal">상태</th>
                <th className="px-3 py-2 font-normal">마지막 로그인</th>
                <th className="px-3 py-2 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((m) => {
                const inactive = !!m.deactivated_at;
                return (
                  <tr key={m.id} className={`border-t border-zinc-100 ${inactive ? 'bg-zinc-50 text-zinc-400' : ''}`}>
                    <td className="px-3 py-1.5">
                      <input
                        defaultValue={m.name}
                        onBlur={(e) => e.target.value.trim() !== m.name && void run(updateMember(m.id, { name: e.target.value }))}
                        className="w-24 rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-zinc-200 focus:border-blue-400 focus:outline-none dark:hover:border-zinc-700"
                      />
                      {m.id === meId && <span className="ml-1 text-[10px] text-zinc-400">(나)</span>}
                    </td>
                    <td className="px-3 py-1.5 text-xs text-zinc-500">{m.email}</td>
                    <td className="px-3 py-1.5">
                      <select value={m.unit_id ?? ''} onChange={(e) => void run(updateMember(m.id, { unitId: e.target.value || null }))} className={select}>
                        <option value="">미지정</option>
                        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-1.5">
                      <select value={m.rank ?? ''} onChange={(e) => void run(updateMember(m.id, { rank: e.target.value || null }))} className={select}>
                        <option value="">–</option>
                        {RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-1.5">
                      <select value={m.job_title ?? ''} onChange={(e) => void run(updateMember(m.id, { jobTitle: e.target.value || null }))} className={select}>
                        <option value="">–</option>
                        {JOB_TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="checkbox"
                        checked={m.is_admin}
                        disabled={m.id === meId}
                        onChange={(e) => void run(updateMember(m.id, { isAdmin: e.target.checked }))}
                      />
                    </td>
                    <td className="px-3 py-1.5 text-xs">
                      {inactive ? (
                        <span className="text-zinc-400">비활성</span>
                      ) : m.must_change_password ? (
                        <span className="text-amber-600">첫 로그인 대기</span>
                      ) : (
                        <span className="text-emerald-600">사용 중</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-xs text-zinc-500">{ago(m.last_sign_in_at)}</td>
                    <td className="px-3 py-1.5">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          disabled={!canAuth}
                          className={btn}
                          onClick={() => {
                            if (!window.confirm(`${m.name} 님의 비밀번호를 초기화할까요? 기존 비밀번호는 즉시 무효가 됩니다.`)) return;
                            void run(resetPassword(m.id), (d) => onIssued([{ name: m.name, email: m.email ?? '', tempPassword: d.tempPassword }]));
                          }}
                        >
                          비번 초기화
                        </button>
                        {m.id !== meId && (
                          <button
                            type="button"
                            disabled={!canAuth}
                            className={
                              inactive
                                ? 'rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50'
                                : `${btn} text-red-600`
                            }
                            onClick={() => {
                              const msg = inactive
                                ? `${m.name} 님을 다시 활성화할까요? 로그인이 다시 열립니다.`
                                : `${m.name} 님을 비활성화할까요? 로그인이 차단되고 목록에서 숨겨집니다.`;
                              if (window.confirm(msg)) void run(setActive(m.id, inactive));
                            }}
                          >
                            {inactive ? '복구' : '비활성화'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-sm text-zinc-400">{query ? `"${q.trim()}" 에 맞는 멤버가 없습니다` : '멤버가 없습니다'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-zinc-400">소속 인원: {options.map((o) => `${o.unit.name} ${members.filter((m) => m.unit_id === o.id && !m.deactivated_at).length}`).join(' · ')} · 미지정 {members.filter((m) => !m.unit_id && !m.deactivated_at).length} — {unitName(null) === '미지정' ? '' : ''}</p>
      </section>
    </>
  );
}

function IssuedPasswords({ items, onClose }: { items: Issued[]; onClose: () => void }) {
  const text = items.map((i) => `${i.name} (${i.email})  임시 비밀번호: ${i.tempPassword}`).join('\n');
  return (
    <section className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
          임시 비밀번호 {items.length}건 — 지금만 볼 수 있습니다. 네이버웍스로 본인에게 전달하세요
        </h2>
        <div className="flex gap-2">
          <button type="button" className={btn} onClick={() => { void navigator.clipboard.writeText(text); toast.success('복사했습니다'); }}>
            전체 복사
          </button>
          <button type="button" className={btn} onClick={onClose}>닫기</button>
        </div>
      </div>
      <pre className="mt-3 whitespace-pre-wrap rounded-md bg-white p-3 font-mono text-xs dark:bg-zinc-900">{text}</pre>
      <p className="mt-2 text-xs text-emerald-800/80 dark:text-emerald-300/80">
        첫 로그인 때 본인이 비밀번호를 새로 정하게 됩니다. 이 화면을 닫으면 다시 볼 수 없고, 필요하면 &ldquo;비번 초기화&rdquo;로 새로 발급하세요.
      </p>
    </section>
  );
}

// ---------------- 조직도 ----------------
function OrgTab({
  options,
  members,
  writers,
  run,
}: {
  options: ReturnType<typeof unitOptions>;
  members: Member[];
  writers: { unit_id: string; user_id: string }[];
  run: <T>(p: Promise<{ ok: true; data: T } | { ok: false; error: string }>, done?: (d: T) => void) => Promise<void>;
}) {
  const [form, setForm] = useState<{ parentId: string; name: string; level: '본부' | '실' | '팀' }>({ parentId: '', name: '', level: '팀' });
  // '지정' 인원 편집 중인 조직
  const [editingWriters, setEditingWriters] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const activeMembers = members.filter((m) => !m.deactivated_at);
  const writersOf = (unitId: string) => writers.filter((w) => w.unit_id === unitId).map((w) => w.user_id);
  const openWriters = (unitId: string) => {
    setEditingWriters(unitId);
    setPicked(new Set(writersOf(unitId)));
  };

  return (
    <>
      <section className="mt-6 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">조직 추가</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(createUnit({ parentId: form.parentId || null, name: form.name, level: form.level }), () => setForm({ ...form, name: '' }));
          }}
          className="mt-3 flex flex-wrap gap-2"
        >
          <select value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })} className={`${select} py-1.5`}>
            <option value="">(최상위)</option>
            {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value as '본부' | '실' | '팀' })} className={`${select} py-1.5`}>
            <option value="본부">본부</option><option value="실">실</option><option value="팀">팀</option>
          </select>
          <input required placeholder="조직 이름" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`${select} py-1.5`} />
          <button type="submit" className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">추가</button>
        </form>
      </section>

      <section className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-zinc-50 text-left text-[11px] text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2 font-normal">조직</th>
              <th className="px-3 py-2 font-normal">단계</th>
              <th className="px-3 py-2 font-normal">상위 조직</th>
              <th className="px-3 py-2 font-normal">순서</th>
              <th className="px-3 py-2 font-normal">인원</th>
              <th className="px-3 py-2 font-normal">작성 권한</th>
              <th className="px-3 py-2 font-normal"></th>
            </tr>
          </thead>
          <tbody>
            {options.map(({ id, unit, depth }) => (
              <tr key={id} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="px-3 py-1.5" style={{ paddingLeft: 12 + depth * 18 }}>
                  <input
                    defaultValue={unit.name ?? ''}
                    onBlur={(e) => e.target.value.trim() !== unit.name && void run(updateUnit(id, { name: e.target.value }))}
                    className="rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-zinc-200 focus:border-blue-400 focus:outline-none dark:hover:border-zinc-700"
                  />
                </td>
                <td className="px-3 py-1.5 text-xs text-zinc-500">{unit.level}</td>
                <td className="px-3 py-1.5">
                  <select value={unit.parent_id ?? ''} onChange={(e) => void run(updateUnit(id, { parentId: e.target.value || null }))} className={select}>
                    <option value="">(최상위)</option>
                    {options.filter((o) => o.id !== id).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="number"
                    defaultValue={unit.sort_order ?? 0}
                    onBlur={(e) => Number(e.target.value) !== unit.sort_order && void run(updateUnit(id, { sortOrder: Number(e.target.value) }))}
                    className={`${select} w-16`}
                  />
                </td>
                <td className="px-3 py-1.5 text-xs tabular-nums">{unit.member_count ?? 0}</td>
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-1">
                    <select
                      value={unit.write_scope ?? '전원'}
                      onChange={(e) => void run(updateUnit(id, { writeScope: e.target.value as '전원' | '리더' | '지정' }))}
                      className={select}
                      title="이 공간에 새 페이지를 만들 수 있는 사람"
                    >
                      <option value="전원">전원</option>
                      <option value="리더">팀장·실장 이상</option>
                      <option value="지정">지정 인원</option>
                    </select>
                    {(unit.write_scope ?? '전원') === '지정' && (
                      <button type="button" className={btn} onClick={() => openWriters(id)}>
                        인원 {writersOf(id).length}명
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-3 py-1.5 text-right">
                  <button
                    type="button"
                    className={`${btn} text-red-600`}
                    onClick={() => window.confirm(`"${unit.name}" 을 삭제할까요? 활성 인원·하위 조직·페이지(보관함 포함)가 없어야 합니다. 비활성 멤버는 소속이 [미지정] 으로 바뀝니다.`) && void run(deleteUnit(id))}
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-3 py-2 text-xs text-zinc-400">
          이름·순서는 칸을 고친 뒤 바깥을 클릭하면 저장됩니다. 합병으로 조직이 바뀌면 여기서 이름을 바꾸거나 상위 조직을 옮기세요. 기존 페이지·인원은 그대로 따라갑니다.
          <br />
          작성 권한은 &ldquo;그 공간에 새 페이지를 만들 수 있는 사람&rdquo; 입니다 (보기는 공개 범위를 따릅니다). 관리자는 항상 만들 수 있습니다.
        </p>
      </section>

      {/* 지정 인원 선택 */}
      {editingWriters && (
        <>
          <div className="fixed inset-0 z-30 bg-black/30" onMouseDown={() => setEditingWriters(null)} />
          <div className="fixed left-1/2 top-1/2 z-40 max-h-[70vh] w-[min(420px,90vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-4 shadow-xl">
            <h3 className="text-sm font-semibold">
              작성 가능 인원 — {options.find((o) => o.id === editingWriters)?.unit.name}
            </h3>
            <p className="mt-1 text-xs text-zinc-500">체크한 사람(과 관리자)만 이 공간에 새 페이지를 만들 수 있습니다.</p>
            <ul className="mt-3 space-y-1">
              {activeMembers.map((m) => (
                <li key={m.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-zinc-50">
                    <input
                      type="checkbox"
                      checked={picked.has(m.id)}
                      onChange={(e) =>
                        setPicked((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(m.id);
                          else next.delete(m.id);
                          return next;
                        })
                      }
                    />
                    <span>{m.name}</span>
                    <span className="text-xs text-zinc-400">{[m.rank, m.job_title].filter(Boolean).join(' · ')}</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={btn} onClick={() => setEditingWriters(null)}>
                취소
              </button>
              <button
                type="button"
                className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-700"
                onClick={() => {
                  const unitId = editingWriters;
                  setEditingWriters(null);
                  void run(setUnitWriters(unitId, [...picked]));
                }}
              >
                저장
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
