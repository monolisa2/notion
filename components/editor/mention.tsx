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
import { useTree } from '@/components/tree-context';
import type { Person } from '@/hooks/use-people';

/**
 * 멘션 인라인 콘텐츠 — 사람(userId) 또는 조직(unitId).
 *
 * 저장 형태는 언제나 id 다 (이름 문자열이 아니다). label 은 표시용 캐시라
 * 사람이 개명하거나 조직 이름이 바뀌어도 멘션이 깨지지 않는다.
 * lib/mentions.ts 가 props.userId / props.unitId 를 읽어 알림 대상을 정한다.
 */
export const Mention = createReactInlineContentSpec(
  {
    type: 'mention',
    propSchema: {
      userId: { default: '' },
      /** 조직 멘션일 때만 채워진다 (0020) */
      unitId: { default: '' },
      label: { default: '' },
    },
    content: 'none',
  },
  {
    render: (props) => {
      const { userId, unitId, label } = props.inlineContent.props;
      const isGroup = !!unitId;
      return (
        <span
          className={isGroup ? 'bn-mention bn-mention-group' : 'bn-mention'}
          data-user-id={userId}
          data-unit-id={unitId}
          title={isGroup ? '조직 멘션 — 이 조직(하위 포함) 구성원에게 알림이 갑니다' : undefined}
        >
          @{label}
        </span>
      );
    },
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
  const { units } = useTree();
  const editor = useBlockNoteEditor<
    typeof schema.blockSchema,
    typeof schema.inlineContentSchema,
    typeof schema.styleSchema
  >();

  const getItems = async (query: string): Promise<DefaultReactSuggestionItem[]> => {
    // 조직을 먼저 — 한 번에 알릴 때 제일 많이 쓴다
    const groups: DefaultReactSuggestionItem[] = units
      .filter((u): u is typeof u & { id: string; name: string } =>
        !!u.id && !!u.name && (u.member_count ?? 0) > 0,
      )
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((u) => ({
        title: u.name,
        subtext: `${u.level ?? '조직'} · ${u.member_count ?? 0}명에게 알림`,
        group: '조직',
        icon: <span className="text-base leading-none">👥</span>,
        onItemClick: () => {
          editor.insertInlineContent([
            { type: 'mention', props: { userId: '', unitId: u.id, label: u.name } },
            ' ',
          ]);
        },
      }));

    const persons: DefaultReactSuggestionItem[] = people.map((p) => ({
      // 목록에서 본인을 알아보기 쉽게 (넣는 값은 이름 그대로)
      title: p.id === meId ? `${p.name} (나)` : p.name,
      group: '사람',
      icon: <Avatar name={p.name} src={p.avatar_url} size={18} />,
      onItemClick: () => {
        editor.insertInlineContent([
          { type: 'mention', props: { userId: p.id, unitId: '', label: p.name } },
          ' ',
        ]);
      },
    }));

    return filterSuggestionItems([...groups, ...persons], query);
  };

  return <SuggestionMenuController triggerCharacter="@" getItems={getItems} />;
}
