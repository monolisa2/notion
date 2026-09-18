/**
 * POST /api/weekly-report  { days?: number }
 * weekly_digest / silent_members RPC 결과를 Claude 에 넣어 주간보고 초안(마크다운)을 스트리밍한다.
 * 저장은 클라이언트가 한다 (마크다운 → BlockNote 블록 변환은 브라우저의 에디터가 수행).
 */
import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildWeeklyReportPrompt, WEEKLY_REPORT_SYSTEM } from '@/lib/prompts/weekly-report';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY 가 설정되지 않았습니다 (.env.local 확인)' },
      { status: 500 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { days?: number };
  const days = Math.min(Math.max(Number(body.days) || 7, 1), 31);

  const [digest, silent] = await Promise.all([
    supabase.rpc('weekly_digest', { p_days: days }),
    supabase.rpc('silent_members', { p_days: days }),
  ]);
  if (digest.error) return NextResponse.json({ error: digest.error.message }, { status: 500 });
  if (silent.error) return NextResponse.json({ error: silent.error.message }, { status: 500 });

  const to = new Date();
  const from = new Date(to.getTime() - days * 86400_000);
  const prompt = buildWeeklyReportPrompt({
    digest: digest.data ?? [],
    silent: silent.data ?? [],
    days,
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  });

  const client = new Anthropic();
  // 스트리밍: 보고서가 길어질 수 있어 타임아웃을 피한다.
  // fallbacks: "default" — 안전 분류기가 요청을 거절하면 서버가 대체 모델로 같은 요청을 이어간다.
  const stream = client.beta.messages.stream({
    model: 'claude-opus-5',
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium' },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: [{ type: 'text', text: WEEKLY_REPORT_SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: prompt }],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === 'refusal') {
          controller.enqueue(encoder.encode('\n\n> ⚠️ 모델이 요청을 거절했습니다. 재료를 확인한 뒤 다시 시도해 주세요.'));
        } else if (final.stop_reason === 'max_tokens') {
          controller.enqueue(encoder.encode('\n\n> ⚠️ 출력 길이 제한에 걸려 초안이 잘렸습니다.'));
        }
      } catch (e) {
        const msg =
          e instanceof Anthropic.AuthenticationError
            ? 'Anthropic API 키가 올바르지 않습니다'
            : e instanceof Anthropic.RateLimitError
              ? '요청이 많아 잠시 후 다시 시도해 주세요'
              : e instanceof Anthropic.APIError
                ? `Anthropic API 오류 ${e.status}: ${e.message}`
                : e instanceof Error
                  ? e.message
                  : String(e);
        controller.enqueue(encoder.encode(`\n\n> ❌ 생성 실패: ${msg}`));
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Report-Days': String(days),
      'X-Report-Silent': String((silent.data ?? []).length),
    },
  });
}
