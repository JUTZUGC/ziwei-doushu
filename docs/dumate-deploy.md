# 紫微斗数 · 百度搭子部署指南

> 本指南对应仓库：[JUTZUGC/ziwei-doushu](https://github.com/JUTZUGC/ziwei-doushu)
> 上游代码基于 [Renhuai123/ziwei-doushu](https://github.com/Renhuai123/ziwei-doushu)（MIT），解读数据为官方 v4.0（CC BY 4.0）。

[![⚡ 一键部署](https://img.shields.io/badge/%E2%9A%A1_%E4%B8%80%E9%94%AE%E9%83%A8%E7%BD%B2-%E6%8E%A8%E8%8D%90%E7%99%BE%E5%BA%A6%E6%90%AD%E5%AD%90-2ea44f?style=for-the-badge)](#一键部署)

## 一键部署

> [!TIP]
> 不用自己配 Node 环境，让百度搭子克隆仓库、安装依赖、启动网页，并把 MCP 注册到当前工作区。

⚠️ 需要 Node.js 22+、Git，以及能访问 GitHub 与 npm 的网络；网页默认使用 3000 端口。

### 1. 装客户端

打开[百度搭子官网](https://www.dumate.cn/)下载电脑端，安装并登录。

### 2. 复制这一句发给百度搭子

> [!IMPORTANT]
> ```text
> 你好，帮我从 github 部署 JUTZUGC/ziwei-doushu 到我的电脑上，装好后启动网页，并用绝对路径把 mcp/server.ts 注册到当前工作区的 MCP。
> ```

### 3. 跟着对话往下走

百度搭子会做这些事：

1. 克隆仓库到固定目录
2. 执行 `npm install`
3. 启动 `npm run dev`，确认 3000 端口可访问
4. 用绝对路径注册 MCP
5. 调用 `ziwei_info` 验证连接

建议把仓库放在固定目录，例如 `C:\Users\<你的用户名>\ziwei-doushu`。不要放在会话临时目录，否则目录被清理后 MCP 注册会失效。

### 4. 打开网页

浏览器访问 [http://127.0.0.1:3000](http://127.0.0.1:3000) ，输入公历生日、时辰与性别即可排盘。

### 5. 调出帮助菜单

在同一个对话窗口里直接说：

> ```text
> 紫微斗数帮助
> ```

百度搭子会调用 `ziwei_help`，返回排盘、解读、合盘、运限、数据集与 MCP 的用法。

也可以在仓库目录执行：

```bash
npm run ziwei -- help
```

## 部署完成后怎么用

| 你想做什么 | 对百度搭子说 |
|---|---|
| 排盘 | 用紫微斗数帮我排盘，1990 年 1 月 1 日子时，男 |
| 看性格 / 感情 / 事业 | 看这个命盘的性格、感情和事业 |
| 查大限流年 | 看 2026 年的大限和流年 |
| 两人合盘 | 用紫微斗数帮我们合盘，甲方……乙方…… |
| 查古籍原文 | 《全书》里巨门在命宫怎么说 |
| 导入某年解读 | 帮我导入 1990 年的解读数据 |
| 看数据状态 | 现在导入了哪些年份的数据 |
| 调出帮助 | 紫微斗数帮助 |

## MCP 注册

百度搭子按**工作区**注册 MCP，并且要使用**绝对路径**。推荐配置：

```json
{
  "type": "local",
  "command": [
    "node",
    "<仓库绝对路径>/node_modules/tsx/dist/cli.mjs",
    "<仓库绝对路径>/mcp/server.ts"
  ]
}
```

Windows 路径示例（注意 JSON 里反斜杠要写成双反斜杠）：

```json
{
  "type": "local",
  "command": [
    "node",
    "C:\\Users\\XuanKa\\ziwei-doushu\\node_modules\\tsx\\dist\\cli.mjs",
    "C:\\Users\\XuanKa\\ziwei-doushu\\mcp\\server.ts"
  ]
}
```

仓库根目录的 `.mcp.json` 只适用于支持 `cwd` 的客户端；百度搭子请用上面的绝对路径写法。

门禁是硬约束，没有绕过开关：`initialize`、`ping`、`tools/list`、`tools/call` 都先校验宿主进程链，非百度搭子一律返回 `HOST_NOT_ALLOWED` 并附带安装指引；宿主进程检测失败时同样拒绝。Skill 的 CLI 兜底也走同一套门禁。换工作区后需要重新注册。

## 数据集

13 维解读数据不随仓库提交，按年份下载：

```bash
npm run data:fetch -- --years 1990
npm run data:status
```

- 数据来源：官方 Release `v4.0-13d`
- 许可：CC BY 4.0
- 未导入的年份：排盘、格局、古籍仍可用，13 维解读会提示先导入
- 数据集体积较大，按年份取，不要一次拉全量

## AI 解读

复制 `.env.example` 为 `.env.local`，填入 OpenAI 兼容接口：

```text
AI_API_KEY=你的_key
AI_BASE_URL=https://api.deepseek.com/v1
AI_MODEL=deepseek-chat
```

不配置也能排盘、看数据集解读，只是 `/api/interpret` 与 `/api/heming` 会提示未配置。

## 常见坑

- 3000 端口被占用：先结束占用进程，或运行 `npm run dev -- -p 3001`
- MCP 注册后工具不出现：确认用的是绝对路径，且路径指向 `mcp/server.ts`；注册或更新后重启客户端才会加载
- 说「紫微斗数帮助」却回答成科普：说明当次没走工具，改说「调用 ziwei_help」
- 换工作区后 MCP 失效：重新注册一次
- 提示 `HOST_NOT_ALLOWED`：当前不在百度搭子宿主内，按返回的指引打开客户端
- 数据集下载失败：确认能访问 GitHub Release；脚本会自动退回系统 `curl`
- 解读提示未导入：先运行 `npm run data:fetch -- --years <出生年份>`
- AI 对话报未配置：填 `.env.local` 后重启服务
- 生产环境不要用开发模式：先 `npm run build`，再 `npm start`

## 验证状态

| 场景 | 状态 |
|---|---|
| `npm run typecheck` | 已验证 2026-10-29 |
| `npm test`（含 MCP 契约） | 已验证 2026-10-29 |
| `npm run build` | 已验证 2026-10-29 |
| GitHub Actions CI | success |
| 导入 1950 年数据集（8760 盘） | 已验证 2026-10-28 |
| MCP 工具列表与排盘调用 | 已验证 2026-10-29 |
| 非目标宿主返回 `HOST_NOT_ALLOWED` | 已验证 2026-10-29 |
| 严格门禁：`initialize` / `tools/list` 均被拒绝 | 已验证 2026-10-29 |
| 百度搭子宿主正向放行（`dumate`） | 未实测（本机未装百度搭子） |
| `/api/interpret` 与 `/api/heming` 流式输出 | 用本地 mock 模型验证 |
| 真实模型 Key、全量 77 年数据 | 未实测 |

## 免责声明

本指南为第三方部署说明，与上游作者无隶属关系。命理内容仅供参考，重大决定请结合现实情况与专业意见。
