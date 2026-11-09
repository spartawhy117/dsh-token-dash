# Provider / VM / UI 边界收口（PATCH 重构）

> 状态：已实施<br>
> 完成时间：2026-11-02<br>
> 关联逻辑根：`dsh-token-dash`<br>
> 关联资料：[施工 checklist（已归档）](../../checklist/archived/provider-boundary-build-checklist.md)、[主计划（已归档）](../archived/feature_token_dash.md)

## 一、最终需求与范围

| ID | 最终处置 | 需求 / 边界 / 风险 | 最终结论或迁移去向 |
|---|---|---|---|
| REQ-01 | 完成 | provider 元数据收口到单一 registry | `src/providers.js` 输出 descriptor；VM 只调 registry API，不再直接读表 |
| REQ-02 | 完成 | VM 输出 `pricingLinks`，UI 不再硬编码 | `client.js` 无 `LINKS`；P3 用 `summary.pricingLinks`；五家顺序不变 |
| REQ-03 | 完成 | adapter→VM 统一 `ProviderSnapshot` | `toSnapshot` 归一化；VM/UI 只用 `windows` / `error` / `quotaError` |
| REQ-04 | 完成 | 行为与显示不变 | L1 53/53 + E2E pass；1.0.6 发布 |
| BND-01 | 保持 | 不扩 provider、不做第三方插件、不拆 per-provider 文件 | 单文件 registry；五家函数保留 |
| BND-02 | 保持 | 不改 pricing 算法、存储格式、UI 视觉 | 相关文件与测试未动 |
| RSK-01 | 已验证 | `plans`→`windows` 漏改风险 | 合约测试 + E2E 订阅卡断言通过 |
| RSK-02 | 已验证 | registry 化后默认模型 / 归属变化 | `core.test` 的 #15/#16/#20 用例通过 |

## 二、最终实现

### 3.0 最终改动总览

| ID | 类型 | 文件 | 开发改动说明 |
|---|---|---|---|
| CHG-01 | 修改 | `src/providers.js` | `PROVIDERS` 改为 descriptor 表；新增 `providerDescriptor` / `defaultModelFor` / `pricingLinks`；`providerLabel` / `providerCurrency` / `providerFromModel` / `modelLabel` 全部查 descriptor；`DEFAULT_MODELS` 保留为派生导出 |
| CHG-02 | 修改 | `src/core.js` | 删除对 provider 数据表的直接 import，改用 `defaultModelFor` / `providerLabel` / `modelLabel` / `providerFromModel`；`buildSummary` 输出 `pricingLinks`，provider 读 `windows`（仅兼容读 `info.plans` 输入），`plans` 不再进入 VM |
| CHG-03 | 修改 | `src/adapters.js` | 新增 `toSnapshot(entry)`：`plans`→`windows`、`_error`→`error`、`_quotaError`→`quotaError`，补 `status` / `fetchedAt`；`readProviders` / `readSubscriptions` 在出口统一 snapshot；`logAdapterEvents` 改读 snapshot 字段 |
| CHG-04 | 修改 | `client.js` | 删除顶部 `LINKS`；P3 价格链接改读 `summary.pricingLinks`（空数组不渲染）；P1 订阅节点与订阅卡改读 `provider.windows` |
| CHG-05 | 修改 | `test/unit/*.test.mjs`、`scripts/e2e.mjs` | 新增 registry descriptor / `toSnapshot` / `pricingLinks` 用例；E2E mock 改 `windows` + `pricingLinks`；旧 `plans` 兼容用例保留 |

### 2.1 最终结构

```text
[adapters: deepseek/glm/kimi/openrouter/qwen]
        │  统一 ProviderSnapshot
        ▼
[ProviderSnapshot]  id/kind/currency/status/balance/windows/error/quotaError/fetchedAt
        │
        ▼
[buildSummary(state, prefs, now, snapshots)] ◄── [providerRegistry descriptor]
        │  聚合/预算/费用/占比/补行
        ▼
[SummaryVM]  providers/breakdown/today/month/cost/apiTotals/pricingLinks
        │
        ▼
[client.js]  只读 VM；按 kind/status/currency 渲染，不知道 provider id
```

### 2.2 关键接口（最小契约）

| 层 | 名称 | 最终契约 |
|---|---|---|
| registry | `providerDescriptor(raw)` | `{ id, label, currency, subscription, defaultModel, prefixes, modelLabels, pricingUrl }`；未知返回 `null` |
| registry | `defaultModelFor` / `providerFromModel` / `modelLabel` / `providerLabel` / `pricingLinks` | VM/UI 只调这些 API，不读表；`pricingLinks()` 固定五家顺序 |
| adapter | `toSnapshot(entry)` | `{ id, name, kind, currency, status, balance, windows, error, quotaError, fetchedAt }`；`status: ok\|error\|unconfigured` |
| VM | `buildSummary(state, prefs, now, snapshots)` | 输出 `pricingLinks`；provider 用 `windows`；`plans` 仅作输入兼容 |
| UI | `summary.pricingLinks` / `provider.windows` | 空数组不渲染价格行；空窗口显示“套餐查询失败” |

### 2.3 关键陷阱

| 项 | 约束 |
|---|---|
| `plans`→`windows` | 输入可兼容 `info.plans`，输出只允许 `windows`；E2E mock 同步 |
| `pricingLinks` | 五家全列、不按已配置过滤；顺序按 registry |
| `status` | `error` 优先；balance `unconfigured` 保留；`_error` 不得泄漏到 VM |
| 默认模型 | `defaultModelFor` 与旧 `DEFAULT_MODELS` 同值；OpenRouter `-` 语义不变 |
| 模型展示名 | 合并五家 `modelLabels`；未命中回退 `normalizeModel` |

## 三、不改动 / 边界

- 不新增 provider、不做第三方插件系统、不拆 per-provider 文件。
- 不改 `src/pricing.js` 算法、`src/store.js` 存储格式、UI 视觉与预算/费用口径。
- 不回填 `feature_token_dash` 的历史结论；本计划独立收口。

## 四、最终验收

| 项 | 来源 | 环境与方式 | 结果 |
|---|---|---|---|
| registry 元数据与旧表同值 | REQ-01 | `npm test`：providers 3 组（label/currency/defaultModel/prefix/pricingUrl） | ✅ 53/53 pass（2026-11-02 复跑） |
| VM `pricingLinks` / UI 无 `LINKS` | REQ-02 | `grep LINKS client.js` 为空；E2E P3 链接数 5 | ✅ |
| snapshot 边界 | REQ-03 | `toSnapshot` 单测：windows/error/quotaError/status；无 `_error` / `plans` | ✅ |
| 行为回归 | REQ-04 | `npm test` + `npm run e2e` | ✅ 53/53 + E2E pass |
| 发布 | — | tag `v1.0.6`；npm latest 1.0.6；Release body = CHANGELOG；asset 已上传 | ✅ 2026-11-02 |

> 运行时说明（归档时）：桌面 profile 仍为 1.0.5（当时日志仅见 1.0.3→1.0.5 启动），1.0.6 由 L1/E2E 与发布链路核验；桌面 1.0.6 走查未执行，后续 UI 问题记入 `feature_token_dash` §九（#23-#26）。

## 五、诊断锚点

- LogCategory：`TokenDash`
- 前缀：`[TD:<module>]`（`vm` / `adapter.*` / `provider` / `route`）
- 高价值日志：`[TD:vm] build providers=N api=N subscription=N`；`[TD:adapter.glm] quota.ok windows=N` / `quota.fail`；`[TD:route] GET /summary 200 <ms>`
