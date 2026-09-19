import { createClient, getSessionUser } from '@/lib/supabase/server';
import { getStatuses, getUnits } from '@/lib/reference';
import { fetchTasks } from '@/lib/tasks';
import { TaskList } from '@/components/tasks/task-list';
import { LEADER_TITLES } from '@/lib/org';

export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  const [tasks, { data: people }, units, statuses, { data: me }] = await Promise.all([
    fetchTasks(supabase),
    supabase.from('profiles').select('id, name, avatar_url').is('deactivated_at', null).order('name'),
    getUnits(),
    getStatuses(),
    user
      ? supabase.from('profiles').select('is_admin, job_title').eq('id', user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const canManageStatuses =
    !!me && (me.is_admin || (LEADER_TITLES as readonly string[]).includes(me.job_title ?? ''));
  return (
    <TaskList
      tasks={tasks}
      people={people ?? []}
      units={units}
      statuses={statuses}
      meId={user?.id}
      canManageStatuses={canManageStatuses}
    />
  );
}
