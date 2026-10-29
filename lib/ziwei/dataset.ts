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
import { createRequire } from 'node:module';
import type { BirthInfo } from './types';

const require = createRequire(import.meta.url);

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

export function dataDir(): string {
  return process.env.ZIWEI_DATA_DIR || path.join(process.cwd(), 'data');
}

export function dbPath(): string {
  return path.join(dataDir(), 'ziwei.sqlite');
}

export function hasDataset(): boolean {
  return fs.existsSync(dbPath());
}

function openDb(): DatabaseLike | null {
  const file = dbPath();
  if (!fs.existsSync(file)) return null;
  if (cachedDb && cachedPath === file) return cachedDb;
  const { DatabaseSync } = require('node:sqlite') as {
    DatabaseSync: new (p: string, opts?: { readOnly?: boolean }) => DatabaseLike;
  };
  cachedDb = new DatabaseSync(file, { readOnly: true });
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

export interface DatasetResult {
  available: boolean;
  key: string;
  source: string;
  license: string;
  chart?: DatasetChart;
  error?: string;
  hints?: string[];
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
