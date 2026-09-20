'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/errors';
import { createPage } from '@/lib/pages';

export type DigestLite = {
  author_name: string;
  page_title: string;
  page_status: string | null;
  progress: number | null;
  updates: string;
  blockers: string | null;
};

type Inline = { type: 'text'; text: string; styles: Record<string, boolean> };
type Block = { type: string; props?: Record<string, unknown>; content?: Inline[]; children?: Block[] };

const t = (text: string, bold = false): Inline => ({ type: 'text', text, styles: bold ? { bold: true } : {} });
const h3 = (text: string): Block => ({ type: 'heading', props: { level: 3 }, content: [t(text)] });
const p = (...content: Inline[]): Block => ({ type: 'paragraph', content });
const bullet = (content: Inline[], children?: Block[]): Block => ({
  type: 'bulletListItem',
  content,
  ...(children && children.length > 0 ? { children } : {}),
});

function today() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 로그 본문을 한 줄로 (양식대로 여러 줄 쓴 경우가 많다) */
function oneLine(s: string) {
  const flat = s.replace(/\s*\n+\s*/g, ' / ').replace(/\s+/g, ' ').trim();
  return flat.length > 160 ? `${flat.slice(0, 160)}…` : flat;
}

/**
 * 이 화면에 모인 로그로 "주간 정리" 페이지 초안을 만든다.
 *
 * weekly_digest() 결과를 그대로 옮기는 것뿐이고, 요약·문장 생성은 하지 않는다
 * (유료 API 금지 — 그리고 사람이 다듬는 편이 정확하다).
 */
export function WeeklyDraftButton({
  rows,
  days,
  meId,
  meUnitId,
  rootUnitId,
}: {
  rows: DigestLite[];
  days: number;
  meId: string;
  meUnitId: string | null;
  /** 소속이 아직 없는 사람을 위한 대체 공간 (본부 공용) */
  rootUnitId: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // 공간이 없으면 pages_space_shape 제약에 걸린다 (개인 메모가 아니면 unit_id 필수)
  const unitId = meUnitId ?? rootUnitId;

  const create = async () => {
    if (!unitId) {
      toast.error('소속이 아직 지정되지 않아 페이지를 만들 수 없습니다. 관리자에게 소속 지정을 요청하세요.');
      return;
    }
    setBusy(true);
    try {
      const byAuthor = new Map<string, DigestLite[]>();
      for (const r of rows) byAuthor.set(r.author_name, [...(byAuthor.get(r.author_name) ?? []), r]);

      const done: Block[] = [...byAuthor.entries()].map(([author, items]) =>
        bullet(
          [t(author, true), t(`  ${items.length}건`)],
          items.map((it) =>
            bullet([
              t(it.page_title, true),
              t(
                `${it.page_status ? ` (${it.page_status}${it.progress !== null ? ` ${it.progress}%` : ''})` : ''} — ${oneLine(it.updates)}`,
              ),
            ]),
          ),
        ),
      );

      const blocked = rows.filter((r) => r.blockers?.trim());
      const issues: Block[] = blocked.length
        ? blocked.map((r) => bullet([t(`${r.page_title}: `, true), t(oneLine(r.blockers ?? ''))]))
        : [bullet([t('')])];

      const content: Block[] = [
        {
          type: 'quote',
          content: [
            t(
              `${daysAgo(days)} ~ ${today()} 진행 로그에서 자동으로 모은 초안입니다. 확인하고 다듬어 주세요.`,
            ),
          ],
        },
        h3('이번 주 한 일'),
        ...(done.length > 0 ? done : [bullet([t('')])]),
        h3('다음 주 계획'),
        bullet([t('')]),
        h3('이슈 / 도움 필요'),
        ...issues,
        p(),
      ];

      const id = await createPage(supabase, {
        parentId: null,
        createdBy: meId,
        type: 'doc',
        title: `주간 정리 ${today()}`,
        icon: '🗓',
        template: 'weekly',
        unitId,
        visibility: meUnitId ? '소속' : '본부',
        content,
      });
      toast.success('주간 정리 초안을 만들었습니다');
      router.push(`/p/${id}`);
    } catch (e) {
      const msg = errorMessage(e);
      toast.error(
        msg.includes('row-level security')
          ? '내 소속 공간에 페이지를 만들 권한이 없습니다. 관리자에게 작성 권한을 요청하세요.'
          : `초안 만들기 실패: ${msg}`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      disabled={busy || rows.length === 0}
      onClick={() => void create()}
      className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
      title={rows.length === 0 ? '모을 로그가 없습니다' : '이 화면의 로그로 주간 정리 페이지 초안을 만듭니다'}
    >
      📝 주간 정리 초안 만들기
    </button>
  );
}
