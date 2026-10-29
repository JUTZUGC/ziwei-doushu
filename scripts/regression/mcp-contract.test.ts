/**
 * MCP 契约回归
 * 1. 工具契约（清单 + 排盘）：直接调用 mcp/tools.ts，不需要宿主门控
 * 2. 宿主门禁：spawn 真实 server，非百度搭子环境必须拒绝 initialize
 */

import assert from 'node:assert';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { TOOLS, callTool } from '../../mcp/tools';

const EXPECTED = [
  'ziwei_chart',
  'ziwei_interpret',
  'ziwei_patterns',
  'ziwei_classics',
  'ziwei_heming',
  'ziwei_yunxian',
  'ziwei_search',
  'ziwei_info',
  'ziwei_help',
];

function assertTools() {
  const names = TOOLS.map((t) => t.name);
  assert.equal(names.length, EXPECTED.length, `工具数量应为 ${EXPECTED.length}，实际 ${names.length}`);
  for (const n of EXPECTED) {
    assert.ok(names.includes(n), `缺少工具 ${n}`);
  }
}

async function assertChart() {
  const data = (await callTool('ziwei_chart', { year: 1950, month: 1, day: 1, hour: 0, gender: 'male' })) as {
    palaces?: unknown[];
    birthInfo?: { year?: number };
  };
  assert.equal(data.birthInfo?.year, 1950);
  assert.equal(data.palaces?.length, 12, '命盘应有 12 宫');
}

async function assertGateDenies() {
  const tsxCli = path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const child = spawn(process.execPath, [tsxCli, 'mcp/server.ts'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let buffer = '';
  type Response = { id?: number; error?: { message?: string; data?: { code?: string } } };
  const METHODS = ['initialize', 'ping', 'tools/list', 'tools/call'];
  const got = new Map<number, Response>();
  const all = new Promise<Map<number, Response>>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('MCP 门禁测试超时')), 30000);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      buffer += chunk;
      let idx;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line.startsWith('{')) continue;
        try {
          const msg = JSON.parse(line) as Response;
          if (typeof msg.id === 'number') got.set(msg.id, msg);
          if (got.size === METHODS.length) {
            clearTimeout(timer);
            resolve(got);
            return;
          }
        } catch {
          /* ignore */
        }
      }
    });
    child.on('error', reject);
    child.stderr.on('data', () => {});
  });

  const requests = METHODS.map((method, i) => ({
    jsonrpc: '2.0',
    id: i + 1,
    method,
    params: method === 'tools/call' ? { name: 'ziwei_chart', arguments: { year: 1950, month: 1, day: 1, hour: 0, gender: 'male' } } : {},
  }));
  child.stdin.write(requests.map((r) => JSON.stringify(r)).join('\n') + '\n');
  child.stdin.end();

  try {
    const responses = await all;
    for (let i = 0; i < METHODS.length; i++) {
      const msg = responses.get(i + 1);
      assert.equal(msg?.error?.message, 'HOST_NOT_ALLOWED', `非百度搭子环境必须拒绝 ${METHODS[i]}`);
      assert.equal(msg?.error?.data?.code, 'HOST_NOT_ALLOWED');
    }
  } finally {
    child.kill();
  }
}

async function main() {
  assertTools();
  await assertChart();
  await assertGateDenies();
  console.log('✓ MCP 契约回归通过：tools / ziwei_chart / 宿主门禁');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
