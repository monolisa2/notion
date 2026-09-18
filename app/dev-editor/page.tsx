import { PageEditor } from '@/components/editor/page-editor';
import type { PageRow } from '@/lib/types';
const fake: PageRow = {
  id: '00000000-0000-0000-0000-000000000001', parent_id: null, path: null, depth: 0, type: 'doc', icon: null, title: '멘션 테스트',
  content: [{ type: 'paragraph', content: [ { type: 'text', text: '급여일 1안으로 갑니다 ', styles: {} }, { type: 'mention', props: { userId: '2222', label: '옥미영' } }, { type: 'text', text: ' 확인 부탁', styles: {} } ] }],
  sort_order: 1000, status: null, assignee_id: null, priority: null, progress: null, start_date: null, due_date: null, completed_at: null,
  created_by: 'x', created_at: '2026-09-18T00:00:00Z', updated_at: '2026-09-18T00:00:00Z', archived_at: null,
};
export default function Dev() { return <PageEditor page={fake} userId="x" />; }
