import { NextRequest } from 'next/server';
import { aiConfigured, AiNotConfiguredError, streamChat } from '@/lib/ai/chat';
import { buildHemingSystem } from '@/lib/ai/prompt';
import type { ZiweiChart } from '@/lib/ziwei/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function bad(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function POST(req: NextRequest) {
  let body: { chartA?: ZiweiChart; chartB?: ZiweiChart; question?: string };
  try {
    body = await req.json();
  } catch {
    return bad('请求体不是合法 JSON');
  }
  const { chartA, chartB, question } = body;
  if (!chartA?.birthInfo || !Array.isArray(chartA.palaces)) return bad('缺少甲方命盘');
  if (!chartB?.birthInfo || !Array.isArray(chartB.palaces)) return bad('缺少乙方命盘');

  if (!aiConfigured()) {
    return new Response(
      JSON.stringify({
        error: 'AI_NOT_CONFIGURED',
        message: '未配置模型接口。请在 .env.local 设置 AI_API_KEY、AI_BASE_URL、AI_MODEL。',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const system = buildHemingSystem(chartA, chartB, question);
  const user = question?.trim() || '请分析两人的感情匹配度、相处模式、潜在冲突与建议。';
  try {
    const stream = streamChat(system, [{ role: 'user', content: user }]);
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (e) {
    if (e instanceof AiNotConfiguredError) return bad('AI_NOT_CONFIGURED', 503);
    return bad(e instanceof Error ? e.message : '合盘分析失败', 500);
  }
}
