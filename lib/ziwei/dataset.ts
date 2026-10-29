/**
 * 官方 v4.0 解读数据集查询层
 *
 * 数据来自 Renhuai123/ziwei-doushu Release v4.0-13d（CC BY 4.0）。
 * 仓库本身不提交 56.6 GB 数据，只保留下载与导入脚本。
 *
 * 查询键：`YYYY-MM-DD-时辰序号-性别`，例如 `1990-01-01-0-male`。
 * 时辰序号 0–11 对应子、丑……亥，不是钟点。
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
// @ts-expect-error Node 22 内置 node:sqlite，@types/node 还没有对应声明
import { DatabaseSync } from 'node:sqlite';
import type { BirthInfo } from './types';

export const DATASET_RELEASE = 'v4.0-13d';
export const DATASET_SOURCE = 'https://github.com/Renhuai123/ziwei-doushu/releases/tag/v4.0-13d';
export const DATASET_LICENSE = 'CC BY 4.0';

export const DIMENSIONS = [
  'overview',
  'personality',
  'love',
  'career',
  'wealth',
  'health',
  'family',
  'children',
  'move',
  'friends',
  'home',
  'spirit',
  'parents',
] as const;

export type DimensionKey = (typeof DIMENSIONS)[number];

export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  overview: '命格总览',
  personality: '性格特质',
  love: '感情婚姻',
  career: '事业职业',
  wealth: '财富运势',
  health: '健康状况',
  family: '兄弟合伙',
  children: '子女缘分',
  move: '迁移外出',
  friends: '人际贵人',
  home: '田宅不动产',
  spirit: '精神福德',
  parents: '父母长辈',
};

interface DatasetRow {
  k: string;
  y: number;
  m: number;
  d: number;
  h: number;
  g: string;
  ms: string | null;
  c: string;
}

interface DatabaseLike {
  prepare: (sql: string) => { get: (...args: unknown[]) => unknown; all: (...args: unknown[]) => unknown[] };
  close: () => void;
}

let cachedDb: DatabaseLike | null = null;
let cachedPath = '';

/** 仓库内的 data 目录（与启动时的 cwd 无关） */
function repoDataDir(): string | null {
  try {
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data');
  } catch {
    return null;
  }
}

export function dataDir(): string {
  if (process.env.ZIWEI_DATA_DIR) return process.env.ZIWEI_DATA_DIR;
  const cwdDir = path.join(process.cwd(), 'data');
  if (fs.existsSync(path.join(cwdDir, 'ziwei.sqlite'))) return cwdDir;
  const repoDir = repoDataDir();
  if (repoDir && fs.existsSync(path.join(repoDir, 'ziwei.sqlite'))) return repoDir;
  return cwdDir;
}

/** 导入数据时的目标目录：优先写已有数据库的目录，否则写仓库 data/，避免随 cwd 漂移 */
export function importDataDir(): string {
  if (process.env.ZIWEI_DATA_DIR) return process.env.ZIWEI_DATA_DIR;
  const current = dataDir();
  if (fs.existsSync(path.join(current, 'ziwei.sqlite'))) return current;
  const repoDir = repoDataDir();
  if (repoDir && !repoDir.includes(`${path.sep}.next${path.sep}`)) return repoDir;
  return current;
}

export function dbPath(): string {
  return path.join(dataDir(), 'ziwei.sqlite');
}

export function hasDataset(): boolean {
  return fs.existsSync(dbPath());
}

/** 导入数据后清掉只读连接缓存，让后续查询看到新库 */
export function resetDatasetCache(): void {
  if (cachedDb) {
    try {
      cachedDb.close();
    } catch {
      /* ignore */
    }
  }
  cachedDb = null;
  cachedPath = '';
}

function openDb(): DatabaseLike | null {
  const file = dbPath();
  if (!fs.existsSync(file)) return null;
  if (cachedDb && cachedPath === file) return cachedDb;
  cachedDb = new DatabaseSync(file, { readOnly: true }) as unknown as DatabaseLike;
  cachedPath = file;
  return cachedDb;
}

export function buildDatasetKey(birth: Pick<BirthInfo, 'year' | 'month' | 'day' | 'hour' | 'gender'>): string {
  const hh = String(birth.hour).padStart(1, '0');
  return `${birth.year}-${String(birth.month).padStart(2, '0')}-${String(birth.day).padStart(2, '0')}-${hh}-${birth.gender}`;
}

export interface DatasetChart {
  key: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  gender: 'male' | 'female';
  mingStar: string | null;
  dimensions: Record<string, string>;
}

export interface DatasetOffer {
  year: number;
  tool: string;
  arguments: { year: number };
  estimatedDownloadMB: number;
  message: string;
}

export interface DatasetResult {
  available: boolean;
  key: string;
  source: string;
  license: string;
  chart?: DatasetChart;
  error?: string;
  hints?: string[];
  offerDownload?: DatasetOffer;
}

function rowToChart(row: DatasetRow): DatasetChart {
  let dimensions: Record<string, string> = {};
  try {
    dimensions = JSON.parse(row.c) as Record<string, string>;
  } catch {
    dimensions = { overview: row.c };
  }
  return {
    key: row.k,
    year: row.y,
    month: row.m,
    day: row.d,
    hour: row.h,
    gender: row.g === 'female' ? 'female' : 'male',
    mingStar: row.ms,
    dimensions,
  };
}

function downloadOffer(year: number): DatasetOffer {
  return {
    year,
    tool: 'ziwei_dataset_fetch',
    arguments: { year },
    estimatedDownloadMB: 2,
    message: `本地还没有 ${year} 年的解读数据（压缩包约 2 MB，导入后约数百 MB）。是否现在下载并导入？`,
  };
}

export function getInterpretation(birth: Pick<BirthInfo, 'year' | 'month' | 'day' | 'hour' | 'gender'>): DatasetResult {
  const key = buildDatasetKey(birth);
  const db = openDb();
  if (!db) {
    return {
      available: false,
      key,
      source: DATASET_SOURCE,
      license: DATASET_LICENSE,
      error: '本地还没有导入解读数据集',
      hints: [
        `先运行 npm run data:fetch -- --years ${birth.year}`,
        '导入完成后再调用 ziwei_interpret',
      ],
      offerDownload: downloadOffer(birth.year),
    };
  }
  const row = db.prepare('SELECT k,y,m,d,h,g,ms,c FROM charts WHERE k = ?').get(key) as DatasetRow | undefined;
  if (!row) {
    return {
      available: false,
      key,
      source: DATASET_SOURCE,
      license: DATASET_LICENSE,
      error: `数据集里没有这个键：${key}`,
      hints: [
        '检查出生日期、时辰序号与性别是否与数据集口径一致',
        '数据集按时辰序号 0–11 排盘，不做真太阳时校正',
      ],
      offerDownload: downloadOffer(birth.year),
    };
  }
  return {
    available: true,
    key,
    source: DATASET_SOURCE,
    license: DATASET_LICENSE,
    chart: rowToChart(row),
  };
}

export function pickDimensions(chart: DatasetChart, keys?: string[]): Record<string, string> {
  const wanted = keys?.length ? keys : [...DIMENSIONS];
  const out: Record<string, string> = {};
  for (const k of wanted) {
    const text = chart.dimensions[k];
    if (typeof text === 'string' && text.trim()) out[k] = text;
  }
  return out;
}

export interface DatasetStatus {
  available: boolean;
  path: string;
  release: string;
  license: string;
  charts?: number;
  years?: { min: number; max: number; imported: number[] };
}

export function getDatasetStatus(): DatasetStatus {
  const db = openDb();
  if (!db) {
    return { available: false, path: dbPath(), release: DATASET_RELEASE, license: DATASET_LICENSE };
  }
  const count = (db.prepare('SELECT COUNT(*) AS n FROM charts').get() as { n: number }).n;
  const range = db.prepare('SELECT MIN(y) AS minY, MAX(y) AS maxY FROM charts').get() as { minY: number; maxY: number };
  const years = (db.prepare('SELECT DISTINCT y FROM charts ORDER BY y').all() as { y: number }[]).map((r) => r.y);
  return {
    available: true,
    path: dbPath(),
    release: DATASET_RELEASE,
    license: DATASET_LICENSE,
    charts: count,
    years: { min: range.minY, max: range.maxY, imported: years },
  };
}
