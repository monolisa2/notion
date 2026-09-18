'use client';

import { useEffect } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { schema } from '@/components/editor/mention';

/**
 * 화면에 보이지 않는 BlockNote 인스턴스로 마크다운을 블록 JSON 으로 바꾼다.
 * (BlockNote 의 파서는 DOM 이 필요해 서버에서 못 돈다)
 */
export default function MarkdownToBlocks({ onReady }: { onReady: (fn: (md: string) => unknown) => void }) {
  const editor = useCreateBlockNote({ schema });
  useEffect(() => {
    onReady((md: string) => editor.tryParseMarkdownToBlocks(md));
  }, [editor, onReady]);
  return null;
}
