import { NextRequest } from 'next/server';
import { aiConfigured, AiNotConfiguredError, streamChat, type ChatMessage } from '@/lib/ai/chat';
import { buildInterpretSystem } from '@/lib/ai/prompt';
import type { ZiweiChart } from '@/lib/ziwei/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function bad(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function POST(req: NextRequest) {
  let body: { chart?: ZiweiChart; messages?: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return bad('请求体不是合法 JSON');
  }
  const chart = body.chart;
  const messages = body.messages;
  if (!chart || !chart.birthInfo || !Array.isArray(chart.palaces)) return bad('缺少命盘数据');
  if (!Array.isArray(messages) || !messages.length) return bad('缺少对话消息');

  if (!aiConfigured()) {
    return new Response(
      JSON.stringify({
        error: 'AI_NOT_CONFIGURED',
        message:
          '未配置模型接口。请在 .env.local 设置 AI_API_KEY、AI_BASE_URL、AI_MODEL（或 DEEPSEEK_API_KEY）。不配置也可以使用页面上的「数据集解读」面板。',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  const system = buildInterpretSystem(chart, lastUser);
  try {
    const stream = streamChat(
      system,
      messages.filter((m) => m.role === 'user' || m.role === 'assistant'),
    );
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (e) {
    if (e instanceof AiNotConfiguredError) return bad('AI_NOT_CONFIGURED', 503);
    return bad(e instanceof Error ? e.message : '解读失败', 500);
  }
}
