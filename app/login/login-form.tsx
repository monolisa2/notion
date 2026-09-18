'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const MESSAGES: Record<string, string> = {
  'Invalid login credentials': '이메일 또는 비밀번호가 맞지 않습니다.',
  'Email not confirmed': '아직 사용할 수 없는 계정입니다. 관리자에게 문의하세요.',
  'User is banned': '비활성화된 계정입니다. 관리자에게 문의하세요.',
};

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setError(MESSAGES[error.message] ?? `로그인 실패: ${error.message}`);
      setPending(false);
      return;
    }
    const dest = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
    router.replace(dest);
    router.refresh();
  };

  const input =
    'mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-zinc-700';

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm">
        <span className="text-zinc-600 dark:text-zinc-300">회사 이메일</span>
        <input
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@enliple.com"
          className={input}
        />
      </label>
      <label className="block text-sm">
        <span className="text-zinc-600 dark:text-zinc-300">비밀번호</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={input}
        />
      </label>
      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? '확인 중…' : '로그인'}
      </button>
    </form>
  );
}
