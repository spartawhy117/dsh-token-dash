# Ollama Cloud 余额与用量接入

> 状态：已实施<br>
> 完成时间：2026-11-10（随 `2.1.0` 正式发布）<br>
> 关联逻辑根：`dsh-token-dash`（`src/`、`index.js`、`client.js`）<br>
> 关联资料：[`design.md`](../../design.md)（§Provider 源表 / §第三方接入与扩展边界）、[`ui-design.md`](../../ui-design.md)（§5.3）、[`README.md`](../../../README.md)（支持的 API 范围）、[`feature_third_party_provider_pricing.md`](feature_third_party_provider_pricing.md)

## 一、最终需求与范围

| ID | 最终处置 | 需求 / 边界 / 风险 | 最终结论或迁移去向 |
|---|---|---|---|
| REQ-01 | 完成 | 解析 `included` 二态 + `purchased` + `period` | 真实余额 = 套餐剩余 + 购买余额；P3 另列「套餐已用」「购买余额」与周期 |
| REQ-02 | 完成 | 形态 `api`、币种 USD；声明式源 `mode` 由 `kind` 派生 | `providerKinds.ollama` 只会落 `api`，不会被固化成订阅 |
| REQ-03 | 完成 | 币种不匹配即未定价，三处计价入口一致（含 override） | `quote.mismatch` → `priced=false`、`reason=currency-mismatch` |
| REQ-04 | 完成 | `/api/usage?range=30d` 只读展示 | 进 P3 caption，不回写 `daily.json` |
| REQ-05 | 完成 | 失败降级 `401` / `403` / `429` / `503` | `401`→未配置；`429`→旧快照 + `Retry-After` 退避；其余→错误 |
| REQ-06 | 完成 | 计价语义变化后历史一致 | `costVersion 4` 重算一次；订阅与零消耗行保持原状态 |
| BND-01 | 保持 | Ollama 不做订阅隔离 | `kind` 恒为 `api`，按 token × 单价 |
| BND-02 | 保持 | 不读 Cookie、不抓控制台 | 仅官方 Bearer 接口 |
| BND-03 | 保持 | 计价链只加「币种不匹配」一条 | `catalog` / `match` / `selectTable` 未改 |
| BND-04 | 保持 | 不新增设置项、不新增 prefs 键 | 设置区仍三行 |
| BND-05 | 保持 | 其余 7 家 adapter 声明与解析零改动 | 回归通过 |
| RSK-01 | 已缓解 | 10 rpm 跨 key / 设备共享 | 源级 60s 缓存 + `max(10s, Retry-After)` |
| RSK-02 | 接受 | 未定价看起来像能力倒退 | tooltip 说明原因；文档已同步 |
| RSK-03 | 已验证 | 误以为 Ollama 模型全部未定价 | 路由表命中按 USD 计价，仅回退社区表时未定价 |
| RSK-04 | 接受 | 升 `costVersion` 会重算历史金额 | CHANGELOG 与 Release 已明示 |

## 二、最终实现

### 3.0 最终改动总览

| ID | 类型 | 文件 | 开发改动说明 |
|---|---|---|---|
| CHG-01 | 修改 | `src/quota-sources.js` · `parseOllamaBalance` / `parseOllamaUsage` | 二态 + `purchased` + `periodEnd`；usage 只取 `totals`；源表增 `ollama`（api / USD / bearer / `usage` 钩子） |
| CHG-02 | 修改 | `src/adapters.js` · `requestJson` / `readDeclarativeSource` / `readCachedSource` / `toSnapshot` / `logAdapterEvents` | 读 `Retry-After`；`mode` 由 `kind` 派生；429 复用快照并写 `until`；透出 `channel` / `rateLimited`；增 `adapter.ollama` 日志；导出 `missSignature` |
| CHG-03 | 修改 | `src/providers.js` | 增 `ollama` descriptor（USD / 非订阅 / 无默认模型）、别名与展示顺序 |
| CHG-04 | 修改 | `src/pricing.js` · `resolvePrice` | 两个出口写只读 `mismatch`；选表与匹配不变 |
| CHG-05 | 修改 | `src/core.js` · `addRecord` / `repriceUnpriced` / `repriceState` | `mismatch` 判未定价；`repriceState` 增 `kindOf`、保留 `'empty'`；`costVersion` 4 |
| CHG-06 | 修改 | `src/store.js` | `COST_MODEL_VERSION` 3 → 4 |
| CHG-07 | 修改 | `index.js` · `repriceState` 调用 / `refreshProviderCache` | 传 `kindOf`；`cache.state` 改「清单变化才记」 |
| CHG-08 | 修改 | `client.js` · `BudgetTable` / `apiCardCaption` / `REASON_TEXT` | P3 增套餐已用与购买余额行；caption 补周期 / 限流 / 渠道用量；mismatch 文案 |
| CHG-09 | 修改 | `locale/zh.json` · `locale/en.json` | 新增词条副本同步 |
| CHG-10 | 修改 | `tools/preview/templates/cards-api.html` | 原型补额度行与说明行 |
| CHG-11 | 测试 | `test/unit/{quota-sources,adapters,pricing,core,providers,providers-vm}.test.mjs` · `scripts/e2e.mjs` | 解析 / 429 / 401·403·503 / mismatch / 重算不变量 / 8 家契约；e2e 断言卡片 |
| CHG-12 | 文档 | `docs/design.md` · `docs/ui-design.md` · `README.md` · `README.en.md` · `CHANGELOG.md` | 8 家源表与 `usage`、`session` 窗口、币种不匹配、API 范围表与 route 约束、`2.1.0` 变更 |

### 2.1 最终结构

```text
client ──/summary──▶ index（5s 探测门槛）
                      └─▶ readProviders（每源 60s / 10s 缓存，429 按 Retry-After 退避）
                            ├─ credential.resolve(OLLAMA_API_KEY)
                            ├─ GET ollama.com/api/balance           → included 二态 + purchased + period
                            ├─ GET ollama.com/api/usage?range=30d   → totals（只读）
                            └─ parse → toSnapshot（balance / channel / rateLimited）
                      └─▶ buildSummary（账本 + 快照；金额全部来自 daily.json）

写入期：addRecord / repriceState / repriceUnpriced
  形态 → resolvePrice（override → router → community）
       → mismatch ? 未定价（currency-mismatch） : cost += Σ(tok × price) / 1e6
```

| 节点 / 字段 | 职责 |
|---|---|
| `balance.amount` | `included.balance_usd + purchased.balance_usd`，单值「真实余额」 |
| `balance.allowance` / `used` | 套餐总额与已用，供 P3「套餐已用」 |
| `balance.purchased` / `periodEnd` | 「购买余额」行与「周期至」 |
| `windows[]` | 旧套餐 `session` / `week` 百分比（仅解析，不渲染） |
| `channel` | 渠道 30 天用量（只读） |

### 2.2 关键决策与陷阱

| 项 | 最终结论 |
|---|---|
| 计价形态（决策） | 按量 `api` + USD，不做订阅隔离 |
| 余额口径（决策） | `amount` = 套餐剩余 + 购买余额；进度另用 `allowance` / `used` |
| 币种判定（决策） | `quote.mismatch` 只读字段，判定留 core；否决给 core 三函数加 `currencyOf` 参数 |
| 历史成本（决策） | 升 `costVersion 4` 重算一次，订阅与零消耗行保持 |
| 用量（决策） | `/api/usage?range=30d` 只读展示，不回写账本 |
| `mode` 派生 | 声明式源 `mode` 必须由 `kind` 派生，否则固化成订阅、`cost=0` |
| `credential.type` | 必须写 `bearer`；缺失等于无凭据，源被静默跳过 |
| `included` 二态 | 先判 `session !== undefined`；两态都缺 → `error`，不伪造 0 |
| 429 保旧值 | 复用上一份快照并写 `until` 缓存，否则闪成「查询失败」 |
| override 币种 | 未写 `currency` 时默认 CNY，USD provider 会因此判未定价 |
| 重算边界 | `repriceState` 必须传 `kindOf`，否则订阅行被写金额并压掉两态 |
| 宿主 route | DSH 无内置 Ollama，route id 必须为 `ollama`（Key 派生 `OLLAMA_API_KEY`） |
| 旧套餐窗口 | `session/weekly` 不映射 `5h`，API 形态卡不渲染 |

### 2.3 反馈收口

| 记录 | 结论 |
|---|---|
| 声明式源 `mode` 硬编码 | 由 `kind` 派生；`providerKinds.ollama` 只会是 `api`，单测覆盖 |
| 429 无法保留旧值 | `_rateLimited` + 复用快照 + `max(10s, Retry-After)` 缓存 |
| 计价语义变化漏版本 | `costVersion 4` + `repriceState(state, kindOf)` |
| 未配 Key 的源在日志不可见 | `provider.cache.state` 改为「清单变化即记」，含 `configured` / `misses` |

## 三、不改动 / 边界

- 不改 `catalog` / `match` / `selectTable` 的匹配与选表；不改其余 7 家 adapter 声明与解析。
- 不读 Cookie、不抓供应商控制台、不新增 prefs 键与设置项。
- 旧套餐 `windows` 只解析不渲染；`session` 不猜测为 `5h`。
- 已否决 Mistral：Admin API 仅 Enterprise、消费级无公开接口，后续开放 personal usage API 再单开 feature。

## 四、最终验收

| 项 | 来源 | 环境与方式 | 结果 |
|---|---|---|---|
| 金额态 `72.5 / 100 / 25` → 真实余额 `$97.50`、套餐已用 `$27.50 / $100.00`、购买余额 `$25.00` | REQ-01 | 本地 L1 单测 + L2 e2e（注入 SummaryVM） | 通过 |
| 旧态 `session/weekly` → 两个 `usedPercent`，`amount` 取 `purchased` | REQ-01 | L1 单测 | 通过（不渲染） |
| `period.until` → caption「周期至 …」 | REQ-01 | L2 e2e 文案断言 | 通过 |
| `kind=api`、USD、`providerKinds.ollama` 不被固化为订阅 | REQ-02 / BND-01 | L1 `stampProviderKinds` | 通过 |
| CNY 报价 + USD provider → 未定价；路由表命中仍按 USD 计价 | REQ-03 / RSK-03 | L1（两种命中分别断言） | 通过 |
| `openrouter` / `qwen` 国际站同步修正；override 缺 `currency` 判未定价 | REQ-03 / BND-05 | L1 回归 | 通过 |
| `costVersion` 升 4；重算后订阅行 `cost=0`、零消耗行 `'empty'` | REQ-06 | L1（混合账本） | 通过 |
| `/api/usage` 只读，失败不影响余额与 `cost` | REQ-04 | L1 | 通过 |
| `429` 保旧值 + `rateLimited`；`401`→未配置；`403 / 503`→错误 | REQ-05 / RSK-01 | L1 mock（含 `Retry-After` 头） | 通过 |
| 8 家契约（`pricingLinks` / `misses`）与现有 7 家零回归 | 质量门槛 | `npm test` 117 项 + `npm run e2e` | 通过 |
| 真实 `OLLAMA_API_KEY` 手测（真实金额 / 周期 / 限流表现） | REQ-01 / REQ-05 | 需真实凭据 | 未执行：由用户自行验证，未伪造通过结论 |

## 五、计划—实际重大偏差

```text
计划 给 core 三函数加 currencyOf 参数 → 实际 用 quote.mismatch 只读字段（原因：避免改 5 处签名与全部单测）
计划 旧套餐 windows 接入 UI → 实际 只解析并记日志（原因：API 形态卡不渲染 windows，线上以金额态为主）
计划 未涵盖宿主接入前提 → 实际 新增「自定义 route 必须为 ollama」约束（原因：本机核查 DSH 无内置 Ollama）
```

## 六、诊断锚点

- LogCategory：`adapter.ollama`、`provider`、`boot`；前缀 `[TD:module]`
- 高价值日志：`adapter.ollama.quota.ok/fail`（`amount` / `purchased` / `legacy` / `retryAfter`）、`adapter.ollama.usage`、`provider.cache.state`（清单变化才记）、`probe.miss` 的 `ollama:none`
