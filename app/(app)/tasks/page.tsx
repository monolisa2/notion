import { createClient } from '@/lib/supabase/server';
import { fetchTasks } from '@/lib/tasks';
import { TaskList } from '@/components/tasks/task-list';
import type { OrgUnitRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const supabase = await createClient();
  const [tasks, { data: people }, { data: units }] = await Promise.all([
    fetchTasks(supabase),
    supabase.from('profiles').select('id, name, avatar_url').is('deactivated_at', null).order('name'),
    supabase.from('v_org_units').select('*'),
  ]);
  return <TaskList tasks={tasks} people={people ?? []} units={(units ?? []) as OrgUnitRow[]} />;
}
