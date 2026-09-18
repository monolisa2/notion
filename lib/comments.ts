import type { Db } from './pages';
import type { Tables } from './types';

export type CommentRow = Tables['comments']['Row'];
export type CommentWithAuthor = CommentRow & {
  author: { id: string; name: string; avatar_url: string | null } | null;
};

const SELECT =
  '*, author:profiles!comments_author_id_fkey(id, name, avatar_url)';

export async function fetchComments(sb: Db, pageId: string): Promise<CommentWithAuthor[]> {
  const { data, error } = await sb
    .from('comments')
    .select(SELECT)
    .eq('page_id', pageId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as CommentWithAuthor[];
}

export async function setCommentResolved(sb: Db, id: string, resolved: boolean, byId: string) {
  const { error } = await sb
    .from('comments')
    .update(
      resolved
        ? { resolved_at: new Date().toISOString(), resolved_by: byId }
        : { resolved_at: null, resolved_by: null },
    )
    .eq('id', id);
  if (error) throw error;
}

export async function deleteComment(sb: Db, id: string) {
  const { error } = await sb.from('comments').delete().eq('id', id);
  if (error) throw error;
}
