'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/errors';
import { Avatar } from '@/components/avatar';

type Profile = {
  id: string;
  name: string;
  avatar_url: string | null;
  notify_mention: boolean;
  notify_assign: boolean;
  notify_due: boolean;
};

const NOTIFY_FIELDS = [
  { key: 'notify_mention', label: '멘션 · 댓글', hint: '누가 나를 @언급하거나 내 페이지에 댓글을 달 때' },
  { key: 'notify_assign', label: '업무 배정', hint: '나에게 업무 담당이 지정될 때' },
  { key: 'notify_due', label: '기한 알림', hint: '기한 3일 전과 당일 (평일 오전 9시)' },
] as const;

const MAX_AVATAR = 2 * 1024 * 1024;

/**
 * 공개 URL 에서 버킷 안 경로(<uid>/<파일명>)를 되짚는다.
 * 사진을 바꿀 때마다 옛 파일이 그대로 남으면 1GB 를 야금야금 먹는다.
 */
function avatarPathOf(url: string | null, userId: string): string | null {
  if (!url) return null;
  const i = url.indexOf('/avatars/');
  if (i < 0) return null;
  const path = decodeURIComponent(url.slice(i + '/avatars/'.length).split('?')[0]);
  // 남의 폴더는 건드리지 않는다 (정책상 실패하지만 호출 자체를 막는다)
  return path.startsWith(`${userId}/`) ? path : null;
}

export function AccountForm({ profile }: { profile: Profile }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(profile.name);
  const [avatar, setAvatar] = useState(profile.avatar_url);
  const [notify, setNotify] = useState({
    notify_mention: profile.notify_mention,
    notify_assign: profile.notify_assign,
    notify_due: profile.notify_due,
  });
  const [busy, setBusy] = useState(false);

  const saveName = async () => {
    const next = name.trim();
    if (!next) {
      toast.error('이름을 입력하세요');
      setName(profile.name);
      return;
    }
    if (next === profile.name) return;
    const { error } = await supabase.from('profiles').update({ name: next }).eq('id', profile.id);
    if (error) {
      toast.error(`이름 저장 실패: ${errorMessage(error)}`);
      setName(profile.name);
      return;
    }
    toast.success('이름을 바꿨습니다');
    router.refresh();
  };

  const saveNotify = async (key: keyof typeof notify, value: boolean) => {
    const prev = notify;
    setNotify({ ...prev, [key]: value });
    const patch =
      key === 'notify_mention'
        ? { notify_mention: value }
        : key === 'notify_assign'
          ? { notify_assign: value }
          : { notify_due: value };
    const { error } = await supabase.from('profiles').update(patch).eq('id', profile.id);
    if (error) {
      setNotify(prev);
      toast.error(`알림 설정 저장 실패: ${errorMessage(error)}`);
    }
  };

  const uploadAvatar = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('이미지 파일만 올릴 수 있습니다');
      return;
    }
    if (file.size > MAX_AVATAR) {
      toast.error('사진은 2MB 까지 올릴 수 있습니다');
      return;
    }
    setBusy(true);
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().slice(0, 5);
    // 본인 폴더에만 쓸 수 있다 (0018 storage 정책). 파일명을 매번 새로 만들어 캐시를 피한다
    const path = `${profile.id}/${Date.now()}.${ext}`;
    try {
      const up = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (up.error) throw up.error;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const url = data.publicUrl;
      const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', profile.id);
      if (error) throw error;
      // 성공한 뒤에 옛 파일 정리 (실패해도 사진 교체는 이미 끝난 것이라 조용히 넘어간다)
      const old = avatarPathOf(avatar, profile.id);
      if (old) await supabase.storage.from('avatars').remove([old]).catch(() => undefined);
      setAvatar(url);
      toast.success('프로필 사진을 바꿨습니다');
      router.refresh();
    } catch (e) {
      toast.error(`사진 업로드 실패: ${errorMessage(e)}`);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeAvatar = async () => {
    setBusy(true);
    const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', profile.id);
    if (!error) {
      const old = avatarPathOf(avatar, profile.id);
      if (old) await supabase.storage.from('avatars').remove([old]).catch(() => undefined);
    }
    setBusy(false);
    if (error) {
      toast.error(`사진 삭제 실패: ${errorMessage(error)}`);
      return;
    }
    setAvatar(null);
    router.refresh();
  };

  return (
    <>
      <section className="mt-6 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">프로필</h2>

        <div className="mt-3 flex items-center gap-4">
          <Avatar name={name || '나'} src={avatar} size={56} />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              {busy ? '올리는 중…' : '사진 올리기'}
            </button>
            {avatar && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void removeAvatar()}
                className="rounded-md px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800"
              >
                지우기
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadAvatar(f);
              }}
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-zinc-400">JPG · PNG, 2MB 까지. 댓글·업무·멘션에 이 사진이 함께 나옵니다.</p>

        <label className="mt-4 block">
          <span className="text-xs text-zinc-500">이름</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => void saveName()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            maxLength={20}
            className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-1.5 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <p className="mt-1 text-xs text-zinc-400">입력 후 다른 곳을 누르면 저장됩니다.</p>
      </section>

      <section className="mt-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">알림 받기</h2>
        <p className="mt-1 text-xs text-zinc-400">사이드바 🔔 에 표시되는 알림입니다. 끄면 그 종류는 쌓이지 않습니다.</p>
        <ul className="mt-3 space-y-2">
          {NOTIFY_FIELDS.map((f) => (
            <li key={f.key}>
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={notify[f.key]}
                  onChange={(e) => void saveNotify(f.key, e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-sm">{f.label}</span>
                  <span className="block text-xs text-zinc-400">{f.hint}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
