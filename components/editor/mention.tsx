'use client';

import { BlockNoteSchema } from '@blocknote/core';
import { filterSuggestionItems } from '@blocknote/core/extensions';
import {
  createReactInlineContentSpec,
  SuggestionMenuController,
  useBlockNoteEditor,
  type DefaultReactSuggestionItem,
} from '@blocknote/react';
import { Avatar } from '@/components/avatar';
import type { Person } from '@/hooks/use-people';

/**
 * 사람 멘션 인라인 콘텐츠.
 * 저장 형태는 userId (이름 문자열이 아니다). label 은 표시용 캐시.
 * lib/mentions.ts 의 extractMentions 가 type='mention' + props.userId 를 읽는다.
 */
export const Mention = createReactInlineContentSpec(
  {
    type: 'mention',
    propSchema: {
      userId: { default: '' },
      label: { default: '' },
    },
    content: 'none',
  },
  {
    render: (props) => (
      <span className="bn-mention" data-user-id={props.inlineContent.props.userId}>
        @{props.inlineContent.props.label}
      </span>
    ),
  },
);

export const schema = BlockNoteSchema.create().extend({
  inlineContentSpecs: { mention: Mention },
});

export type TeamHubEditor = typeof schema.BlockNoteEditor;

/** `@` 입력 시 사람 자동완성. BlockNoteView 의 자식으로 넣는다. */
export function MentionMenu({ people, excludeId }: { people: Person[]; excludeId?: string }) {
  const editor = useBlockNoteEditor<
    typeof schema.blockSchema,
    typeof schema.inlineContentSchema,
    typeof schema.styleSchema
  >();

  const getItems = async (query: string): Promise<DefaultReactSuggestionItem[]> => {
    const items = people
      .filter((p) => p.id !== excludeId)
      .map((p) => ({
        title: p.name,
        group: '사람',
        icon: <Avatar name={p.name} src={p.avatar_url} size={18} />,
        onItemClick: () => {
          editor.insertInlineContent([
            { type: 'mention', props: { userId: p.id, label: p.name } },
            ' ',
          ]);
        },
      }));
    return filterSuggestionItems(items, query);
  };

  return <SuggestionMenuController triggerCharacter="@" getItems={getItems} />;
}
