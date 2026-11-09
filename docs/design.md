# dsh-token-dash 设计文档

> 更新时间：2026-11-05（v3.5，2.0.0 定稿；已在 DSH 0.2.2-rc.1 验证）<br>
> 面向贡献者的一页式架构说明。需求背景见 [token-dash 计划（已归档）](plan/archived/feature_token_dash.md)，已归档的 UI 迭代见 [UI 迭代计划](plan/archived/feature_ui_refresh.md)；Provider/VM/UI 边界收口见 [边界计划](plan/archived/feature_provider_boundary.md)；UI 视觉以 [UI 设计](ui-design.md) 为唯一真源。

## 总体架构

插件分为两端，随 DSH 宿主进程加载：

```text
┌──────────────────────────── DSH 宿主（Electron / web）────────────────────────────┐
│                                                                                    │
│  host 端（index.js，Node 环境）                client 端（client.js，浏览器环境）   │
│  ┌──────────────────────────────┐             ┌────────────────────────────────┐  │
│  │ 会话事件监听 session/event     │             │ P1 底栏 Pill（两槽位）          │  │
│  │ → collect.ingest 三层归属      │   /summary   │ P2 浮层 / P3 整页              │  │
│  │ → daily.json（本地存储）        │ ──────────→ │ fetch 轮询（refreshMs 可配）    │  │
│  │ readProviders → Snapshot      │ ←────────── │ POST /prefs /log /refresh …    │  │
│  │ buildSummary(state, prefs,    │             └────────────────────────────────┘  │
│  │   now, snapshots) → VM        │                                             │
│  │ providerRegistry（元数据）     │                                             │
│  │ web 路由 /token-dash/api/*    │                                             │
│  └──────────────────────────────┘                                             │
└────────────────────────────────────────────────────────────────────────────────────┘
```

- **host 端**只做数据：采集、归属、聚合、侦测、路由、日志；无 UI。
- **client 端**只做展示：Pill 常驻 + P2 浮层（当前模型）+ P3 整页（全量），无业务计算。
- **provider 边界**：adapter 只输出 `ProviderSnapshot`；VM 只输出 `SummaryVM`；UI 只消费 VM，不知道 provider id / 价格页 URL。
- 两端只通过 `/token-dash/api/*` HTTP 前缀路由通信。

## 数据流

```text
会话事件（assistant/message 的 usage）
  → collect.recordFromEvent 提取 token 四桶
  → 三层归属：message.source（权威）
              → request/header 会话状态（回退）
              → 模型名前缀（最终兜底，视图层）
  → core.addRecord 按 天/provider/model 入账
  → store 持久化 daily.json（2s 防抖 flush，原子写 tmp+rename）

浏览器请求 /summary
  → readProviders(ctx, prefs, cache)（每源成功 60s / 失败 10s + in-flight）
  → toSnapshot（统一 windows/error/quotaError/status/fetchedAt）
  → core.buildSummary(state, prefs, now, snapshots)
       ← providerRegistry（默认模型/币种/前缀/展示名/价格页）
  → SummaryVM（providers / breakdown.models / apiTotals / pricingLinks / version / refreshMs）
  → client 只读 VM
```

`readSubscriptions`（P3「重新检测」）走同一个 snapshot 出口，不请求余额接口。

P3 页头 `★` 是静态链接（`REPO_URL`），点击新窗口打开仓库；不请求 `/repo`，不展示 star 计数。

## 数据备份（P3 导出 / 导入）

```text
GET /export
  → buildExport(state, prefs, now, snapshots)（src/backup.js）
      = { schema, exportedAt, month, prefs, providerKinds, days(当月), usage(四范围派生) }
  → 浏览器下载 dsh-token-dash-YYYY-MM.json

POST /import
  → validateBundle（schema / month / days 形状，整包校验）
  → 备份 prefs.json / daily.json 为 *.import-backup-<ts>
  → prefs 覆盖（经 normalizePrefs）、当月 days 覆盖、providerKinds 合并
  → providerCache 失效，下次请求重新侦测
```

导出只带设置与当月使用数据；订阅窗口 / 余额 / 日志 / 社区价目不进包（可由 API 或启动流程复得）。派生 `usage` 与 P2 时间选择同口径，仅用于阅读，导入时忽略。

包形态固定为单个 JSON 文件，不打包 zip、不拆多个文件：当月体量不足 500KB，压缩收益低于 zip 写入/解压的实现与失败成本，单文件还能靠 `schema` / `month` 做整包校验。

## Provider / VM / UI 边界

```text
ProviderDescriptor（静态，providers.js）
  id / label / currency / subscription / defaultModel
  prefixes / modelLabels / pricingUrl

ProviderSnapshot（adapters.js → VM 的唯一 DTO）
  id / name / kind / currency / status(ok|error|unconfigured)
  balance / windows[] / error / quotaError / fetchedAt

SummaryVM（core.js → client 的唯一 DTO）
  providers[] / breakdown.models[] / today / month
  cost / apiTotals / currentProviderId / pricingLinks[] / version / refreshMs
```

- **Adapters**：只负责外部请求、解析、错误分类；出口用 `toSnapshot` 归一化，不把 `plans` / `_error` 等内部字段带进 VM。
- **VM**：纯聚合，不做 IO；通过 `providerRegistry` 查元数据，不直接 import provider 数据表；输出 `windows` 和 `pricingLinks`。`windows` 长度 0–3，缺窗不补占位对象。
- **UI**：只读 `SummaryVM`；按 `kind` / `status` / `currency` 渲染，不出现 provider id、价格页 URL、默认模型等 provider 知识。
- **页面入口**：P3 走宿主「全局面板」机制——`slots.inject('main')` 注册整页（`key = token-dash`），`sidebar.panellist` 注册同 `id` 的左侧常驻行；`layout` 通过 `inject` 注入，浮层底部「全量看板」与侧栏入口调用 `selectPanel('token-dash')`（点击时再校验 `hasMainPanel`）。
- **P1 槽位**：只挂 `conversation.composer.dock`（输入框底栏右侧，Pill 根节点 `order:10`）；不占用 `conversation.hero.agentPreset`，官方 Agent 模式按钮不被替换。
- **兼容**：VM 可读取旧 `plans` 输入，但输出只保留 `windows`；`DEFAULT_MODELS` 保留为派生导出，供旧调用方过渡。

## Provider 源表（v3.4）

> 当前 7 家：DeepSeek / GLM / Kimi / OpenRouter / Qwen / OpenCode Go / Command Code。前 5 家用 `legacy` 函数保留既有账号钱包、双路径等特例；后 2 家由声明式 `credential + quota + preflight` 驱动。详细能力见 [后端能力清单](checklist/archived/backend-capability-checklist.md) §4。

```text
quota-sources.js
  PROVIDER_SOURCES = [
    { id, kind, currency, legacy? }                       // 既有 5 家
    { id, kind, currency, credential, quota, preflight? } // OpenCode / Command Code
  ]

adapters.readProviders(ctx, prefs, cache)
  → for (源 of 表)
      旧源: legacy(ctx, prefs)
      新源: resolveCredential → preflight?.(query) → fetch(quota.url | fallbackUrl)
  → parse → normalizeWindows（0–3、夹取、缺窗不补）
  → toSnapshot → ProviderSnapshot[]
  → 每源缓存 60s / 10s + in-flight
```

| 约束 | 定义 |
|---|---|
| 源表形状 | `{ id, kind, currency, legacy?, credential?, quota?, preflight? }`；`quota = { url, fallbackUrl?, parse }` |
| 凭据 | 只支持 `bearer` 与 `oauth-reuse`；统一走宿主 `credentials.resolve`，不做 Cookie、不读本机文件 |
| preflight | 取数前可选，返回 query 片段；异常返回空串，主请求继续 |
| 窗口 | 长度 0–3，`key ∈ 5h/week/month`，`usedPercent ∈ [0,100]`，缺窗不补占位 |
| 新增一家 | 源表 1 行 + `parse`（或 legacy reader）+ 1 份 fixture |
| 错误 | `unconfigured` 不算刷新失败；5xx 带 `upstream: true`；`probe.misses` 记录 `none/error/hidden` |

## 路由与鉴权

| 项 | 现状 | 目标 |
|---|---|---|
| 挂载 | 宿主 `webServer.register({ kind:'prefix', path:'/token-dash/api' })` | 不变 |
| 鉴权 | 回环放行；非回环优先 `connection.requestRejection`，无则校验 `remoteAddress + host + origin`，失败 403 | 同现状 |
| 脱敏 | 日志已过滤；错误响应只返回 `reason`，不含上游 body / Key | 保持 |
| 附加路由 | 无 `/repo` | 不新增；仓库入口为静态 `REPO_URL` 链接 |

## 文件目录组织

```text
dsh-token-dash/
├── index.js               host 端入口：服务注册、web 路由、spawn 更新、日志接线
├── client.js              client 端 bundle：Pill / Panel（P2）/ BoardPage（P3）/ 公共组件（ProgressRing / PercentValue / InlineRing / QuotaGauge）
├── src/
│   ├── core.js            纯聚合：buildSummary（VM）、addRecord、月/日键、排序、预算
│   ├── collect.js         会话事件采集：recordFromEvent / headerFromEvent / ingest / backfill
│   ├── adapters.js        供应商侦测（7 家 API/订阅）+ toSnapshot 边界 + 事件日志映射
│   ├── quota-sources.js   声明式 provider 源表、端点与解析（OpenCode / Command Code）
│   ├── providers.js       provider registry：别名/展示名/币种/默认模型/前缀/展示名/价格页
│   ├── pricing.js         价格：内置 catalog + 社区价格表 + OpenRouter 路由价
│   ├── catalog.json       内置模型价格目录（官方价，随包发布，pricing.js 消费）
│   ├── backup.js          导出包构建与导入校验（纯函数，无 IO）
│   ├── store.js           持久化：DSH_HOME 解析、daily/prefs 读写（原子写）、flusher
│   └── diagnostics.js     日志器（JSONL、脱敏、轮转）与日志导出
├── locale/                预留 i18n 词条（zh.json，暂未接线）
├── tools/logs.mjs         常驻日志查看工具（npm run logs）
├── scripts/e2e.mjs        端到端测试（临时 DSH_HOME + web profile + Playwright）
├── test/unit/             L1 单元测试（node --test）
├── docs/                  文档与截图（本目录，纳入 git）
│   ├── design.md          本设计文档
│   ├── release.md         发版流程
│   ├── pic/               README 展示用截图
│   ├── plan/              计划（active / archived）
│   └── checklist/         施工 / 走查 checklist
├── build/                 生成物（npm pack tarball 等），.gitignore 忽略不入库
└── reference/third-party/ 本地调研用的第三方插件源码（.gitignore 忽略）
```

## client.js 组件分层（v3.3）

| 层 | 组件 | 职责 | 不负责 |
|---|---|---|---|
| 几何 | `ProgressRing` | 弧长、描边、尺寸 `{ percent, state, size, stroke }` | 任何文字 |
| 文本 | `PercentValue` | `0.425 → 42.5%`、`null → —`、按状态上色 | 位置与间距 |
| 组合 | `InlineRing` | 环 + 右侧数字（P1 / P2 内联） | 拼词条（`text` 由调用方给） |
| 组合 | `QuotaGauge` | 环心标签 + 环下数字 + 三行辅助（P3 卡片） | 解析数值 |
| 页面 | `Pill` / `Panel` / `BoardPage` | 布局、取数、交互 | 重画弧或格式化百分比 |

- 公共函数：`stateOf(percent, critical)` 判状态、`percentText(percent)` 格式化；三页共用。
- 设计契约与状态矩阵见 [`ui-design.md`](ui-design.md) §2.5 与 [`ring.html`](../tools/preview/templates/ring.html)；实现方案见 [`feature_board_cards_redesign.md`](plan/archived/feature_board_cards_redesign.md)。

## 模块职责速查

| 模块 | 职责 | 不做什么 |
|---|---|---|
| core | VM 聚合、月/日口径、排序、预算计算 | 不做 IO、不读时钟（now 注入）、不直接读 provider 数据表 |
| collect | 事件提取与归属、水位去重、历史回填 | 不落盘（交 store） |
| adapters | 外部接口请求与解析、错误分类、`toSnapshot` | 不做 UI、不做价格匹配、不定义 provider 元数据 |
| providers | descriptor registry、别名/币种/默认模型/前缀/价格页 | 不做 IO、不请求接口 |
| backup | 导出包构建（设置 + 当月使用）、导入包校验与覆盖策略 | 不做 IO、不写盘、不渲染 |
| store | 文件读写与原子性 | 不做业务逻辑 |
| client | 渲染与交互 | 不做业务计算（数字全部来自 VM）、不硬编码 provider |

## 日志体系

- 文件：`$DSH_HOME/logs/dsh-token-dash/`，JSONL 格式；每行同时带 `module` 与 `prefix: "[TD:<module>]"`，前缀仅作阅读 / 导出标记，分类以 `module` 为准；header 的 `dshVersion` 从宿主动态读取（`DSH_VERSION` → asar `package.json` → `unknown`）
- 模块：`boot / slot / pricing / collect / vm / provider / update / diag / route / data`；适配器 `adapter.deepseek / adapter.glm / adapter.kimi / adapter.openrouter / adapter.qwen / adapter.opencode / adapter.commandcode`
- 事件：`adapter.*` 的 `quota.ok / quota.fail / quota.parse / balance.* / credits.ok / detect.fail`；`provider.probe.miss / kind.stamp / subscriptions.refreshed / cache.state`；`route.forbidden / route.failed`
- 错误带分类：`errorKind`（http/timeout/network/parse）+ `httpStatus`；5xx 额外 `upstream: true`
- 脱敏：不记 API Key / orgId / 对话内容 / 响应体；字符串字段与导出内容统一 `redact`

## 关键设计决策（摘要）

1. **严格本月口径**：费用/用量明细与预算均按当月；"配置即可见"兜底（已配置 provider 无消耗时补默认模型行）
2. **三层模型归属**：兼容老数据（无 source 标注的历史记录靠前缀兜底），不迁移 `daily.json`
3. **余额语义**：余额 = 账户真实余额（adapter 查询）；预算维度用「已用 / 计划余额」表达，**不渲染进度条**（v3.0 起）
4. **纯 JS 无构建**：源码即产物——GitHub 安装长期可用；npm 发布时 `files` 字段控制包内容
5. **只读本地数据**（REQ-14）：不统计标题生成、不发起计费请求、凭据经宿主解析不落盘
6. **Provider 边界收口**：现有七家（含 OpenCode Go / Command Code）；adapter 输出 `ProviderSnapshot`，VM 输出 `SummaryVM`，UI 只消费 VM；provider 差异留在 descriptor/adapter，不扩散到 VM/UI
7. **不做 provider 插件系统**：不拆 per-provider 文件、不引入 DI；七家规模用单文件源表 + 三个可选钩子，避免过度抽象
8. **配置面收口**：`prefs` 只保留 `budgets` / `billingModes` / `refreshMs` / `showBalance`（+ `version`）；legacy `budget`、`showMonthTokens`、`logLevel` 只做读取兼容，不参与计算，保存时自然消失；预算未配置时默认 100（provider 币种，不写盘）
9. **整页入口走宿主全局面板**：P3 不再塞进浮层，改用 `main` + `sidebar.panellist` 同 key 注册；浮层只保留当前模型，避免同一套用量组件两处维护（v3.0）
10. **仓库入口是静态链接**：`REPO_URL` 直接新窗口打开，不请求 `/repo`、不展示 star 计数；与用量/预算无关
11. **取数收敛成源表**：provider 元数据、凭据形态与归一化集中到 `quota-sources.js`，`readProviders` 按表迭代；新增家只加表行与解析钩子，`adapters.js` 不再新增 provider if 分支
12. **不做 Cookie / 本机登录态**：百炼 Token Plan、小米 MiMo、Codex `~/.codex/auth.json` 均不接入——凭据会过期或越界读用户目录
13. **升级不迁移数据**：账本与设置在 `$DSH_HOME/dsh-token-dash/`，与 profile 的 `node_modules` 分离，`dsh plugin add` 不触碰；跨机迁移走 P3「导出 / 导入」，导出只含设置与当月使用，不含配额、余额与日志
14. **P3 自持滚动与 4px 间距**：`BoardPage` 外层 `board-scroll` 负责纵向滚动，不改宿主 `main`；间距只用 4 / 8 / 12 / 16 / 24 / 32 六档
15. **DSH 0.2.2 兼容基线**：已在 `0.2.2-rc.1` 验证 `slots / layout / webServer / sessionPersistence / credentials`；不依赖 PTC、tools、agent 路由等 0.2.2 迁移项；DSH 自身要求 Node 24.9，插件元数据仍声明 `>=20`

