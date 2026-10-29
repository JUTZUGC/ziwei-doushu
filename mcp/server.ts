/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHostGate } from './host-gate.mjs';
import { generateChart } from '../lib/ziwei/algorithm';
import { detectPatterns, getMingGongSummary } from '../lib/ziwei/patterns';
import { searchClassics, ALL_BOOKS, TOTAL_PARAGRAPHS } from '../lib/classics';
import { STAR_IN_FUQI_GU, HEMING_METHODOLOGY } from '../lib/ziwei/heming-knowledge';
import { getDaXianIndexForYear, getDaXianStartYear, getDaXianYears } from '../lib/ziwei/yunxian-context';
import { getDatasetStatus, getInterpretation, pickDimensions, DIMENSIONS, DIMENSION_LABELS } from '../lib/ziwei/dataset';
import type { BirthInfo, ZiweiChart } from '../lib/ziwei/types';

const VERSION = '1.0.0';
const UPSTREAM = 'Renhuai123/ziwei-doushu@ff9a147';

interface BirthArgs {
  year: number;
  month: number;
  day: number;
  hour: number;
  gender: 'male' | 'female';
  name?: string;
  province?: string;
  city?: string;
  longitude?: number;
}

function num(v: unknown, field: string): number {
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n)) throw new Error(`${field} 必须是数字`);
  return n;
}

function toBirth(a: any): BirthInfo {
  if (!a || typeof a !== 'object') throw new Error('缺少出生信息');
  const gender = a.gender === 'female' ? 'female' : a.gender === 'male' ? 'male' : null;
  if (!gender) throw new Error('gender 必须是 male 或 female');
  const hour = num(a.hour, 'hour');
  if (!Number.isInteger(hour) || hour < 0 || hour > 11) throw new Error('hour 必须是 0–11 的时辰序号（子=0）');
  const year = num(a.year, 'year');
  if (year < 1900 || year > 2026) throw new Error('year 需在 1900–2026 之间');
  return {
    year,
    month: num(a.month, 'month'),
    day: num(a.day, 'day'),
    hour,
    gender,
    name: typeof a.name === 'string' ? a.name : undefined,
    province: typeof a.province === 'string' ? a.province : undefined,
    city: typeof a.city === 'string' ? a.city : undefined,
    longitude: a.longitude === undefined ? undefined : num(a.longitude, 'longitude'),
  };
}

function chartSummary(chart: ZiweiChart) {
  return {
    birthInfo: chart.birthInfo,
    lunarInfo: chart.lunarInfo,
    mingGongBranch: chart.mingGongBranch,
    shenGongBranch: chart.shenGongBranch,
    wuxingJuName: chart.wuxingJuName,
    mingZhu: chart.mingZhu,
    shenZhu: chart.shenZhu,
    yinYangGender: chart.yinYangGender,
    palaces: chart.palaces.map((p) => ({
      branch: p.branch,
      name: p.name,
      stem: p.stem,
      isEmpty: p.isEmpty,
      borrowedStars: p.borrowedStars,
      stars: p.stars.map((s) => ({
        name: s.name,
        type: s.type,
        brightnessRaw: s.brightnessRaw,
        siHua: s.siHua,
      })),
      selfSihua: p.selfSihua,
    })),
    daXians: chart.daXians,
  };
}

const TOOLS = [
  {
    name: 'ziwei_chart',
    description: '紫微斗数排盘。输入公历出生年月日、时辰序号（0=子，11=亥）与性别，返回完整命盘：十二宫、星曜、四化、大限。',
    inputSchema: {
      type: 'object',
      properties: {
        year: { type: 'number', description: '公历年' },
        month: { type: 'number', description: '公历月 1–12' },
        day: { type: 'number', description: '公历日' },
        hour: { type: 'number', description: '时辰序号 0–11（子=0，丑=1……亥=11）' },
        gender: { type: 'string', enum: ['male', 'female'] },
        name: { type: 'string' },
        province: { type: 'string' },
        city: { type: 'string' },
        longitude: { type: 'number', description: '出生地经度，用于真太阳时校正' },
      },
      required: ['year', 'month', 'day', 'hour', 'gender'],
    },
  },
  {
    name: 'ziwei_interpret',
    description: '查询官方 v4.0 数据集的 13 维解读。需要先导入对应年份数据；不导入时只返回提示。',
    inputSchema: {
      type: 'object',
      properties: {
        year: { type: 'number' },
        month: { type: 'number' },
        day: { type: 'number' },
        hour: { type: 'number', description: '时辰序号 0–11' },
        gender: { type: 'string', enum: ['male', 'female'] },
        dimensions: {
          type: 'array',
          items: { type: 'string', enum: [...DIMENSIONS] },
          description: '只取指定维度，不传则返回全部 13 维',
        },
      },
      required: ['year', 'month', 'day', 'hour', 'gender'],
    },
  },
  {
    name: 'ziwei_patterns',
    description: '格局判定与命宫摘要。返回命盘中识别出的格局、命宫主星与三方四正摘要。',
    inputSchema: {
      type: 'object',
      properties: {
        year: { type: 'number' }, month: { type: 'number' }, day: { type: 'number' },
        hour: { type: 'number' }, gender: { type: 'string', enum: ['male', 'female'] },
      },
      required: ['year', 'month', 'day', 'hour', 'gender'],
    },
  },
  {
    name: 'ziwei_classics',
    description: '古籍原文检索（紫微斗数全书、全集、顾髓赋）。返回书名、章节、段落与原文。',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '检索词' },
        limit: { type: 'number', description: '返回条数，默认 10，最大 30' },
      },
      required: ['query'],
    },
  },
  {
    name: 'ziwei_heming',
    description: '双盘合盘。输入两人出生信息，返回双方命盘、夫妻宫主星与合盘知识库要点。',
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'object', description: '甲方出生信息，字段同 ziwei_chart' },
        b: { type: 'object', description: '乙方出生信息，字段同 ziwei_chart' },
      },
      required: ['a', 'b'],
    },
  },
  {
    name: 'ziwei_yunxian',
    description: '运限查询。返回指定年份对应的大限、起始年份与四化信息。',
    inputSchema: {
      type: 'object',
      properties: {
        year: { type: 'number' }, month: { type: 'number' }, day: { type: 'number' },
        hour: { type: 'number' }, gender: { type: 'string', enum: ['male', 'female'] },
        targetYear: { type: 'number', description: '要查询的年份，默认今年' },
      },
      required: ['year', 'month', 'day', 'hour', 'gender'],
    },
  },
  {
    name: 'ziwei_search',
    description: '在古籍原文中全文检索，适合查某个星曜、格局或术语的出处。',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['query'],
    },
  },
  {
    name: 'ziwei_info',
    description: '返回版本、上游来源、许可与本地数据集导入状态。',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'ziwei_help',
    description: '返回百度搭子里的使用帮助：部署后怎么排盘、怎么查解读、怎么问合盘、怎么调出帮助菜单。用户说“帮助”“怎么用”时调用。',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', enum: ['quickstart', 'tools', 'data', 'mcp', 'all'], description: '帮助主题，默认 all' },
      },
    },
  },
];

function spouseInfo(chart: ZiweiChart) {
  const palace = chart.palaces.find((p) => p.name === '夫妻');
  const major = palace?.stars.find((s) => s.type === 'major')?.name;
  const knowledge = major ? STAR_IN_FUQI_GU[major] : undefined;
  return { palace, majorStar: major ?? null, knowledge: knowledge ?? null };
}

async function callTool(name: string, args: any): Promise<unknown> {
  switch (name) {
    case 'ziwei_chart': {
      const chart = generateChart(toBirth(args));
      return chart;
    }
    case 'ziwei_interpret': {
      const birth = toBirth(args);
      const result = getInterpretation(birth);
      if (!result.available || !result.chart) return result;
      const dims = Array.isArray(args.dimensions) ? args.dimensions : undefined;
      return {
        available: true,
        key: result.key,
        source: result.source,
        license: result.license,
        mingStar: result.chart.mingStar,
        labels: DIMENSION_LABELS,
        dimensions: pickDimensions(result.chart, dims),
      };
    }
    case 'ziwei_patterns': {
      const chart = generateChart(toBirth(args));
      return { patterns: detectPatterns(chart), mingGong: getMingGongSummary(chart) };
    }
    case 'ziwei_classics': {
      const q = String(args?.query ?? '').trim();
      if (!q) throw new Error('query 不能为空');
      const limit = Math.min(Math.max(Number(args?.limit) || 10, 1), 30);
      return { query: q, hits: searchClassics(q, limit), books: ALL_BOOKS.map((b) => ({ slug: b.slug, title: b.title, chapters: b.chapters.length })), totalParagraphs: TOTAL_PARAGRAPHS };
    }
    case 'ziwei_heming': {
      const chartA = generateChart(toBirth(args?.a));
      const chartB = generateChart(toBirth(args?.b));
      return {
        a: chartSummary(chartA),
        b: chartSummary(chartB),
        spouseA: spouseInfo(chartA),
        spouseB: spouseInfo(chartB),
        methodology: HEMING_METHODOLOGY.slice(0, 2000),
      };
    }
    case 'ziwei_yunxian': {
      const chart = generateChart(toBirth(args));
      const targetYear = Number(args?.targetYear) || new Date().getFullYear();
      const idx = getDaXianIndexForYear(chart, targetYear);
      const dx = idx >= 0 ? chart.daXians[idx] : null;
      return {
        targetYear,
        age: targetYear - chart.birthInfo.year + 1,
        daXianIndex: idx,
        daXian: dx,
        startYear: idx >= 0 ? getDaXianStartYear(chart, idx) : null,
        years: idx >= 0 ? getDaXianYears(chart, idx) : [],
        allDaXians: chart.daXians,
      };
    }
    case 'ziwei_search': {
      const q = String(args?.query ?? '').trim();
      if (!q) throw new Error('query 不能为空');
      const limit = Math.min(Math.max(Number(args?.limit) || 10, 1), 30);
      return { query: q, hits: searchClassics(q, limit) };
    }
    case 'ziwei_info':
      return {
        name: 'ziwei-doushu-mcp',
        version: VERSION,
        upstream: UPSTREAM,
        codeLicense: 'MIT',
        datasetLicense: 'CC BY 4.0',
        dataset: getDatasetStatus(),
        platform: '仅限百度搭子（host gate: dumate）',
      };
    case 'ziwei_help': {
      const topic = args?.topic ?? 'all';
      return {
        title: '紫微斗数 · 百度搭子使用帮助',
        topic,
        quickstart: [
          '打开浏览器访问本机 3000 端口，输入公历生日与时辰即可排盘。',
          '在百度搭子对话框里直接说：用紫微斗数帮我排盘，1990 年 1 月 1 日子时，男。',
          '想看 13 维解读，先说：帮我导入 1990 年的解读数据；再说：看这个命盘的感情和事业。',
          '想合盘，说：用紫微斗数帮我们合盘，甲方……乙方……。',
          '想调出这份帮助，随时说：紫微斗数帮助。',
        ],
        tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
        examples: [
          { ask: '帮我排盘：1990 年 1 月 1 日子时，男', tool: 'ziwei_chart' },
          { ask: '这个命盘的感情和事业怎么样？', tool: 'ziwei_interpret + ziwei_patterns' },
          { ask: '2026 年我的大限和流年如何？', tool: 'ziwei_yunxian' },
          { ask: '我们俩合盘看看', tool: 'ziwei_heming' },
          { ask: '《全书》里巨门在命宫怎么说？', tool: 'ziwei_classics' },
          { ask: '现在导入了哪些年份的数据？', tool: 'ziwei_info' },
        ],
        data: {
          source: '官方 v4.0 数据集（CC BY 4.0）',
          import: 'npm run data:fetch -- --years 1990',
          status: 'npm run data:status',
          note: '数据按年份导入；没导入时排盘与古籍仍可用，13 维解读会提示先导入。',
        },
        mcp: {
          command: 'npx tsx <仓库绝对路径>/mcp/server.ts',
          note: 'MCP 只在百度搭子中可用；换工作区需要重新注册。',
        },
        disclaimer: '命理仅供参考，重大决定请结合现实情况与专业意见。',
      };
    }
    default:
      throw new Error(`未知工具：${name}`);
  }
}

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
});

function send(obj: unknown) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

async function handle(msg: any) {
  const { id, method, params } = msg;
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
  if (method === 'notifications/initialized') return;
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
    if (process.env.ZIWEI_MCP_BYPASS_GATE !== '1') {
      const check = await gate.check();
      if (!check.ok) {
        send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(check.payload, null, 2) }], isError: true } });
        return;
      }
    }
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
