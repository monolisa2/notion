'use client';

import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';

import { useEffect } from 'react';
import type { PartialBlock } from '@blocknote/core';
import { ko } from '@blocknote/core/locales';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { toast } from 'sonner';
import { usePeople } from '@/hooks/use-people';
import { createClient } from '@/lib/supabase/client';
import { useIsDark } from '@/components/theme-toggle';
import { errorMessage } from '@/lib/errors';
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
const MAX_UPLOAD = 50 * 1024 * 1024; // Supabase 무료 플랜 파일당 상한
const BUCKET = 'attachments';
const SB_PREFIX = 'sb://attachments/';

export default function BlockNoteEditor({
  initialContent,
  editable = true,
  meId,
  pageId,
  onChange,
}: {
  initialContent: unknown;
  editable?: boolean;
  meId?: string;
  /** 첨부 파일 경로(<pageId>/…) 용 */
  pageId?: string;
  /** 본문이 바뀔 때마다 현재 문서 JSON 을 넘긴다 (호출부에서 디바운스) */
  onChange: (doc: unknown) => void;
}) {
  const people = usePeople();
  const isDark = useIsDark();
  const editor = useCreateBlockNote({
    schema,
    dictionary: ko,
    initialContent: toInitialContent(initialContent),
    // 이미지/파일 블록 업로드 → Supabase Storage (비공개 버킷, 경로만 저장)
    uploadFile: async (file: File) => {
      if (file.size > MAX_UPLOAD) {
        toast.error('파일은 50MB 까지 올릴 수 있습니다. 더 큰 파일은 사내 드라이브 링크를 붙여주세요.');
        throw new Error('file too large');
      }
      const supabase = createClient();
      const safe = file.name.replace(/[^\w.\-가-힣 ]+/g, '_').slice(0, 80);
      const path = `${pageId ?? 'misc'}/${crypto.randomUUID()}-${safe}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (error) {
        toast.error(`업로드 실패: ${errorMessage(error)}`);
        throw error;
      }
      return SB_PREFIX + path;
    },
    // 저장된 경로를 볼 때마다 1시간짜리 서명 URL 로 바꾼다
    resolveFileUrl: async (url: string) => {
      if (!url.startsWith(SB_PREFIX)) return url;
      const supabase = createClient();
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(url.slice(SB_PREFIX.length), 3600);
      if (error || !data) return url;
      return data.signedUrl;
    },
  });

  useEffect(() => {
    return editor.onChange(() => onChange(editor.document));
  }, [editor, onChange]);

  return (
    <BlockNoteView editor={editor} editable={editable} theme={isDark ? 'dark' : 'light'} className="teamhub-editor">
      <MentionMenu people={people} excludeId={meId} />
    </BlockNoteView>
  );
}
