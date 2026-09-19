'use client';

import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import { useIsDark } from '@/components/theme-toggle';

import { useState } from 'react';
import { ko } from '@blocknote/core/locales';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { docToPlainText } from '@/lib/mentions';
import { usePeople } from '@/hooks/use-people';
import { MentionMenu, schema } from '@/components/editor/mention';

/**
 * 댓글 작성용 소형 BlockNote (멘션 지원). 제출은 ⌘/Ctrl+Enter 또는 버튼.
 */
export default function CommentEditor({
  meId,
  placeholder = '댓글을 남겨보세요. @로 동료를 언급할 수 있습니다.',
  submitLabel = '댓글 달기',
  autoFocus = false,
  onSubmit,
  onCancel,
}: {
  meId: string;
  placeholder?: string;
  submitLabel?: string;
  autoFocus?: boolean;
  onSubmit: (doc: unknown) => Promise<void>;
  onCancel?: () => void;
}) {
  const people = usePeople();
  const isDark = useIsDark();
  const [busy, setBusy] = useState(false);
  const editor = useCreateBlockNote({
    schema,
    dictionary: { ...ko, placeholders: { ...ko.placeholders, emptyDocument: placeholder, default: '' } },
  });

  const submit = async () => {
    const doc = editor.document;
    if (docToPlainText(doc).trim().length === 0) return;
    setBusy(true);
    try {
      await onSubmit(doc);
      editor.replaceBlocks(editor.document, [{ type: 'paragraph' }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="rounded-xl border border-zinc-200 dark:border-zinc-700"
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          void submit();
        }
      }}
    >
      <BlockNoteView
        editor={editor}
        theme={isDark ? 'dark' : 'light'}
        autoFocus={autoFocus}
        sideMenu={false}
        slashMenu={false}
        filePanel={false}
        tableHandles={false}
        emojiPicker={false}
        className="teamhub-comment-editor"
      >
        <MentionMenu people={people} excludeId={meId} />
      </BlockNoteView>
      <div className="flex items-center justify-end gap-2 border-t border-zinc-100 px-2 py-1.5 dark:border-zinc-800">
        <span className="mr-auto text-[11px] text-zinc-400">⌘/Ctrl+Enter</span>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            취소
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {busy ? '저장 중…' : submitLabel}
        </button>
      </div>
    </div>
  );
}
