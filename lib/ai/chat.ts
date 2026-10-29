/**
 * OpenAI 兼容流式对话
 *
 * 环境变量：
 *   AI_API_KEY / DEEPSEEK_API_KEY
 *   AI_BASE_URL / DEEPSEEK_BASE_URL（默认 https://api.deepseek.com/v1）
 *   AI_MODEL / DEEPSEEK_MODEL（默认 deepseek-chat）
 */

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super('AI 未配置');
    this.name = 'AiNotConfiguredError';
  }
}

export function aiConfig() {
  const apiKey = process.env.AI_API_KEY || process.env.DEEPSEEK_API_KEY || '';
  const baseUrl = (process.env.AI_BASE_URL || process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
  const model = process.env.AI_MODEL || process.env.DEEPSEEK_MODEL || 'deepseek-chat';
  return { apiKey, baseUrl, model, configured: Boolean(apiKey) };
}

export function aiConfigured(): boolean {
  return aiConfig().configured;
}

/** 把上游 OpenAI 兼容 SSE 转成前端约定的 data: {"delta":{"text":...}} 流 */
export function streamChat(system: string, messages: ChatMessage[]): ReadableStream<Uint8Array> {
  const { apiKey, baseUrl, model } = aiConfig();
  if (!apiKey) throw new AiNotConfiguredError();
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (s: string) => controller.enqueue(encoder.encode(s));
      try {
        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            stream: true,
            temperature: 0.6,
            messages: [{ role: 'system', content: system }, ...messages],
          }),
        });
        if (!res.ok || !res.body) {
          const text = await res.text().catch(() => '');
          push(`data: ${JSON.stringify({ delta: { text: `模型请求失败（${res.status}）：${text.slice(0, 300)}` } })}\n\n`);
          push('data: [DONE]\n\n');
          controller.close();
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() || '';
          for (const line of lines) {
            const s = line.trim();
            if (!s.startsWith('data:')) continue;
            const data = s.slice(5).trim();
            if (!data || data === '[DONE]') continue;
            try {
              const json = JSON.parse(data);
              const text = json.choices?.[0]?.delta?.content ?? '';
              if (text) push(`data: ${JSON.stringify({ delta: { text } })}\n\n`);
            } catch {
              /* 忽略无法解析的心跳 */
            }
          }
        }
        push('data: [DONE]\n\n');
        controller.close();
      } catch (e) {
        push(`data: ${JSON.stringify({ delta: { text: `\n\n请求中断：${e instanceof Error ? e.message : String(e)}` } })}\n\n`);
        push('data: [DONE]\n\n');
        controller.close();
      }
    },
  });
}
