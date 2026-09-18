import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CollectionView, type CollectionItem } from '@/components/collections/collection-view';
import type { OrgUnitRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

const COLLECTION_META: Record<string, { label: string; icon: string; dateLabel: string }> = {
  meeting: { label: '회의록', icon: '📝', dateLabel: '회의일' },
  weekly: { label: '주간 정리', icon: '🗓', dateLabel: '기준일' },
  notice: { label: '공지', icon: '📢', dateLabel: '게시일' },
};

export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ template: string }>;
  searchParams: Promise<{ unit?: string; period?: string }>;
}) {
  const { template } = await params;
  const { unit, period } = await searchParams;
  if (!COLLECTION_META[template]) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: pages }, { data: units }, { data: me }] = await Promise.all([
    supabase
      .from('pages')
      .select(
        'id, title, icon, type, template, unit_id, visibility, event_date, updated_at, created_at, content, author:profiles!pages_created_by_fkey(id, name, avatar_url)',
      )
      .eq('template', template)
      .is('archived_at', null)
      .order('event_date', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false })
      .limit(300),
    supabase.from('v_org_units').select('*'),
    supabase.from('profiles').select('id, name, unit_id, is_admin').eq('id', user!.id).maybeSingle(),
  ]);

  return (
    <CollectionView
      template={template}
      items={(pages ?? []) as unknown as CollectionItem[]}
      units={(units ?? []) as OrgUnitRow[]}
      me={{ id: user!.id, name: me?.name ?? '나', unitId: me?.unit_id ?? null }}
      initialUnit={unit ?? ''}
      initialPeriod={period ?? 'month'}
    />
  );
}
