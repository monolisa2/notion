'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export type Person = { id: string; name: string; avatar_url: string | null };

/** 활성 사용자 목록 (멘션 자동완성 / 담당자 선택용) */
export function usePeople() {
  const supabase = useMemo(() => createClient(), []);
  const [people, setPeople] = useState<Person[]>([]);
  useEffect(() => {
    let cancelled = false;
    supabase
      .from('profiles')
      .select('id, name, avatar_url')
      .is('deactivated_at', null)
      .order('name')
      .then(({ data }) => {
        if (!cancelled) setPeople(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase]);
  return people;
}
