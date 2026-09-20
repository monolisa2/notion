'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Avatar } from '@/components/avatar';

type Viewer = { id: string; name: string; avatarUrl: string | null };

/**
 * 지금 이 페이지를 같이 보고 있는 사람 (Realtime presence).
 *
 * 공동 편집(CRDT)은 만들지 않기로 했다. 대신 **누가 같이 있는지 보이게** 해서
 * 같은 문서를 동시에 고쳐 덮어쓰는 일을 사람이 먼저 알아채게 한다.
 * presence 는 서버에 아무것도 저장하지 않는다 (연결이 끊기면 사라짐).
 */
export function PagePresence({ pageId, me }: { pageId: string; me: Viewer }) {
  const supabase = useMemo(() => createClient(), []);
  const [others, setOthers] = useState<Viewer[]>([]);

  useEffect(() => {
    const channel = supabase.channel(`presence:page:${pageId}`, {
      config: { presence: { key: me.id } },
    });

    const sync = () => {
      const state = channel.presenceState<Viewer>();
      const list: Viewer[] = [];
      for (const [key, metas] of Object.entries(state)) {
        if (key === me.id) continue;
        const m = metas[0];
        if (m) list.push({ id: key, name: m.name, avatarUrl: m.avatarUrl ?? null });
      }
      setOthers(list);
    };

    channel
      .on('presence', { event: 'sync' }, sync)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void channel.track({ id: me.id, name: me.name, avatarUrl: me.avatarUrl });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, pageId, me.id, me.name, me.avatarUrl]);

  if (others.length === 0) return null;

  return (
    <span
      className="flex shrink-0 items-center -space-x-1.5"
      title={`지금 같이 보는 중: ${others.map((o) => o.name).join(', ')}`}
    >
      {others.slice(0, 3).map((o) => (
        <span key={o.id} className="rounded-full ring-2 ring-white dark:ring-zinc-900">
          <Avatar name={o.name} src={o.avatarUrl} size={18} />
        </span>
      ))}
      {others.length > 3 && <span className="pl-2.5 text-[11px] text-zinc-400">+{others.length - 3}</span>}
    </span>
  );
}
