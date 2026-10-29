---
name: ziwei-doushu
description: 紫微斗数排盘与解读。用户询问命盘、紫微斗数、十二宫、主星、四化、大限流年、合盘、格局或古籍出处时使用。优先调用 ziwei-doushu MCP 工具；没有 MCP 时用本目录的 CLI。
---

# 紫微斗数（倪海厦《天纪》体系）

本 Skill 让你用一套可复现的排盘引擎回答紫微斗数问题。排盘算法来自 MIT 开源项目 `Renhuai123/ziwei-doushu`，13 维解读来自官方 v4.0 数据集（CC BY 4.0）。

## 何时使用

- 用户给出出生年月日时、性别，想看命盘、十二宫、主星、四化、大限、流年
- 问某个宫位、星曜、格局、古籍原文
- 问两个人的合盘、感情匹配、合伙
- 问紫微斗数术语、排盘规则

## 调用方式

### 优先：MCP 工具

当前环境若已注册 `ziwei-doushu` MCP，直接调用：

| 工具 | 用途 |
|---|---|
| `ziwei_chart` | 排盘，返回完整命盘 JSON |
| `ziwei_interpret` | 查 13 维数据集解读 |
| `ziwei_dataset_fetch` | 下载并导入某年解读数据（用户同意后再调用） |
| `ziwei_patterns` | 格局与命宫摘要 |
| `ziwei_classics` | 古籍原文检索 |
| `ziwei_heming` | 双盘合盘 |
| `ziwei_yunxian` | 大限 / 流年 |
| `ziwei_search` | 古籍全文检索 |
| `ziwei_info` | 版本与数据集状态 |
| `ziwei_help` | 返回使用帮助与示例 |

用户说“帮助”“怎么用”“有哪些功能”时，先调用 `ziwei_help`，再把返回的 quickstart、examples 与 tips 转述给用户。

### 兜底：CLI

没有 MCP 时，在仓库根目录执行：

```bash
npm run ziwei -- chart --year 1990 --month 1 --day 1 --hour 0 --gender male
npm run ziwei -- interpret --year 1990 --month 1 --day 1 --hour 0 --gender male --dimensions love,career
npm run ziwei -- patterns --year 1990 --month 1 --day 1 --hour 0 --gender male
npm run ziwei -- classics --query 紫微
npm run ziwei -- yunxian --year 1990 --month 1 --day 1 --hour 0 --gender male --target-year 2026
npm run ziwei -- info
npm run ziwei -- help
```

## 参数约定

- `year/month/day` 用公历
- `hour` 是**时辰序号 0–11**：子=0、丑=1、寅=2……亥=11，不是钟点
- 用户给的是钟点（如 23:30）时，先按真太阳时/晚子时规则换算成时辰序号；如果用户提供了出生地，带上 `province/city/longitude`
- 性别只能是 `male` / `female`

## 回答流程

1. 先排盘：`ziwei_chart`，拿到十二宫、主星、四化、大限
2. 需要具体断语时：`ziwei_interpret`；若返回 `offerDownload`，先问用户是否下载该年数据，同意后调用 `ziwei_dataset_fetch`，成功后再重试 `ziwei_interpret`；用户拒绝时只用排盘结果与古籍，不编造 13 维解读
3. 问格局：`ziwei_patterns`
4. 问原文：`ziwei_classics`
5. 合盘：`ziwei_heming`
6. 流年/大限：`ziwei_yunxian`

## 输出规则

- 先给结论，再给命盘依据（宫位、星曜、四化）
- 引用古籍时注明书名与章节
- 数据集解读与 AI 推理要分开写：哪些来自数据集，哪些是你根据命盘的分析
- 不编造星曜、宫位、四化；不确定就说“这一步需要更多信息”
- 涉及健康、婚姻、财务时，给建议但不要做绝对断言
- 结尾加一句：命理仅供参考，重大决定请结合现实情况与专业意见

## 示例

用户：1990 年 1 月 1 日子时出生的男生，命宫主星是什么？

1. 调 `ziwei_chart`：`{year:1990, month:1, day:1, hour:0, gender:"male"}`
2. 从返回的 `palaces` 里找 `isMingGong` 的宫位
3. 读取该宫 `stars` 中 `type:"major"` 的星
4. 回答主星、宫位、四化；需要展开时再调 `ziwei_interpret`

用户：帮我看 2026 年流年。

1. 先 `ziwei_chart` 起本命盘
2. 再 `ziwei_yunxian`，`targetYear:2026`
3. 结合 `daXian` 与宫位回答，不把大限当流年

## 数据与许可

- 代码：MIT，上游 `Renhuai123/ziwei-doushu`
- 解读数据：CC BY 4.0，官方 Release `v4.0-13d`
- 数据集不随仓库提交，首次使用前运行 `npm run data:fetch -- --years <年份>`
- 数据集按时辰序号排盘，不做真太阳时校正；与页面按出生地校正的结果可能有差异，回答时说明口径
