<div align="center">

# Zi Wei Dou Shu · Open-Source Charting Engine

### Algorithms are openly shared traditional wisdom; they shouldn’t be locked behind walls.

[![CI](https://github.com/JUTZUGC/ziwei-doushu/actions/workflows/ci.yml/badge.svg)](https://github.com/JUTZUGC/ziwei-doushu/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/code-MIT-blue.svg)](./LICENSE)
[![Dataset: CC BY 4.0](https://img.shields.io/badge/dataset-CC%20BY%204.0-green.svg)](./DATASET-LICENSE)

[中文](./README.md) · **English**

</div>

An open-source Zi Wei Dou Shu charting engine: enter a Gregorian birth date to get a full chart with the twelve palaces, Four Transformations, decade and annual cycles, 13-topic readings and classical text search. It also runs as an MCP server for Baidu Dumate, or as a local web app.

## One-click deploy (recommended: Dumate)

> [!TIP]
> No need to set up Node yourself — let Dumate clone the repo, install dependencies, start the web app, and register the MCP server in the current workspace.

⚠️ Requires Node.js 22+, Git, and network access to GitHub and npm. The web app uses port 3000 by default.

1. **Install the client**
   Download the desktop app from [dumate.cn](https://www.dumate.cn/), install and sign in.

2. **Send this message to Dumate**

> [!IMPORTANT]
> ```text
> 你好，帮我从 github 部署 JUTZUGC/ziwei-doushu 到我的电脑上，装好后启动网页，并用绝对路径把 mcp/server.ts 注册到当前工作区的 MCP。
> ```

3. **Follow the conversation**
   Dumate clones the repo, runs `npm install`, starts the server and reports the MCP registration result. Keep the repo in a stable directory (e.g. `C:\Users\<you>\ziwei-doushu`), not in a temporary session folder.

4. **Open the web app**
   Visit [http://127.0.0.1:3000](http://127.0.0.1:3000) and enter a Gregorian birth date, double-hour and gender.

5. **Bring up the help menu**
   In the same conversation window, just say:

> ```text
> 紫微斗数帮助
> ```

   Dumate calls `ziwei_help` and returns usage for charting, interpretation, compatibility, luck cycles, the dataset and MCP.

### After deployment

| What you want | Say to Dumate |
|---|---|
| Chart a birth | 用紫微斗数帮我排盘，1990 年 1 月 1 日子时，男 |
| Personality / love / career | 看这个命盘的性格、感情和事业 |
| Decade and annual luck | 看 2026 年的大限和流年 |
| Two-chart compatibility | 用紫微斗数帮我们合盘，甲方……乙方…… |
| Look up a classical passage | 《全书》里巨门在命宫怎么说 |
| Import one year of readings | 帮我导入 1990 年的解读数据 |
| Check imported data | 现在导入了哪些年份的数据 |
| Show help | 紫微斗数帮助 |

### Optional setup

```bash
npm run data:fetch -- --years 1990   # import the 13-topic readings for one year
npm run data:status                  # list imported years
```

AI chat needs an OpenAI-compatible endpoint in `.env.local`; see “AI interpretation” below. The full walkthrough (Chinese) is in [docs/dumate-deploy.md](./docs/dumate-deploy.md).

## What this repo adds: MCP / Skill / dataset

> Rebuilt on upstream [`Renhuai123/ziwei-doushu`](https://github.com/Renhuai123/ziwei-doushu) (MIT), adding an MCP server, a Skill plugin, AI interpretation routes and a query layer for the official v4.0 dataset. Upstream code and dataset licenses are recorded in [NOTICE](./NOTICE).

### Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

### MCP (Dumate only)

```bash
npm run mcp
```

`.mcp.json` ships a stdio configuration. The host gate is enforced: `initialize`, `ping`, `tools/list` and `tools/call` all check the ancestor process chain first, and any host other than Dumate receives `HOST_NOT_ALLOWED` — there is no bypass switch. The Skill's CLI fallback uses the same gate.

Tools: `ziwei_chart`, `ziwei_interpret`, `ziwei_dataset_fetch`, `ziwei_patterns`, `ziwei_classics`, `ziwei_heming`, `ziwei_yunxian`, `ziwei_search`, `ziwei_info`, `ziwei_help`.

### Skill

```text
skills/ziwei-doushu/SKILL.md
```

Copy the whole `skills/ziwei-doushu` directory into your host's skills directory. Without MCP, the Skill falls back to the CLI:

```bash
npm run ziwei -- chart --year 1990 --month 1 --day 1 --hour 0 --gender male
```

### Interpretation dataset

The official v4.0 dataset is not committed to this repo; download, verify and import it year by year into SQLite:

```bash
npm run data:fetch -- --years 1990
npm run data:status
```

Licensed CC BY 4.0; provenance is documented in [NOTICE](./NOTICE). For a year that has not been imported, the web app shows a “download and import” button, and `ziwei_interpret` returns `offerDownload` in MCP so the assistant can ask first and then call `ziwei_dataset_fetch`.

### AI interpretation

Copy `.env.example` to `.env.local` and fill in an OpenAI-compatible endpoint:

```text
AI_API_KEY=...
AI_BASE_URL=https://api.deepseek.com/v1
AI_MODEL=deepseek-chat
```

Charting and dataset readings work without it; only `/api/interpret` and `/api/heming` report “not configured”.

---

**1. Philosophy:** Zi Wei Dou Shu is a treasure of traditional Chinese astrology, and Ni Haixia laid out its authentic system in *Tian Ji* (《天纪》). We hope technology can bring more people to learn it.

We open-source the charting algorithm and the knowledge base because we believe **algorithms are openly shared traditional wisdom and shouldn’t be locked behind walls**. The real value lies in the depth of interpretation, a carefully polished user experience, and what we build up by running the service day after day.

**2. About the project:** A Zi Wei Dou Shu (紫微斗数, "Purple Star Astrology") charting engine following the teaching system of **Ni Haixia's *Tian Ji* (倪海厦《天纪》)**. It includes the full charting algorithm, the Four Transformations (四化), a pattern knowledge base, public-domain classical texts, and a **518,400-chart sample dataset**, plus a **674,976-chart × 13-topic interpretation dataset (v4.0, 2026-10-15): 8.77 million readings, about 20.4 billion characters of text, 56.6 GB uncompressed** — up from 518,400 charts and 33.1 GB in v3.0.

| Dataset | Charts | Readings | Uncompressed | Years | Characters per chart |
|---|---|---|---|---|---|
| **v4.0 interpretations** (2026-10-15) | **674,976** | **8,774,688** | **56.6 GB** | **1950–2026** (real dates only) | **~30,000** |
| v3.0 samples | 518,400 | 6,739,200 | 33.1 GB | 1924–1983 | ~21,000 |
| Change | +30% | +30% | **+71%** | +17 years | +44% |

<sub>v3.0 characters per chart estimated from a 2,160-chart sample; all other figures are full counts. Both versions have 13 topics per chart.</sub>

The engine is an open snapshot of the one behind [metisziwei.com](https://metisziwei.com/?from=gh-readme-en), synced from production periodically.

> **Note: on readings of family relations**
>
> Zi Wei Dou Shu has known limits when it comes to family relations (parents, siblings, children and so on). In *Tian Ji*, Master Ni Haixia said that "Dou Shu has always been somewhat weaker at reading family relations" ([lecture 2, part 1 · 00:25:27](https://www.bilibili.com/video/BV1KJsLekEfA?p=3&t=1527)). Among traditional methods, Tie Ban Shen Shu has its own strengths in checking family relations ([00:03:15](https://www.bilibili.com/video/BV1KJsLekEfA?p=3&t=195)); Master Ni still kept Zi Wei Dou Shu at the core because it can be read together with geography, surroundings and human affairs, forming a complete system that knows the heavens above, the earth below and human affairs in between ([00:25:43](https://www.bilibili.com/video/BV1KJsLekEfA?p=3&t=1543)). Readings about family relations are therefore for reference only; the Parents, Siblings and Children sections on [metisziwei.com](https://metisziwei.com/?from=gh-readme-en) carry the same note.

## Latest update (2026-10-15)

![Update overview](./docs/update-20261015.png)

- **Interpretation dataset v4.0 released**: 674,976 charts (every real solar date 1950–2026 × 12 double-hours × male/female) × 13 topics = 8,774,688 readings; 161 MB compressed, 56.6 GB uncompressed (v3.0: 33.1 GB), 77 per-year files plus an all-years bundle. See [Release v4.0-13d](https://github.com/Renhuai123/ziwei-doushu/releases/tag/v4.0-13d) and the dataset section below.
- **The 13 topics were revised sentence by sentence** against the verbatim transcripts of Ni Haixia's *Tian Ji* and the original *Complete Book*: untraceable citations removed or replaced with verbatim quotes (with episode and timestamp), sentences about impossible transformations removed, conditions spelled out, two-sided sentences resolved per chart, and health now follows Master Ni's whole-chart method instead of mapping stars to organs by Five Element. (The judgment library itself stays closed; the results are in the v4.0 dataset.)
- **Engine sync** ([PR #39](https://github.com/Renhuai123/ziwei-doushu/pull/39)): `chinaDSTSpan(year)` in `dst-cn.ts`; longitudes for province-administered county-level cities in `cities.ts`.
- **License**: `DATASET-LICENSE` now covers v4.0; quotations from *Tian Ji* inside the readings are not covered by the dataset license.

> **2026-10-27 addendum**: engine sync. `true-solar-time.ts` accepts `utcOffsetMinutes` (the birthplace's standard UTC offset) for births outside China; results inside China are unchanged. New `clock-adjust.ts` converts a clock reading taken under daylight saving time (or an older time zone) to standard time; it never crosses midnight and is meant to run only when the user confirms. Correction: the engine detects China DST but has never subtracted it automatically; the table below said otherwise.

## What the engine handles

| Feature | Notes |
|---|---|
| True solar time | Longitude offset plus the equation of time, so births near hour boundaries are not off by one double-hour |
| China DST | 1986–1991 daylight-saving periods are detected (not subtracted automatically; convert the clock reading with `clock-adjust.ts` once the user confirms) |
| Leap months | Four configurable conventions (previous month / next month / split by day / same month) |
| Late Zi hour | 23:00–23:59 is charted on the next day, 00:00–00:59 on the same day; switchable |
| Star brightness | 7 levels (庙 旺 得 利 平 不 陷); brightness tables of different schools are switchable, not hard-coded |
| Four Transformations | Natal, decade (大限) and annual (流年) transformations, plus flying-star self-transformations |
| Twelve spirits | Natal layer by year branch, annual layer by the annual branch |
| Patterns | 1,100+ lines of pattern rules (紫府同宫, 日月并明, 七杀朝斗, …) |

Engine code lives in `lib/ziwei/` (entry point: `generateChart()` in `algorithm.ts`). Inputs are a **Gregorian** date and an **hour branch index 0–11** (子 = 0 … 亥 = 11), not a clock hour.

## Quick start

```bash
git clone https://github.com/JUTZUGC/ziwei-doushu.git
cd ziwei-doushu
npm install
npm run dev          # charting demo at http://localhost:3000/chart

npm run typecheck    # TypeScript check
npm test             # charting + MCP contract regression tests
```

**No API key is needed for charting.** Charting, chart display and dual-chart setup all run in the browser with this repo's engine. AI interpretation (`/api/interpret`) and compatibility analysis (`/api/heming`) are included in this fork, but require an OpenAI-compatible endpoint in `.env.local`; without it they return `AI_NOT_CONFIGURED`.

## Interpretation dataset v4.0 (674,976 charts × 13 topics, 2026-10-15)

Download from [Releases → v4.0-13d](https://github.com/Renhuai123/ziwei-doushu/releases/tag/v4.0-13d): 77 per-year files `year-YYYY.jsonl.zst` (161 MB compressed, 56.6 GB uncompressed (v3.0: 33.1 GB)), plus `SHA256SUMS.txt` and `MANIFEST.json`.

- Every solar date from 1950 to 2026 (only dates that actually exist) × 12 double-hours × male/female; one chart per line (JSON Lines).
- Fields: `k` key, `y`/`m`/`d` solar date, `h` double-hour index 0–11 (not clock hours), `g` gender, `ms` first major star of the Life Palace (`null` if empty), `t` character counts, `c` the 13 topic readings in Markdown.
- Generated deterministically by the charting engine and the 2026-10-15 judgment library (content version `ca268829f7a9`), no AI involved. The 13 topics were revised sentence by sentence against the verbatim transcripts of Ni Haixia's *Tian Ji* and the original *Complete Book of Zi Wei Dou Shu*.
- Natal-chart view only: age-based rewording, the appended Master Ni rule sections and AI readings shown on the website are not included. Charts use the double-hour index directly, without true-solar-time correction.
- Decompress with `zstd -d --long=27 year-1990.jsonl.zst` (`--long=27` is required). `npm run data:fetch` does this for you with native zstd and verifies SHA-256 before importing into SQLite.
- Quotations from Ni Haixia's *Tian Ji* inside the readings are **not covered by the dataset license**: they are short citations with episode and timestamp, and copyright in the original lectures remains with the rights holder; bulk reuse of those quotations falls under the [CC BY-NC-SA 4.0](./docs/tianji-ziwei/LICENSE.md) terms of chapter 5. The *Complete Book* is in the public domain.
- License: same as v3.0 — [CC BY 4.0](./DATASET-LICENSE), commercial use OK with attribution (except the quotations above).
- A single all-years bundle `ziwei-interp-v4-all.tar` is also provided.

## Sample dataset (518,400 charts)

Download from [Releases](https://github.com/Renhuai123/ziwei-doushu/releases/tag/v3.0-samples) (3 parts, 5.5 GB in total). Each sample is generated from `birthInfo`:

- `year` / `month` / `day`: **Gregorian** date, 1924–1983 (one full 60-year cycle), days 1–30 of every month
- `hour`: **hour branch index 0–11** (子 = 0 … 亥 = 11), *not* a clock hour; the `hHH` part of each file name is the same index
- `gender`: `male` / `female`; `longitude` is fixed at 120 (no local true-solar-time correction)

**Known issue:** about 2,520 samples (0.49%) carry dates that do not exist: Feb 30, and Feb 29 in non-leap years. The engine silently rolled them over to Mar 1–2, so their content duplicates the Mar 1–2 samples. Filter out `month = 2 && day = 30`, and `month = 2 && day = 29` in non-leap years. From 2026-10-03 the engine rejects non-existent dates.

## Ni Haixia's original words (*Tian Ji*, Zi Wei part)

[`docs/tianji-ziwei/`](./docs/tianji-ziwei/) holds **1,848 quotes** from the Zi Wei lectures of *Tian Ji* (14 lectures plus 2 supplements), each linked to the second it was said in the video. Taken from the sister repo [nihai-tianji-corpus](https://github.com/Renhuai123/nihai-tianji-corpus).

## The interface is a demo

The UI in `app/` and `components/` is a minimal runnable example: enough to exercise the engine and draw the chart, so you can build your own product on top. The production UI is **not** open source, and the gap is large:

| Page / component | This repo (demo) | Production |
|---|---|---|
| Chart page `app/chart/page.tsx` | minimal | 1,227 lines |
| Interpretation panel `InsightPanel` | minimal | 5,088 lines |
| Chart board `ChartBoard` | minimal | 1,334 lines |
| Palace cell `PalaceCell` | minimal | 1,192 lines |
| Compatibility page `app/heming/page.tsx` | minimal | 1,937 lines |

This fork keeps that demo and adds a dataset panel (`components/DatasetPanel.tsx`) for the 13-topic readings and a streaming chat panel for `/api/interpret` and `/api/heming`.

**Not included:** the original judgment library (`lib/ziwei/db-analysis.ts` is a placeholder), user accounts, payments, anti-abuse and deployment configuration.

## Maintenance and contributions

This repo is an **open snapshot of the engine plus the datasets**, not a full-time maintained open-source product:

- **Engine sync**: `lib/ziwei/` follows production releases and tags. The judgment library, AI prompts and the commercial frontend are out of scope.
- **Fork-specific code** (`mcp/`, `skills/`, `scripts/data/`, `lib/ai/`, `app/api/`): maintained here.
- **Issues**: read, but replies may be slow; reports with reproduction steps or a concrete chart (date, double-hour, gender, which line is wrong) come first.
- **PRs**: welcome, especially regression tests, methodology corrections and docs. Changes to charting methodology need a citation (classical text or a verifiable comparison).

## License

| Part | License |
|---|---|
| Code (`lib/`, `app/`, `components/`, `mcp/`, `skills/`, `scripts/`) | [MIT](./LICENSE) |
| Sample dataset (Releases) | [CC BY 4.0](./DATASET-LICENSE): commercial use OK with attribution |
| Classical texts | Public domain |
| Ni Haixia quotes (`docs/tianji-ziwei/`) | [CC BY-NC-SA 4.0](./docs/tianji-ziwei/LICENSE.md): **non-commercial only** |

Upstream attribution is recorded in [NOTICE](./NOTICE): the charting engine is derived from `Renhuai123/ziwei-doushu` (MIT), and the v4.0 dataset is published by the upstream project under CC BY 4.0.

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md); questions go to [Discussions](https://github.com/Renhuai123/ziwei-doushu/discussions).
