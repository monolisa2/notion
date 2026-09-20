'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { applyEmailPlan, planEmailsFromCsv, type EmailPlanRow } from '@/app/(app)/admin/actions';

/**
 * 회사 메일 일괄 반영.
 *
 * 네이버웍스 "멤버 목록 내려받기" CSV 를 붙여넣으면 이름으로 짝을 지어
 * 로그인 메일을 <ID>@도메인 으로 바꾼다. **비밀번호는 건드리지 않는다.**
 *
 * 바로 바꾸지 않고 먼저 계획을 보여 준다 — 로그인 주소가 바뀌는 일이라
 * 잘못 짝지어지면 그 사람이 못 들어온다.
 */
export function EmailSync({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState('');
  const [domain, setDomain] = useState('enliple.com');
  const [plan, setPlan] = useState<EmailPlanRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  const changes = (plan ?? []).filter((r) => r.status === '변경');
  const same = (plan ?? []).filter((r) => r.status === '같음');
  const missing = (plan ?? []).filter((r) => r.status === '명단에 없음');

  const makePlan = async () => {
    setBusy(true);
    const r = await planEmailsFromCsv(csv, domain);
    setBusy(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setPlan(r.data);
    if (r.data.every((x) => x.status !== '변경')) toast.info('바꿀 것이 없습니다');
  };

  const apply = async () => {
    if (!window.confirm(`${changes.length}명의 로그인 메일을 바꿉니다.\n비밀번호는 그대로입니다. 계속할까요?`)) return;
    setBusy(true);
    const r = await applyEmailPlan(changes.map((c) => ({ userId: c.userId!, email: c.newEmail! })));
    setBusy(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(
      r.data.failed.length === 0
        ? `${r.data.done}명의 메일을 바꿨습니다`
        : `${r.data.done}명 완료 · ${r.data.failed.length}명 실패 (${r.data.failed[0].error})`,
    );
    setPlan(null);
    setCsv('');
    onDone();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        ✉️ 회사 메일 일괄 반영
      </button>
    );
  }

  return (
    <div className="mt-3 w-full rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">회사 메일 일괄 반영</h3>
        <button type="button" onClick={() => setOpen(false)} className="ml-auto text-xs text-zinc-400 hover:text-zinc-700">
          닫기
        </button>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-zinc-500">
        네이버웍스 관리자 &gt; 멤버 &gt; 내려받기(CSV) 내용을 그대로 붙여넣으세요. 이름이 정확히 같은 사람만 짝지어
        로그인 메일을 <code>아이디@도메인</code> 으로 바꿉니다. <b>비밀번호는 그대로</b>입니다.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-zinc-500">
          메일 도메인
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="w-40 rounded-md border border-zinc-200 px-2 py-1 text-xs outline-none dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <button
          type="button"
          disabled={busy || csv.trim().length === 0}
          onClick={() => void makePlan()}
          className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700"
        >
          {busy ? '확인 중…' : '미리보기'}
        </button>
      </div>

      <textarea
        value={csv}
        onChange={(e) => {
          setCsv(e.target.value);
          setPlan(null);
        }}
        rows={5}
        placeholder={'"성*","이름*","ID*",…\n"신","민철","mcshin",…'}
        className="mt-2 w-full rounded-md border border-zinc-200 px-3 py-2 font-mono text-[11px] outline-none dark:border-zinc-700 dark:bg-zinc-900"
      />

      {plan && (
        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="font-medium text-zinc-700 dark:text-zinc-200">바꿀 사람 {changes.length}명</span>
            <span className="text-zinc-400">이미 같음 {same.length}명</span>
            {missing.length > 0 && <span className="text-amber-700">명단에서 못 찾음 {missing.length}명</span>}
            {changes.length > 0 && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void apply()}
                className="ml-auto rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {busy ? '바꾸는 중…' : `${changes.length}명 적용`}
              </button>
            )}
          </div>

          {changes.length > 0 && (
            <ul className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-zinc-100 text-xs dark:border-zinc-800">
              {changes.map((r) => (
                <li key={r.userId} className="flex items-center gap-2 border-b border-zinc-50 px-3 py-1.5 last:border-0 dark:border-zinc-800">
                  <span className="w-16 shrink-0 font-medium">{r.name}</span>
                  <span className="truncate text-zinc-400 line-through">{r.currentEmail ?? '(없음)'}</span>
                  <span className="shrink-0 text-zinc-300">→</span>
                  <span className="truncate font-medium text-zinc-800 dark:text-zinc-100">{r.newEmail}</span>
                </li>
              ))}
            </ul>
          )}

          {missing.length > 0 && (
            <p className="mt-2 text-xs leading-relaxed text-amber-700">
              명단에서 못 찾음: {missing.map((r) => r.name).join(', ')}
              <br />
              <span className="text-amber-700/70">
                이름이 다르거나(동명이인 포함) 네이버웍스에 없는 분입니다. 표에서 이메일을 직접 고쳐 주세요.
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
