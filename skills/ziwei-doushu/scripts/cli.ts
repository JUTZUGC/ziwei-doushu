/**
 * ziwei CLI —— 给不能接 MCP 的宿主或本地脚本使用
 *
 * 用法示例：
 *   npm run ziwei -- chart --year 1990 --month 1 --day 1 --hour 0 --gender male
 *   npm run ziwei -- interpret --year 1990 --month 1 --day 1 --hour 0 --gender male --dimensions love,career
 *   npm run ziwei -- patterns --year 1990 --month 1 --day 1 --hour 0 --gender male
 *   npm run ziwei -- classics --query 紫微
 *   npm run ziwei -- yunxian --year 1990 --month 1 --day 1 --hour 0 --gender male --target-year 2026
 *   npm run ziwei -- info
 */

import { generateChart } from '../../../lib/ziwei/algorithm';
import { detectPatterns, getMingGongSummary } from '../../../lib/ziwei/patterns';
import { searchClassics, ALL_BOOKS, TOTAL_PARAGRAPHS } from '../../../lib/classics';
import { getDatasetStatus, getInterpretation, pickDimensions, DIMENSION_LABELS } from '../../../lib/ziwei/dataset';
import { getDaXianIndexForYear, getDaXianStartYear, getDaXianYears } from '../../../lib/ziwei/yunxian-context';
import type { BirthInfo } from '../../../lib/ziwei/types';

const argv = process.argv.slice(2);
const cmd = argv[0] || 'help';
const flags: Record<string, string> = {};
const pos: string[] = [];
for (let i = 1; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) {
    const key = a.slice(2);
    const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
    flags[key] = val;
  } else {
    pos.push(a);
  }
}

function birth(prefix = ''): BirthInfo {
  const raw = (key: string, idx: number): string | undefined =>
    flags[`${prefix}${key}`] ?? (prefix === '' ? pos[idx] : undefined);
  const numOf = (key: string, idx: number): number => {
    const v = raw(key, idx);
    if (v === undefined) throw new Error(`缺少 --${prefix}${key}（或第 ${idx + 1} 个位置参数）`);
    const x = Number(v);
    if (!Number.isFinite(x)) throw new Error(`--${prefix}${key} 必须是数字`);
    return x;
  };
  const gender = raw('gender', 4);
  if (gender !== 'male' && gender !== 'female') throw new Error(`--${prefix}gender 必须是 male 或 female`);
  const hour = numOf('hour', 3);
  if (!Number.isInteger(hour) || hour < 0 || hour > 11) throw new Error(`--${prefix}hour 必须是 0–11 的时辰序号`);
  return {
    year: numOf('year', 0),
    month: numOf('month', 1),
    day: numOf('day', 2),
    hour,
    gender,
    province: raw('province', 99),
    city: raw('city', 100),
    longitude: raw('longitude', 101) ? Number(raw('longitude', 101)) : undefined,
  };
}

function print(data: unknown) {
  console.log(JSON.stringify(data, null, 2));
}

try {
  switch (cmd) {
    case 'chart':
      print(generateChart(birth()));
      break;
    case 'interpret': {
      const r = getInterpretation(birth());
      if (r.available && r.chart) {
        const dims = flags.dimensions ? flags.dimensions.split(',') : pos[5] ? pos[5].split(',') : undefined;
        print({
          available: true,
          key: r.key,
          source: r.source,
          license: r.license,
          mingStar: r.chart.mingStar,
          labels: DIMENSION_LABELS,
          dimensions: pickDimensions(r.chart, dims),
        });
      } else {
        print(r);
      }
      break;
    }
    case 'patterns': {
      const c = generateChart(birth());
      print({ patterns: detectPatterns(c), mingGong: getMingGongSummary(c) });
      break;
    }
    case 'classics': {
      const q = flags.query ?? pos[0];
      if (!q) throw new Error('缺少 --query');
      print({
        query: q,
        hits: searchClassics(q, Math.min(Number(flags.limit) || 10, 30)),
        books: ALL_BOOKS.map((b) => ({ slug: b.slug, title: b.title, chapters: b.chapters.length })),
        totalParagraphs: TOTAL_PARAGRAPHS,
      });
      break;
    }
    case 'yunxian': {
      const c = generateChart(birth());
      const targetYear = Number(flags['target-year'] ?? pos[5]) || new Date().getFullYear();
      const idx = getDaXianIndexForYear(c, targetYear);
      print({
        targetYear,
        age: targetYear - c.birthInfo.year + 1,
        daXianIndex: idx,
        daXian: idx >= 0 ? c.daXians[idx] : null,
        startYear: idx >= 0 ? getDaXianStartYear(c, idx) : null,
        years: idx >= 0 ? getDaXianYears(c, idx) : [],
        allDaXians: c.daXians,
      });
      break;
    }
    case 'info':
      print({
        name: 'ziwei-doushu',
        version: '1.0.0',
        upstream: 'Renhuai123/ziwei-doushu@ff9a147',
        codeLicense: 'MIT',
        datasetLicense: 'CC BY 4.0',
        dataset: getDatasetStatus(),
      });
      break;
    default:
      console.log(`用法：
  npm run ziwei -- chart --year 1990 --month 1 --day 1 --hour 0 --gender male
  npm run ziwei -- interpret --year 1990 --month 1 --day 1 --hour 0 --gender male [--dimensions love,career]
  npm run ziwei -- patterns --year 1990 --month 1 --day 1 --hour 0 --gender male
  npm run ziwei -- classics --query 紫微 [--limit 10]
  npm run ziwei -- yunxian --year 1990 --month 1 --day 1 --hour 0 --gender male [--target-year 2026]
  npm run ziwei -- info`);
  }
} catch (e) {
  console.error(`错误：${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}
