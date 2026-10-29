/**
 * MCP 契约回归：初始化、工具清单、排盘调用
 * 不依赖解读数据集；用 bypass 跳过宿主门控
 */

import assert from 'node:assert';
import path from 'node:path';
import { spawn } from 'node:child_process';

const tsxCli = path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
const child = spawn(process.execPath, [tsxCli, 'mcp/server.ts'], {
  env: { ...process.env, ZIWEI_MCP_BYPASS_GATE: '1' },
  stdio: ['pipe', 'pipe', 'pipe'],
});

let buffer = '';
const responses = new Map<number, unknown>();
const done = new Promise<void>((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('MCP 测试超时')), 30000);
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    buffer += chunk;
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line.startsWith('{')) continue;
      try {
        const msg = JSON.parse(line) as { id?: number };
        if (typeof msg.id === 'number') responses.set(msg.id, msg);
      } catch {
        /* ignore */
      }
    }
    if (responses.size >= 3) {
      clearTimeout(timer);
      resolve();
    }
  });
  child.on('error', reject);
  child.stderr.on('data', () => {});
});

child.stdin.write(
  [
    JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
    JSON.stringify({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'ziwei_chart',
        arguments: { year: 1950, month: 1, day: 1, hour: 0, gender: 'male' },
      },
    }),
  ].join('\n') + '\n',
);
child.stdin.end();

async function main() {
  try {
    await done;
    const init = responses.get(1) as { result?: { serverInfo?: { name?: string } } };
    assert.equal(init.result?.serverInfo?.name, 'ziwei-doushu-mcp');

    const list = responses.get(2) as { result?: { tools?: { name: string }[] } };
    const names = (list.result?.tools ?? []).map((t) => t.name);
    assert.equal(names.length, 8, `工具数量应为 8，实际 ${names.length}`);
    for (const n of ['ziwei_chart', 'ziwei_interpret', 'ziwei_patterns', 'ziwei_classics', 'ziwei_heming', 'ziwei_yunxian', 'ziwei_search', 'ziwei_info']) {
      assert.ok(names.includes(n), `缺少工具 ${n}`);
    }

    const chart = responses.get(3) as { result?: { content?: { text?: string }[] } };
    const text = chart.result?.content?.[0]?.text ?? '';
    const data = JSON.parse(text) as { palaces?: unknown[]; birthInfo?: { year?: number } };
    assert.equal(data.birthInfo?.year, 1950);
    assert.equal(data.palaces?.length, 12, '命盘应有 12 宫');

    console.log('✓ MCP 契约回归通过：initialize / tools.list / ziwei_chart');
  } finally {
    child.kill();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
