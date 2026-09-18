'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/errors';
import { saveComment } from '@/lib/mentions';
import {
  deleteComment,
  fetchComments,
  setCommentResolved,
  type CommentWithAuthor,
} from '@/lib/comments';
import type { Me } from '@/lib/types';
import { Avatar } from '@/components/avatar';
import { RenderDoc } from '@/components/render-doc';

const CommentEditor = dynamic(() => import('./comment-editor'), {
  ssr: false,
  loading: () => <div className="h-20 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />,
});

function formatWhen(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 페이지 하단 댓글 스레드. 1단계 대댓글만 허용 (DB 도 그렇게 설계됨).
 * 저장은 saveComment() 를 통해서만 — 내부에서 sync_comment_mentions RPC 를 호출한다.
 */
export function CommentThread({
  pageId,
  me,
  initial,
}: {
  pageId: string;
  me: Me;
  initial: CommentWithAuthor[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [comments, setComments] = useState<CommentWithAuthor[]>(initial);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  const reload = async () => {
    try {
      setComments(await fetchComments(supabase, pageId));
    } catch {
      /* 다음 이벤트에 재시도 */
    }
  };

  useEffect(() => {
    const channel = supabase
      .channel(`comments-${pageId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments', filter: `page_id=eq.${pageId}` },
        () => void fetchComments(supabase, pageId).then(setComments).catch(() => {}),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, pageId]);

  const submit = async (doc: unknown, parentId?: string) => {
    try {
      await saveComment(supabase, { pageId, authorId: me.id, body: doc, parentId });
      setReplyTo(null);
      await reload();
    } catch (e) {
      toast.error(`댓글 저장 실패: ${errorMessage(e)}`);
      throw e;
    }
  };

  const toggleResolved = async (c: CommentWithAuthor) => {
    try {
      await setCommentResolved(supabase, c.id, !c.resolved_at, me.id);
      await reload();
    } catch (e) {
      toast.error(`변경 실패: ${errorMessage(e)}`);
    }
  };

  const remove = async (c: CommentWithAuthor) => {
    if (!window.confirm('댓글을 삭제할까요? 답글도 함께 삭제됩니다.')) return;
    try {
      await deleteComment(supabase, c.id);
      await reload();
    } catch (e) {
      toast.error(`삭제 실패: ${errorMessage(e)}`);
    }
  };

  const roots = comments.filter((c) => !c.parent_id);
  const repliesOf = (id: string) => comments.filter((c) => c.parent_id === id);
  const visibleRoots = roots.filter((c) => showResolved || !c.resolved_at);
  const resolvedCount = roots.filter((c) => c.resolved_at).length;

  return (
    <section className="mx-auto w-full max-w-3xl px-6 pb-24 sm:px-10">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-medium text-zinc-500">댓글 {roots.length > 0 && `· ${roots.length}`}</h2>
        {resolvedCount > 0 && (
          <button
            type="button"
            onClick={() => setShowResolved((v) => !v)}
            className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            해결된 댓글 {resolvedCount}개 {showResolved ? '숨기기' : '보기'}
          </button>
        )}
      </div>

      <ul className="mt-3 space-y-3">
        {visibleRoots.map((c) => (
          <li
            key={c.id}
            className={`rounded-xl border px-4 py-3 ${
              c.resolved_at
                ? 'border-zinc-100 opacity-60 dark:border-zinc-800'
                : 'border-zinc-200 dark:border-zinc-800'
            }`}
          >
            <CommentItem
              c={c}
              me={me}
              onResolve={() => void toggleResolved(c)}
              onDelete={() => void remove(c)}
              onReply={() => setReplyTo(replyTo === c.id ? null : c.id)}
            />
            {repliesOf(c.id).length > 0 && (
              <ul className="mt-3 space-y-3 border-l-2 border-zinc-100 pl-4 dark:border-zinc-800">
                {repliesOf(c.id).map((r) => (
                  <li key={r.id}>
                    <CommentItem c={r} me={me} onDelete={() => void remove(r)} />
                  </li>
                ))}
              </ul>
            )}
            {replyTo === c.id && (
              <div className="mt-3 pl-4">
                <CommentEditor
                  meId={me.id}
                  autoFocus
                  placeholder="답글을 입력하세요"
                  submitLabel="답글"
                  onSubmit={(doc) => submit(doc, c.id)}
                  onCancel={() => setReplyTo(null)}
                />
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-4">
        <CommentEditor meId={me.id} onSubmit={(doc) => submit(doc)} />
      </div>
    </section>
  );
}

function CommentItem({
  c,
  me,
  onResolve,
  onDelete,
  onReply,
}: {
  c: CommentWithAuthor;
  me: Me;
  onResolve?: () => void;
  onDelete: () => void;
  onReply?: () => void;
}) {
  const mine = c.author_id === me.id || me.isAdmin;
  return (
    <div>
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Avatar name={c.author?.name ?? '?'} src={c.author?.avatar_url} size={20} />
        <span className="font-medium text-zinc-700 dark:text-zinc-200">{c.author?.name ?? '알 수 없음'}</span>
        <time dateTime={c.created_at}>{formatWhen(c.created_at)}</time>
        {c.resolved_at && <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">해결됨</span>}
        <span className="ml-auto flex items-center gap-1">
          {onReply && (
            <button type="button" onClick={onReply} className="rounded px-1.5 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">
              답글
            </button>
          )}
          {onResolve && (
            <button type="button" onClick={onResolve} className="rounded px-1.5 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">
              {c.resolved_at ? '다시 열기' : '해결'}
            </button>
          )}
          {mine && (
            <button type="button" onClick={onDelete} className="rounded px-1.5 py-0.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950">
              삭제
            </button>
          )}
        </span>
      </div>
      <RenderDoc doc={c.body} className="mt-2" />
    </div>
  );
}
