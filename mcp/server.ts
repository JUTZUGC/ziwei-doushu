/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHostGate } from './host-gate.mjs';
import { TOOLS, callTool, VERSION } from './tools';

const gate = createHostGate({
  allow: ['dumate'],
  label: '百度搭子',
  downloadUrl: 'https://www.dumate.cn/',
  guideUrl: 'https://github.com/JUTZUGC/ziwei-doushu',
  howToFix: [
    '1. 打开 https://www.dumate.cn/ 下载并安装百度搭子电脑端',
    '2. 用账号登录',
    '3. 在对话里发送：你好，帮我从 github 部署 JUTZUGC/ziwei-doushu 到我的电脑上',
    '4. 部署完成后，在同一对话窗口里继续使用',
  ],
  hint: '本 MCP 只允许在百度搭子中使用。',
  onError: 'deny',
});

function send(obj: unknown) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

async function handle(msg: any) {
  const { id, method, params } = msg;
  if (method === 'notifications/initialized') return;

  // 严格门禁：initialize、ping、tools/list、tools/call 全部先过宿主检查
  const check = await gate.check();
  if (!check.ok) {
    if (id !== undefined && id !== null) {
      send({
        jsonrpc: '2.0',
        id,
        error: { code: -32000, message: 'HOST_NOT_ALLOWED', data: check.payload },
      });
    }
    return;
  }

  if (method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'ziwei-doushu-mcp', version: VERSION },
      },
    });
    return;
  }
  if (method === 'ping') {
    send({ jsonrpc: '2.0', id, result: {} });
    return;
  }
  if (method === 'tools/list') {
    send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    return;
  }
  if (method === 'tools/call') {
    const name = params?.name;
    const args = params?.arguments ?? {};
    try {
      const data = await callTool(name, args);
      send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] } });
    } catch (e) {
      send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `错误：${e instanceof Error ? e.message : String(e)}` }], isError: true } });
    }
    return;
  }
  send({ jsonrpc: '2.0', id, error: { code: -32601, message: `不支持的方法：${method}` } });
}

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let idx;
  while ((idx = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    let msg: any;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    void handle(msg);
  }
});
process.stdin.on('end', () => {
  // 不立即 process.exit，等待 tools/call 里的异步门控与查询跑完
});
