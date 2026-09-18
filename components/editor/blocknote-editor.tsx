'use client';

import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';

import { useEffect } from 'react';
import { BlockNoteSchema, type PartialBlock } from '@blocknote/core';
import { ko } from '@blocknote/core/locales';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';

/**
 * 에디터 스키마. Phase 3 에서 멘션 인라인 콘텐츠를 여기 extend 한다.
 * 블록 중첩·드래그·슬래시 커맨드·되돌리기는 전부 BlockNote 에 위임 (CLAUDE.md 3-(3)).
 */
export const schema = BlockNoteSchema.create();

export type EditorDocument = PartialBlock[];

function toInitialContent(content: unknown): PartialBlock[] | undefined {
  return Array.isArray(content) && content.length > 0 ? (content as PartialBlock[]) : undefined;
}

export default function BlockNoteEditor({
  initialContent,
  editable = true,
  onChange,
}: {
  initialContent: unknown;
  editable?: boolean;
  /** 본문이 바뀔 때마다 현재 문서 JSON 을 넘긴다 (호출부에서 디바운스) */
  onChange: (doc: unknown) => void;
}) {
  const editor = useCreateBlockNote({
    schema,
    dictionary: ko,
    initialContent: toInitialContent(initialContent),
  });

  useEffect(() => {
    return editor.onChange(() => onChange(editor.document));
  }, [editor, onChange]);

  return (
    <BlockNoteView
      editor={editor}
      editable={editable}
      className="teamhub-editor"
    />
  );
}
