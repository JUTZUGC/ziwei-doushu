/**
 * 下载并导入官方 v4.0 解读数据集（供 CLI、MCP、Web API 共用）
 *
 * 单年压缩包约 2 MB，解压后数百 MB；导入 SQLite 后按年可查。
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';
import { spawnSync } from 'node:child_process';
import { decompress } from '@mongodb-js/zstd';
// @ts-expect-error Node 22 内置 node:sqlite，@types/node 还没有对应声明
import { DatabaseSync } from 'node:sqlite';
import { importDataDir, resetDatasetCache } from './dataset';

const RELEASE = 'v4.0-13d';
const BASE = `https://github.com/Renhuai123/ziwei-doushu/releases/download/${RELEASE}`;

export interface FetchResult {
  year: number;
  imported: number;
  database: string;
  bytes: number;
}

const inflight = new Map<number, Promise<FetchResult>>();

export function isValidYear(year: number): boolean {
  return Number.isInteger(year) && year >= 1950 && year <= 2026;
}

export async function fetchAndImportYear(year: number): Promise<FetchResult> {
  if (!isValidYear(year)) throw new Error('年份需在 1950–2026 之间');
  const running = inflight.get(year);
  if (running) return running;
  const task = run(year).finally(() => inflight.delete(year));
  inflight.set(year, task);
  return task;
}

async function run(year: number): Promise<FetchResult> {
  const dataDir = importDataDir();
  const rawDir = path.join(dataDir, 'raw');
  fs.mkdirSync(rawDir, { recursive: true });

  const dbFile = path.join(dataDir, 'ziwei.sqlite');
  const sumsFile = path.join(rawDir, 'SHA256SUMS.txt');
  const name = `year-${year}.jsonl.zst`;
  const zstFile = path.join(rawDir, name);
  const jsonlFile = path.join(rawDir, `year-${year}.jsonl`);

  await download(`${BASE}/SHA256SUMS.txt`, sumsFile);
  const sums = loadSums(fs.readFileSync(sumsFile, 'utf8'));
  const expected = sums.get(name);
  if (!expected) throw new Error(`SHA256SUMS 里没有 ${name}`);

  await download(`${BASE}/${name}`, zstFile);
  const bytes = fs.statSync(zstFile).size;
  const actual = sha256(zstFile);
  if (actual !== expected) {
    fs.rmSync(zstFile, { force: true });
    throw new Error(`${name} 校验失败，已删除，请重试`);
  }

  // 数据集用 long=27 窗口压缩，fzstd 等纯 JS 实现会解坏；必须用原生 zstd
  const out = await decompress(fs.readFileSync(zstFile));
  fs.writeFileSync(jsonlFile, out);

  const imported = await importYear(dbFile, jsonlFile, year);
  resetDatasetCache();

  fs.rmSync(zstFile, { force: true });
  fs.rmSync(jsonlFile, { force: true });

  return { year, imported, database: dbFile, bytes };
}

async function download(url: string, dest: string): Promise<void> {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return;
  const tmp = `${dest}.part`;
  try {
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const outFile = fs.createWriteStream(tmp);
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      outFile.write(Buffer.from(value));
    }
    await new Promise<void>((resolve, reject) => outFile.end((err?: Error | null) => (err ? reject(err) : resolve())));
  } catch {
    // Node fetch 在部分 Windows 网络环境下会 TLS 失败，退回系统 curl
    fs.rmSync(tmp, { force: true });
    const curl = process.platform === 'win32' ? 'curl.exe' : 'curl';
    const r = spawnSync(curl, ['-fL', '--retry', '3', '--retry-delay', '2', '-o', tmp, url], { stdio: 'ignore' });
    if (r.status !== 0) throw new Error(`下载失败：${url}`);
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

async function importYear(dbFile: string, jsonlFile: string, year: number): Promise<number> {
  const db = new DatabaseSync(dbFile) as unknown as {
    exec: (sql: string) => void;
    prepare: (sql: string) => { run: (...args: unknown[]) => void };
    close: () => void;
  };
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
  let n = 0;
  const rl = readline.createInterface({
    input: fs.createReadStream(jsonlFile, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    const s = line.trim();
    if (!s) continue;
    let row: { k: string; y: number; m: number; d: number; h: number; g: string; ms?: string | null; c: Record<string, string> };
    try {
      row = JSON.parse(s);
    } catch {
      continue;
    }
    insert.run(row.k, row.y, row.m, row.d, row.h, row.g, row.ms ?? null, JSON.stringify(row.c ?? {}));
    n += 1;
  }
  db.exec('COMMIT');
  db.close();
  return n;
}
