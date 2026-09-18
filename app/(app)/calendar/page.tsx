import { createClient } from '@/lib/supabase/server';
import { MonthCalendar, type CalendarItem } from '@/components/calendar/month-calendar';
import type { OrgUnitRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

function monthRange(ym: string): [string, string, string] {
  const [y, m] = ym.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  const f = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return [f(first), f(last), `${y}-${pad(m)}`];
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ ym?: string; unit?: string }> }) {
  const { ym, unit } = await searchParams;
  const now = new Date();
  const cur = /^\d{4}-\d{2}$/.test(ym ?? '') ? ym! : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [from, to, month] = monthRange(cur);

  const supabase = await createClient();
  const [{ data: tasks }, { data: events }, { data: units }] = await Promise.all([
    supabase
      .from('pages')
      .select('id, title, icon, type, status, unit_id, due_date, assignee:profiles!pages_assignee_id_fkey(name)')
      .eq('type', 'task')
      .is('archived_at', null)
      .gte('due_date', from)
      .lte('due_date', to),
    supabase
      .from('pages')
      .select('id, title, icon, type, template, unit_id, event_date')
      .is('archived_at', null)
      .not('event_date', 'is', null)
      .gte('event_date', from)
      .lte('event_date', to),
    supabase.from('v_org_units').select('*'),
  ]);

  const items: CalendarItem[] = [
    ...(tasks ?? []).map((t) => ({
      id: t.id,
      date: t.due_date!,
      title: t.title,
      icon: t.icon,
      kind: 'task' as const,
      status: t.status,
      unitId: t.unit_id,
      who: (t.assignee as unknown as { name: string } | null)?.name ?? null,
    })),
    ...(events ?? []).map((e) => ({
      id: e.id,
      date: e.event_date!,
      title: e.title,
      icon: e.icon,
      kind: (e.template ?? 'doc') as CalendarItem['kind'],
      status: null,
      unitId: e.unit_id,
      who: null,
    })),
  ];

  return <MonthCalendar month={month} items={items} units={(units ?? []) as OrgUnitRow[]} initialUnit={unit ?? ''} />;
}
