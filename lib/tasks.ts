import type { Db } from './pages';
import type { PageRow } from './types';

export type TaskRow = Pick<
  PageRow,
  'id' | 'title' | 'icon' | 'status' | 'priority' | 'progress' | 'due_date' | 'assignee_id' | 'updated_at' | 'created_at'
> & { assignee: { id: string; name: string; avatar_url: string | null } | null };

export async function fetchTasks(sb: Db): Promise<TaskRow[]> {
  const { data, error } = await sb
    .from('pages')
    .select(
      'id, title, icon, status, priority, progress, due_date, assignee_id, updated_at, created_at, assignee:profiles!pages_assignee_id_fkey(id, name, avatar_url)',
    )
    .eq('type', 'task')
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as unknown as TaskRow[];
}
