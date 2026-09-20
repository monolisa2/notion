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

/**
 * `@` 입력 시 사람 자동완성. BlockNoteView 의 자식으로 넣는다.
 *
 * 본인도 고를 수 있다 — "문의 @홍길동", "작성 @홍길동" 처럼
 * 글에 자기 이름을 적는 쓰임이 흔하다.
 * 자기 멘션이 알림으로 가지 않는 것은 DB(enqueue_notification)가 이미 처리한다.
 */
export function MentionMenu({ people, meId }: { people: Person[]; meId?: string }) {
  const editor = useBlockNoteEditor<
    typeof schema.blockSchema,
    typeof schema.inlineContentSchema,
    typeof schema.styleSchema
  >();

  const getItems = async (query: string): Promise<DefaultReactSuggestionItem[]> => {
    const items = people.map((p) => ({
        // 목록에서 본인을 알아보기 쉽게 (넣는 값은 이름 그대로)
        title: p.id === meId ? `${p.name} (나)` : p.name,
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
