# tools/mock/AGENTS.md

> 假数据与截图脚本的协作规则。fixtures 是唯一数据源；本文件只定「要覆盖哪些状态」，不复制字段清单。

## 1. 定位

| 文件 | 职责 | 消费者 |
|---|---|---|
| `fixtures.mjs` | 唯一假数据源：`summary` / 订阅子集 / `usageFor` / `prefs` | `shots.mjs`、`npm run preview`、人工核对 |
| `shots.mjs` | 用 fixtures 生成 README 定稿图，写 `docs/pic/` | README / README.en |
| `scripts/e2e.mjs` 内联 fixture | 只服务断言，不与 `fixtures.mjs` 共享 | E2E |

- 两边 fixture 不要求同步字段；**但状态集合必须一致**（见 §2）。

## 2. 核心规则：状态穷举

**一个组件有 N 种状态，fixture 就必须有 N 个样本；预览图按状态各出一张，不合并、不省略。**

| 组件 / 页面 | 必须覆盖的状态 |
|---|---|
| `ProgressRing` | `empty` / `normal` / `critical`（含 89.9 与 90 两侧边界） |
| `QuotaGauge` | `normal` / `critical` / `empty`（`percent = null`） |
| P1 · API 态 | 正常（<80）/ warn（80–100）/ over（≥100）/ 预算未设置 / 余额不支持 / 数据陈旧 |
| P1 · 订阅态 | 1 窗 / 2 窗 / 3 窗；某窗缺失；全部缺失（套餐查询失败） |
| P2 浮层 | API 态 / 订阅态（2 窗、3 窗）；刷新失败 / 范围加载失败 / 无 provider / 探测降级 / 窄屏 |
| P3 按量卡 | normal / warn / over（计划余额为负）/ 预算未设置 / 余额不支持 |
| P3 订阅卡 | 1 窗 / 2 窗（无「月」列）/ 3 窗；单窗 critical；窗口存在但无数据 |
| 明细表 | API 行有费用 / 订阅行有估算（`≈` + 金额）/ 订阅行无估算数据（`—`）/ 未定价 |

## 3. 数值与边界

- 阈值两侧都要出现：`79.9 / 80`、`89.9 / 90`、`99.9 / 100`，超支用 `128.6`。
- 币种至少 `CNY` + `USD`；同一页可出现多币种（总费用卡）。
- `balance.status` 至少 `ok` + `unsupported`；`amount` 允许 `null`。
- `windows` 长度覆盖 1–3；`key` 只允许 `5h / week / month`；缺窗**不要**造占位对象。
- `resetAt` 至少一个 `<60min`、一个 `>1440min`；允许 `null` 走 `—`。
- 同一条数据内部必须自洽：`budget.used ≈ monthCost`、`todayCost ≤ monthCost`、`currentProviderId` 必须指向已存在的 provider。
- 趋势序列权重必须**确定性且带起伏**（周末低 / 工作日高 + 尖峰），不能等权分摊：等权会让截图里的柱高齐平成矩形，失去趋势图的意义；同时禁止随机数，否则每次 `npm run shots` 产物都在变。
- 逐日权重归一化时给末点预留份额（末点承接余量），否则前 n-1 项吃满 100% 会把末柱压成 0。

## 4. 命名与产出

- provider id 稳定（`deepseek-official` / `opencode-go` …），状态用后缀表达：`-warn`、`-over`、`-unset`、`-empty`；禁止按日期或序号命名。
- 顶部展示用的「假数据」不得包含真实 Key、真实会话或真实账号余额。
- 定稿图走 `npm run shots`（写 `docs/pic/`）；状态覆盖用 `npm run preview ring` / `cards-sub` / `cards-api` 生成 HTML，在 IDE 里逐态核对（需要 PNG 时加 `--png`），两者都从 fixtures 取数。

## 5. 新增 provider 的最小改动

1. `summary.providers` 一条（含 `kind` / `currency` / `budget` / `balance`）。
2. `windows`（可选，1–3 条，带 `resetAt`）。
3. `usage` 的 `todayCost` / `monthCost` / `tokens` / `requests`。
4. `todayModels` / `monthModels` 各一条，`providerId` 对齐。
5. `pricingLinks` 一条（没有就留空数组）。
6. 若影响状态集合，同步本文件 §2、`docs/checklist/active/board-visual-review-checklist.md` §九 与 `tools/preview/spec.mjs`。

## 6. 禁止

- 为了让页面「好看」而改阈值或伪造已用/预算关系。
- 只加数据不加状态；或只改 `shots.mjs` 而不改 `fixtures.mjs`。
- 把 e2e 内联 fixture 当作预览数据源。