'use client';

import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';

import { useEffect } from 'react';
import type { PartialBlock } from '@blocknote/core';
import { ko } from '@blocknote/core/locales';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { usePeople } from '@/hooks/use-people';
import { MentionMenu, schema } from './mention';

type Doc = PartialBlock<
  typeof schema.blockSchema,
  typeof schema.inlineContentSchema,
  typeof schema.styleSchema
>[];

function toInitialContent(content: unknown): Doc | undefined {
  return Array.isArray(content) && content.length > 0 ? (content as Doc) : undefined;
}

/**
 * 페이지 본문 에디터.
 * 블록 중첩·드래그·슬래시 커맨드·되돌리기는 전부 BlockNote 에 위임 (CLAUDE.md 3-(3)).
 */
export default function BlockNoteEditor({
  initialContent,
  editable = true,
  meId,
  onChange,
}: {
  initialContent: unknown;
  editable?: boolean;
  meId?: string;
  /** 본문이 바뀔 때마다 현재 문서 JSON 을 넘긴다 (호출부에서 디바운스) */
  onChange: (doc: unknown) => void;
}) {
  const people = usePeople();
  const editor = useCreateBlockNote({
    schema,
    dictionary: ko,
    initialContent: toInitialContent(initialContent),
  });

  useEffect(() => {
    return editor.onChange(() => onChange(editor.document));
  }, [editor, onChange]);

  return (
    <BlockNoteView editor={editor} editable={editable} className="teamhub-editor">
      <MentionMenu people={people} excludeId={meId} />
    </BlockNoteView>
  );
}
