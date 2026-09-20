'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/errors';
import { markPasswordChanged } from './actions';

export function PasswordForm({ first }: { first: boolean }) {
  const router = useRouter();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return toast.error('비밀번호는 8자 이상이어야 합니다');
    if (pw !== pw2) return toast.error('두 비밀번호가 서로 다릅니다');
    setPending(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      await markPasswordChanged();
      toast.success('비밀번호를 변경했습니다');
      router.replace('/');
      router.refresh();
    } catch (err) {
      const msg = errorMessage(err);
      toast.error(
        msg.includes('different from the old')
          ? '임시 비밀번호와 다른 비밀번호를 정해주세요'
          : `변경 실패: ${msg}`,
      );
      setPending(false);
    }
  };

  const input =
    'mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-zinc-700';

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm">
        <span className="text-zinc-600 dark:text-zinc-300">새 비밀번호 (8자 이상)</span>
        <input type="password" autoComplete="new-password" required minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} className={input} />
      </label>
      <label className="block text-sm">
        <span className="text-zinc-600 dark:text-zinc-300">새 비밀번호 확인</span>
        <input type="password" autoComplete="new-password" required minLength={8} value={pw2} onChange={(e) => setPw2(e.target.value)} className={input} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="btn-primary w-full rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-60"
      >
        {pending ? '변경 중…' : first ? '변경하고 시작하기' : '변경'}
      </button>
      {!first && (
        <button type="button" onClick={() => router.back()} className="w-full text-sm text-zinc-500 hover:underline">
          취소
        </button>
      )}
    </form>
  );
}
