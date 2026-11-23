# 多账号 / 多订阅展示调研

> 范围：`reference/third-party/` 下 11 个参考仓库 + 本仓 provider / 凭据契约 + npm 下载量取样（2026-11-16 ~ 11-22）<br>
> 结论：**不采纳**。本仓维持「一品牌一账号」，不做同品牌多订阅的并列展示。<br>
> 记录日期：2026-11-23

## 1. 问题

用户可能持有同一品牌的多份订阅（例如两个 OpenCode Go 套餐、两个 GLM 账号）。这在 DSH 里意味着两套凭据、两份额度。要回答的是：

1. 参考库里有没有插件做到「同品牌多账号并列展示」？
2. 它们靠什么实现？
3. 本仓要不要跟进？

## 2. 结论

- 11 个参考仓库中**只有 `dsh-token-usage-lao` 支持**，且仅限 magpie 网关聚合这一条链路；离开网关，它同样是一路由一账号。
- 其余 10 个全部是「一品牌一凭据」（含 `cc-switch`：它确实支持同品牌多账号，但面向 Claude Code / Codex 的配置切换，不是 DSH 的额度展示）。
- 本仓要支持，等于引入一条贯穿各层的「账号维度」：凭据多引用、provider 分桶改键、VM 加字段、UI 分组与池均值。改动面大于收益面。
- 需求本身是长尾：专门做多套餐池化的插件，npm 周下载在 200–400 量级（第 8 节），比头部插件低两到三个数量级。
- **决定：不做。** 本文件仅留档，不作为实施依据。

## 3. 参考库现状

| 仓库 | 账号粒度 | 同品牌第二账号 | 证据 |
|---|---|---|---|
| `dsh-token-usage-lao` | 路由 → 适配器；magpie 网关内可多账号 | **支持**（仅 magpie 链路） | `src/quota/adapters/magpie.ts:194`、`src/client/QuotaButton.tsx:358` |
| `dsh-quota` | 固定 5 个来源，每源一个 `credentialRef` | 不支持 | `index.js:250-292` |
| `dsh-quota-dashboard` | `PROVIDERS` 注册表，一 id 一把 key | 不支持 | `index.js:1009`、`index.js:1446` |
| `dsh-stats-panel` | 扫描 profile patch 的 `providers`，按路由逐条 | 仅「两条路由」效果，无账号概念 | `src/index.ts` 的 `scanProfileProviders` |
| `dsh-ui-usage-billing` | 品牌级归一（`glm`→`zai-coding-cn` 等） | 不支持 | `lib/index.js:114` `normalizePlanProvider` |
| `dsh-cockpit` | 预设 `id` = 路由，`keyEnv` = 单凭据引用 | 不支持 | `src/models-manager.js:52-60` |
| `dsh-spend` | provider/OAuth 记录，单账号 | 不支持 | `lib/providers/oauth-codex.js:77`（`accountId` 为单账号） |
| `dsh-cost-dashboard` | 按模型价格表聚合 | 不支持 | 源码未见账号维度 |
| `dsh-token-usage-leeman` | 按 provider/model 归属聚合 | 不支持 | 源码未见账号维度 |
| `dsh-armory` | 面板机制（`sidebar.panellist`），与额度无关 | 不适用 | — |
| `cc-switch` | OAuth 授权中心，可挂多账号并设默认 | 支持，但属配置切换器 | `docs/guides/claude-official-accounts-guide-zh.md:27`、`docs/release-notes/v3.18.0-zh.md` |

## 4. `dsh-token-usage-lao` 的多账号机制

### 4.1 依赖一个外部网关

插件只认一条 `magpie` 路由，key 在网关那边，插件不存多把 key：

- 路由名：`ROUTE_MAGPIE = 'magpie'`（`src/quota/adapters/magpie.ts:40`），默认 base `http://127.0.0.1:3425/v1`（`:43`）。
- 报表：`GET /v1/magpie/quotas?kept=1`（`magpieQuotaUrl`，`:60`），只读网关最近一次聚合结果，不触发上游刷新。
- 认证：`usesApiKey: false`——回环网关免 key。
- 自定义路由名也能用：注册表匹配不到时由探测器 `GET /v1` 的 `{"name":"magpie"}` 认领（`src/quota/registry.ts:26-52`）。

### 4.2 报表结构：一卡一账号

网关回 `data[]`，每项是一张卡（`provider` / `name` / `kind` / `plan?` / `user?` / `windows[]` / `balance?`）。同一品牌的多个上游账号就是多张卡。插件把它们摊平成 `QuotaWindow`，并加两个字段：

- `card`：这张卡属于哪个账号 —— `QuotaButton.tsx:358` 按它分组，`:376` 每组渲染标题，`:510` 多卡时面板切全宽。
- `pool`：额度池 —— `poolOf()` 取 `${provider}::${name}`（`magpie.ts:194`），同一厂商的多 key / 多账号 / 多套餐共用一个池；不同厂商绝不并池；套餐不参与分池（lite 与 pro 视为同一份预算）。

### 4.3 第二张卡起才有区分后缀

```ts
const multi = (byProvider.get(card.provider) ?? 0) > 1
let label = card.plan !== undefined ? `${card.name} · ${card.plan}` : card.name
if (multi) {
  unnamed = card.user !== undefined ? unnamed : unnamed + 1
  label += ` · ${card.user ?? `#${unnamed}`}`
}
```

单卡时不加后缀；同品牌 ≥2 张卡时追加 `· <user>` 或 `· #N`。

### 4.4 读数按池取均值

顶栏按钮与环读的是池的均值水位，而不是「遇到的第一张卡」（`src/client/quota-format.ts:8-13` 的 POOLING 说明），所以一个账号耗尽不会把整个供应商画红。

### 4.5 它与 DSH 侧的方案 A / B 无关

| DSH 侧做法 | 在 lao 里的表现 |
|---|---|
| 方案 A：配 `opencode-go` + `opencode-go-2` 两条路由 | 按路由键 / baseURL 主机分别匹配，得到两个互不相干的条目，无账号聚合、无 pool。`opencode-go` 适配器只认 `provider === 'opencode-go'`，自定义路由还要求 baseURL 路径含 `/zen/go`（`src/quota/adapters/opencode-go.ts:30,82`），用 `/inference/go/v1` 建的路由根本匹配不上，显示 unsupported |
| 方案 B：两个 profile / 两个实例 | 各跑各的，天然不聚合 |
| 在 lao 里填多把 key | 不支持，配置面没有多 key 列表 |
| **magpie 网关** | 唯一支持路径 |

## 5. 本仓现状：为什么现在不支持

本仓从数据模型上就是品牌级：

| 环节 | 现状 | 位置 |
|---|---|---|
| 品牌归一 | `glm` / `zhipu` / `z.ai` / `zai-coding` 全部折叠成 `zhipu`，`opencode` 折叠成 `opencode-go` | `src/providers.js:6`（`ALIASES`）、`:133`（`normalizeProvider`） |
| 存储分桶 | 记录按 `normalizeProvider(key)` 落到 `providers[providerId]` | `src/store.js:61`、`:250` |
| 凭据引用 | `credential.refs` 是**同一份凭据的候选名**（别名回退，逐个试到第一个能解析的），不是多账号列表；每个品牌最终只解析出一把 key | `src/quota-sources.js:207`、`src/adapters.js` 的 `resolveKey` |

也就是说，第二个同品牌账号进来时会被折叠成同一个桶：额度读数只能显示其中一份（或互相覆盖），没有「这是第几张卡」的表达位。

## 6. 若将来要做：改动面清单（仅记录，未实施）

| 层 | 需要的改动 | 风险 / 代价 |
|---|---|---|
| 凭据 | 一个品牌允许多个 `apiKeyEnv` 引用；解析结果按账号而非品牌返回 | 与宿主 `ctx.credentials` 的「一 ref 一值」契约冲突，需要新的聚合层 |
| 身份 | 拆出「账号键（展示）/ 品牌键（计价、归一）」两层，`ALIASES` 不能再无脑折叠 | 现有记录、历史数据、设置项全部是品牌键，需要迁移或兼容 |
| VM | `QuotaWindow` 增加 `card` 与 `pool` 语义 | 与 §1 的 provider 边界契约（adapter 只出 `ProviderSnapshot`，VM 只出 `SummaryVM`）一起评审 |
| UI | 面板按卡分组、池均值读数、多卡宽度切换 | 浮层 380 宽的既有版式要重排 |
| 数据源 | 无网关时，插件需自己逐个账号查（每家接口的「多账号」并不存在，多数要多次调用同一端点换 key） | 请求量与限流风险，且没有官方支持 |

## 7. 为什么不采纳

1. **收益面窄**：同品牌多订阅是少数用户状态；社区里为此专门写的插件（`dsh-opencode-go-pool`、`dsh-opencode-go-plus`、`dsh-hitchfin`）周下载 200–400，属于长尾。
2. **成本面宽**：上面 5 层全要动，且会碰「adapter → VM → UI」的既有边界，等于一次架构级改动。
3. **有替代路径**：同品牌多订阅的显示，社区答案是「网关聚合」（lao + magpie）；本仓不做宿主侧改造也能满足「两份额度分别看」的朴素需求——用户自己在 DSH 里配两条路由，本仓按路由分别展示即可（虽无账号聚合，但也不误导）。
4. **不做的代价可接受**：只是看不了「第二张卡」，不影响主链路（余额 / 用量 / 订阅估算）。

## 8. 数据取样（npm，近 7 天）

```powershell
Invoke-RestMethod 'https://api.npmjs.org/downloads/point/last-week/<包名>'
```

| 包 | 近 7 天下载 | 与「多订阅 / 账号池」的关系 |
|---|---|---|
| `dsh-connect-workbuddy` | 37,874 | WorkBuddy 多账号池（本类最大） |
| `dsh-providers-hub` | 3,303 | 29 个服务统一账号池 |
| `@m1khal3v/dsh-llm-key-rotation` | 1,172 | 按 provider 多 key 轮换 |
| `dsh-modelscope-pool` | 1,013 | 魔搭多 key |
| `dsh-sensenova-pool` | 951 | 商汤多 key |
| `dsh-opencode-go-pool` | 384 | OpenCode Go 套餐池 |
| `dsh-hitchfin` | 283 | 多服务多账号 failover |
| `dsh-opencode-go-plus` | 234 | OpenCode Go 套餐池 |

参考量级：同期全站头部插件 `dsh-agent-compare` 周下载 202,415、`dsh-mobile-plugin` 158,563。

## 9. 相关文档

- [第三方参考索引](../../reference/README.md)：本文件里的仓库都来自 `reference/third-party/`（本地 clone，不随仓入库）。
- [`shy3130/dsh-quota` 现状档案](shy3130-dsh-quota.md)、[`InvisibleSirius/dsh-quota-dashboard` 现状档案](invisiblesirius-dsh-quota-dashboard.md)、[`2026heshao/dsh-armory` 现状档案](2026heshao-dsh-armory.md)。
- [设计文档](../design.md)：provider 边界与 VM 契约（第 6 节改动面评审的对象）。
