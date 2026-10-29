/**
 * 下载并导入官方 v4.0 解读数据集
 *
 * 用法：
 *   npm run data:fetch -- --years 1990,1991
 *   npm run data:fetch -- --all
 *   npm run data:fetch -- --years 1990 --keep-zst
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { decompress } from '@mongodb-js/zstd';

const require = createRequire(import.meta.url);
const RELEASE = 'v4.0-13d';
const BASE = `https://github.com/Renhuai123/ziwei-doushu/releases/download/${RELEASE}`;
const ROOT = process.cwd();
const DATA = process.env.ZIWEI_DATA_DIR || path.join(ROOT, 'data');
const RAW = path.join(DATA, 'raw');
const DB = path.join(DATA, 'ziwei.sqlite');

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(name);

function fail(msg: string): never {
  console.error(`[data:fetch] ${msg}`);
  process.exit(1);
}

async function download(url: string, dest: string): Promise<void> {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    console.log(`  已存在，跳过下载：${path.relative(ROOT, dest)}`);
    return;
  }
  console.log(`  下载 ${url}`);
  const tmp = `${dest}.part`;
  try {
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const out = fs.createWriteStream(tmp);
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      out.write(Buffer.from(value));
    }
    await new Promise<void>((resolve, reject) => out.end((err?: Error | null) => (err ? reject(err) : resolve())));
  } catch {
    // Node fetch 在部分 Windows 网络环境下会 TLS 失败，退回系统 curl
    fs.rmSync(tmp, { force: true });
    const curl = process.platform === 'win32' ? 'curl.exe' : 'curl';
    const r = spawnSync(curl, ['-fL', '--retry', '3', '--retry-delay', '2', '-o', tmp, url], { stdio: 'inherit' });
    if (r.status !== 0) fail(`下载失败：${url}`);
  }
  fs.renameSync(tmp, dest);
}

function sha256(file: string): string {
  const h = crypto.createHash('sha256');
  const fd = fs.openSync(file, 'r');
  const buf = Buffer.allocUnsafe(1024 * 1024);
  try {
    for (;;) {
      const n = fs.readSync(fd, buf, 0, buf.length, null);
      if (!n) break;
      h.update(buf.subarray(0, n));
    }
  } finally {
    fs.closeSync(fd);
  }
  return h.digest('hex');
}

function loadSums(text: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([a-f0-9]{64})\s+(.+)$/i);
    if (m) map.set(m[2].trim(), m[1].toLowerCase());
  }
  return map;
}

async function decompressToFile(zstPath: string, outPath: string): Promise<void> {
  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) {
    console.log(`  已解压，跳过：${path.relative(ROOT, outPath)}`);
    return;
  }
  // 数据集用 long=27 窗口压缩，fzstd 等纯 JS 实现会解坏；必须用原生 zstd
  const out = await decompress(fs.readFileSync(zstPath));
  fs.writeFileSync(outPath, out);
}

async function importYear(year: number): Promise<number> {
  const { DatabaseSync } = require('node:sqlite') as {
    DatabaseSync: new (p: string) => {
      exec: (sql: string) => void;
      prepare: (sql: string) => { run: (...args: unknown[]) => void };
      close: () => void;
    };
  };
  const db = new DatabaseSync(DB);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS charts (
      k TEXT PRIMARY KEY,
      y INTEGER NOT NULL,
      m INTEGER NOT NULL,
      d INTEGER NOT NULL,
      h INTEGER NOT NULL,
      g TEXT NOT NULL,
      ms TEXT,
      c TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_charts_year ON charts(y);
  `);
  db.exec('BEGIN');
  db.prepare('DELETE FROM charts WHERE y = ?').run(year);
  const insert = db.prepare('INSERT OR REPLACE INTO charts (k,y,m,d,h,g,ms,c) VALUES (?,?,?,?,?,?,?,?)');
  const file = path.join(RAW, `year-${year}.jsonl`);
  let n = 0;
  const rl = readline.createInterface({
    input: fs.createReadStream(file, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    const s = line.trim();
    if (!s) continue;
    let row: { k: string; y: number; m: number; d: number; h: number; g: string; ms?: string | null; c: Record<string, string> };
    try {
      row = JSON.parse(s);
    } catch {
      console.warn(`  跳过无法解析的行：year=${year} line=${n + 1}`);
      continue;
    }
    insert.run(row.k, row.y, row.m, row.d, row.h, row.g, row.ms ?? null, JSON.stringify(row.c ?? {}));
    n += 1;
  }
  db.exec('COMMIT');
  db.close();
  return n;
}

async function main() {
  fs.mkdirSync(RAW, { recursive: true });
  const all = has('--all');
  const yearsArg = arg('--years') ?? process.argv.slice(2).find((s) => /^\d{4}(,\d{4})*$/.test(s));
  let years: number[] = [];
  if (all) {
    years = Array.from({ length: 77 }, (_, i) => 1950 + i);
  } else if (yearsArg) {
    years = yearsArg.split(',').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n >= 1950 && n <= 2026);
  }
  if (!years.length) fail('请用 --years 1990,1991 指定年份，或 --all 下载全部年份');

  console.log(`[data:fetch] 目标年份：${years.join(', ')}`);
  const sumsPath = path.join(RAW, 'SHA256SUMS.txt');
  await download(`${BASE}/SHA256SUMS.txt`, sumsPath);
  const sums = loadSums(fs.readFileSync(sumsPath, 'utf8'));

  for (const year of years) {
    const name = `year-${year}.jsonl.zst`;
    const zst = path.join(RAW, name);
    const jsonl = path.join(RAW, `year-${year}.jsonl`);
    console.log(`\n[${year}]`);
    await download(`${BASE}/${name}`, zst);
    const expected = sums.get(name);
    if (!expected) fail(`SHA256SUMS 里没有 ${name}`);
    const actual = sha256(zst);
    if (actual !== expected) fail(`${name} 校验失败：expected ${expected}, got ${actual}`);
    console.log('  SHA256 校验通过');
    await decompressToFile(zst, jsonl);
    console.log('  解压完成，开始导入 SQLite…');
    const n = await importYear(year);
    console.log(`  导入 ${n} 张命盘`);
    if (!has('--keep-zst')) fs.rmSync(zst, { force: true });
    fs.rmSync(jsonl, { force: true });
    console.log('  清理中间文件完成');
  }
  console.log(`\n完成。数据库：${path.relative(ROOT, DB)}`);
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
