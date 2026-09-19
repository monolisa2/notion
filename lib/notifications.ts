import type { Db } from './pages';
import type { Tables } from './types';

export type NotificationRow = Tables['notifications']['Row'];
export type NotificationKind = 'mention' | 'assigned' | 'comment' | 'due_soon' | 'stale';

export const KIND_META: Record<NotificationKind, { icon: string; label: string }> = {
  mention: { icon: '@', label: '멘션' },
  assigned: { icon: '👤', label: '배정' },
  comment: { icon: '💬', label: '댓글' },
  due_soon: { icon: '⏰', label: '기한' },
  stale: { icon: '🕒', label: '정체' },
};

export async function fetchNotifications(sb: Db, limit = 30): Promise<NotificationRow[]> {
  const { data, error } = await sb
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** 읽음 처리는 RPC 만 사용 (mentions.read_at 도 함께 갱신된다) */
export async function markRead(sb: Db, ids?: string[]) {
  const { error } = await sb.rpc('mark_notifications_read', ids ? { p_ids: ids } : {});
  if (error) throw error;
}

/** 읽음 되돌리기 — 본인 알림만 (RLS notifications_update) */
export async function markUnread(sb: Db, ids: string[]) {
  if (ids.length === 0) return;
  const { error } = await sb.from('notifications').update({ read_at: null }).in('id', ids);
  if (error) throw error;
}

export function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return '방금';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}일 전`;
  return iso.slice(0, 10);
}
