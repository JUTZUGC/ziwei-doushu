/**
 * 紫微斗数 AI 提示词构建
 *
 * 目标：让模型只基于排盘结果与已导入的数据集回答，区分“数据集原文”与“模型分析”。
 */

import type { ZiweiChart } from '../ziwei/types';
import { DIMENSION_LABELS, getInterpretation, pickDimensions, type DimensionKey } from '../ziwei/dataset';
import { HEMING_METHODOLOGY, STAR_IN_FUQI_GU } from '../ziwei/heming-knowledge';

const BASE_RULES = `你是紫微斗数解读助手，依据倪海厦《天纪》体系与《紫微斗数全书》回答。
规则：
1. 先给结论，再给命盘依据（宫位、星曜、四化、大限）。
2. 只使用提供的排盘数据与数据集原文，不虚构星曜、宫位、四化或古籍出处。
3. 数据集原文与你的分析要分开写：标注“数据集原文”与“命盘分析”。
4. 健康、婚姻、财务只给参考建议，不做绝对断言。
5. 用简体中文，结构清晰，避免空话。
6. 结尾固定写一句：命理仅供参考，重大决定请结合现实情况与专业意见。`;

function compactChart(chart: ZiweiChart) {
  return {
    birthInfo: chart.birthInfo,
    lunarInfo: chart.lunarInfo,
    wuxingJuName: chart.wuxingJuName,
    mingZhu: chart.mingZhu,
    shenZhu: chart.shenZhu,
    yinYangGender: chart.yinYangGender,
    mingGongBranch: chart.mingGongBranch,
    shenGongBranch: chart.shenGongBranch,
    palaces: chart.palaces.map((p) => ({
      name: p.name,
      branch: p.branch,
      isEmpty: p.isEmpty,
      borrowedStars: p.borrowedStars,
      stars: p.stars.map((s) => ({ name: s.name, type: s.type, brightness: s.brightnessRaw, siHua: s.siHua })),
      selfSihua: p.selfSihua,
    })),
    daXians: chart.daXians,
  };
}

function detectDimensions(text: string): DimensionKey[] {
  const t = text.toLowerCase();
  const map: Array<[DimensionKey, string[]]> = [
    ['love', ['感情', '婚姻', '夫妻', '恋爱', '结婚', '对象']],
    ['career', ['事业', '工作', '职业', '升职', '创业']],
    ['wealth', ['财运', '财富', '钱', '收入', '投资']],
    ['health', ['健康', '身体', '疾病', '疾厄']],
    ['personality', ['性格', '个性', '特质']],
    ['family', ['兄弟', '合伙', '姐妹']],
    ['children', ['子女', '孩子', '下属']],
    ['move', ['迁移', '外出', '出国', '异地']],
    ['friends', ['朋友', '人际', '贵人', '小人']],
    ['home', ['田宅', '房产', '不动产', '家']],
    ['spirit', ['福德', '精神', '内心']],
    ['parents', ['父母', '长辈']],
  ];
  const hit = map.filter(([, words]) => words.some((w) => t.includes(w))).map(([k]) => k);
  return hit.length ? hit : ['overview', 'personality'];
}

export function datasetText(chart: ZiweiChart, dimensions: DimensionKey[], perDim = 2600): string {
  const r = getInterpretation(chart.birthInfo);
  if (!r.available || !r.chart) {
    return `【数据集状态】${r.error ?? '未导入'}。不要编造 13 维解读；只根据命盘与古籍分析。`;
  }
  const dims = pickDimensions(r.chart, dimensions);
  const parts: string[] = [`【数据集】官方 v4.0，键 ${r.key}，许可 CC BY 4.0。`];
  for (const [k, v] of Object.entries(dims)) {
    const label = DIMENSION_LABELS[k as DimensionKey] ?? k;
    parts.push(`\n### ${label}\n${v.slice(0, perDim)}${v.length > perDim ? '…' : ''}`);
  }
  return parts.join('\n');
}

export function buildInterpretSystem(chart: ZiweiChart, userText: string): string {
  const dims = detectDimensions(userText);
  return `${BASE_RULES}

【当前命盘】
${JSON.stringify(compactChart(chart))}

${datasetText(chart, dims)}

【任务】
回答用户问题。先引用相关宫位/星曜/四化，再给分析；有数据集原文时优先引用，并注明维度。`;
}

export function buildHemingSystem(a: ZiweiChart, b: ZiweiChart, question?: string): string {
  const spouse = (c: ZiweiChart) => {
    const p = c.palaces.find((x) => x.name === '夫妻');
    const star = p?.stars.find((s) => s.type === 'major')?.name ?? '';
    return { palace: p?.name, star, knowledge: star ? STAR_IN_FUQI_GU[star] ?? null : null };
  };
  return `${BASE_RULES}

【合盘方法论】
${HEMING_METHODOLOGY.slice(0, 3000)}

【甲方命盘】
${JSON.stringify(compactChart(a))}

【甲方夫妻宫】
${JSON.stringify(spouse(a))}

【乙方命盘】
${JSON.stringify(compactChart(b))}

【乙方夫妻宫】
${JSON.stringify(spouse(b))}

${datasetText(a, ['love', 'career', 'wealth'], 1600)}
${datasetText(b, ['love', 'career', 'wealth'], 1600)}

【任务】
${question ? `用户追问：${question}\n` : ''}分析两人的感情匹配、相处模式、潜在冲突与建议。分别引用双方夫妻宫与相关宫位，不虚构。`;
}
