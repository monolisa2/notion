import { createClient } from '@/lib/supabase/server';
import { fetchTasks } from '@/lib/tasks';
import { TaskList } from '@/components/tasks/task-list';

export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const supabase = await createClient();
  const [tasks, { data: people }] = await Promise.all([
    fetchTasks(supabase),
    supabase.from('profiles').select('id, name, avatar_url').is('deactivated_at', null).order('name'),
  ]);
  return <TaskList tasks={tasks} people={people ?? []} />;
}
