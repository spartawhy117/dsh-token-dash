# Provider 探测链路优化：请求去阻塞、失败降级、选卡归一化与订阅控件抽取

> 状态：已实施<br>
> 完成时间：2026-11-23<br>
> 关联逻辑根：`dsh-token-dash`（`index.js`、`src/adapters.js`、`src/core.js`、`client.js`）<br>
> 关联资料：[`design.md`](../../design.md)（链路 B · 查余额 / 缓存口径）、[`ui-design.md`](../../ui-design.md) §2.5 / §4.4；后续排版对齐见 [`feature_subrow_align.md`](../active/feature_subrow_align.md)

## 一、最终需求与范围

| ID | 最终处置 | 需求 / 边界 / 风险 | 最终结论或迁移去向 |
|---|---|---|---|
| REQ-01 | 完成 | `/summary`、`/usage` 不再同步等待探测 | 改 stale-while-revalidate；日志 `probe=background` / `probeMs=0` 实证生效 |
| REQ-02 | 完成 | 宿主服务调用加超时保护 | `HOST_TIMEOUT=5000`；新 `errorKind=host-timeout` |
| REQ-03 | 完成 | 探测失败不清空旧快照 | 沿用 previous + `_stale`，10s 重试 |
| REQ-04 | 完成 | P2 展开期 usage 自动更新 | `usePolling(loadUsage, min(10s, refreshMs))` |
| REQ-05 | 完成 | `provider.slow` 带最慢源归因 | 新增 `slowest: { id, ms }` |
| REQ-06 | 完成 | 降级状态透出到 UI | `StaleBadge`「数据待更新」角标 |
| REQ-07 | 完成 | P1 切换即时生效 | `load` 改读 `activeRef` + `[active, load]` 即时取数 |
| REQ-08 | 完成 | 面板多 range 取数收敛 | `/usage` 按 range 5s 复用，日志带 `cached` |
| REQ-09 | 完成 | 七处问题同批交付 | 逐条对照 §2.0.4，CHG-01~12 全落地 |
| REQ-10 | 完成 | 选卡三级回退 + 排序同源 | `pick(activeProvider) ?? pick(recentProvider) ?? pick(记账)` |
| BND-01 | 保持 | Provider/VM/UI 分层与快照契约不变 | 仅新增只读字段 `stale` / `activeProviderId` |
| BND-02 | 保持 | 429 复用快照与 Retry-After 退避不动 | 未改动 |
| BND-03 | 保持 | 凭据只经 `ctx.credentials.resolve` | 未改动，日志无新增敏感面 |
| BND-04 | 保持 | P3 看板链路、`document.hidden` 跳过轮询不动 | 未改动 |
| BND-05 | 保持 | 不新增 provider、不拆 per-provider | 源表与探测并发语义不变 |
| BND-06 | 保持 | `currentProviderId` 仍取记账口径 | 新增 `activeProviderId` 承载 UI 选择，两者并存 |
| BND-07 | 保持 | `?active=` 仅作缓存与选卡 | 宿主侧仍不消费，服务端归一化后回显 |
| RSK-01 | 已验证 | 降级快照延长已删 Key 的显示 | TTL 过期消失；角标提示陈旧 |
| RSK-02 | 已验证 | HOST_TIMEOUT 过短误伤慢网络 | 5s 生效后 `provider.slow` 归零 |
| RSK-03 | 已验证 | P2 轮询推高聚合频率 | `vm usage` durationMs 0~1ms，无劣化 |
| RSK-04 | 接受 | 冷启动首轮仍同步阻塞 | 仅首轮，日志 `probe=bootstrap` 可核 |

## 二、最终实现

### 3.0 最终改动总览

| ID | 类型 | 文件 | 开发改动说明 |
|---|---|---|---|
| CHG-01 | 修改 | `index.js` | `refreshProviderCache` 新增 `providerBootstrapped` 标记；新增 `ensureProviderCache()` 三态门卫（fresh / bootstrap / background）；`/summary`、`/usage` 路由改用该门卫，不再同步 await；5s 字面量提取为 `PROBE_MIN_INTERVAL_MS` |
| CHG-02 | 修改 | `src/adapters.js` | 新增 `HOST_TIMEOUT=5000`、`HostTimeoutError`、`withHostTimeout()`；`resolveKey` 与 `deepseek` 的账户调用包超时；`errorDetail` 新增 `host-timeout` 归类 |
| CHG-03 | 修改 | `src/adapters.js` | `readCachedSource` 在 null / 异常且有旧值时沿用 previous 并标 `_stale`；`toSnapshot` 透出只读 `stale` |
| CHG-04 | 修改 | `src/core.js` | `buildSummary` 的 providerInfo 循环剥离 `_stale`，以只读 `stale` 进 VM |
| CHG-05 | 修改 | `src/adapters.js`、`index.js` | `readProviders` 逐源计时，返回值附加 `slowest`；`provider.slow` 日志记录该字段 |
| CHG-06 | 修改 | `client.js` | `Panel` 展开期 usage 轮询；新增 `StaleBadge` 降级角标（P2Summary / P2Windows 共用）与 `styles.staleBadge` |
| CHG-07 | 修改 | `client.js` | `Pill` / `Panel` 选卡改为 `active` 优先、`currentProviderId` 兜底；`Panel` 签名补 `active`；`load` 改读 `activeRef` / `refreshMsRef`，并新增 `[active, load]` 即时取数；收起态轮询上限 30s |
| CHG-08 | 修改 | `index.js` | 新增模块级 `usageCache` / `USAGE_TTL_MS=5000`；`/usage` 命中则复用，日志带 `cached`；`clearProviderCache` 与记账回调联动清理 |
| CHG-09 | 修改 | `client.js` | 面板只拉当前选中 range，不再随挂载批量预取 |
| CHG-10 | 修改 | `index.js` | 模块级 `lastSeenProvider`，由 `/summary?active=` 更新（进程内，不落盘） |
| CHG-11 | 修改 | `index.js`、`src/core.js` | `/summary` 解析 `active` 并透传；`buildSummary` 新增 `activeProvider` / `recentProvider` 参数 |
| CHG-12 | 修改 | `src/core.js` | `buildSummary` 抽出 `pick()` 做归一化 + 存在性校验，三级回退并把 `current` 计算**上移到 sort 之前**；排序基准改用 `current` |
| CHG-14 | 修改 | `src/core.js`、`client.js` | 为修「两个 API 间切换不跟随」追加：VM 新增只读 `activeProviderId`（服务端回显归一化值）；`Pill` / `Panel` 优先消费它 |
| CHG-15 | 修改 | `client.js` | 新增 P0 控件 `SubWindow`（与 `InlineRing` 同级），P1/P2 共用；`WindowRow` 与 `subscriptionNodes` 改为调用它 |
| CHG-16 | 修改 | `client.js` | `PercentValue` 与 `InlineRing` 的 text 分支加 `lineHeight:1; paddingBottom:2`，修环与数字垂直居中；P3 环心标签同源补偿 |
| CHG-17 | 修改 | `client.js` | 移除 P2 标题区 `InfoTip`（ⓘ）及其 `marginInlineEnd: -5`；P2/P3 去掉「剩余 x%」（`WindowRow` / `QuotaCell` / `QuotaGauge`） |
| CHG-13 | 测试 | `test/unit/`、`scripts/e2e.mjs` | 单测覆盖三级回退 / 归一化 / stale 透出 / 宿主超时 / SubWindow 断言；e2e 同步 ⓘ 移除后的反向断言 |

### 2.1 最终结构

取数链路（三段，取代原先「缓存过期即同步等探测」）：

```text
GET /summary · GET /usage
  ├─ ensureProviderCache()
  │    ├─ fresh      → 缓存未过期，直接构建
  │    ├─ bootstrap  → 冷启动首轮，同步等待（唯一阻塞点）
  │    └─ background → 立即返回旧快照 + void 后台探测（单在途去重）
  └─ buildSummary(state, prefs, now, cacheData, activeParam, lastSeenProvider)
       └─ pick() 归一化三级回退：active → recent → 记账 → 首卡
```

选卡与探测解耦：**探测结果只影响数据新鲜度，不再阻塞读接口**。

### 2.2 关键代码骨架

```js
// src/core.js · buildSummary 内的选卡（必须先于 providers.sort）
const pick = (id) => {
  const normalized = normalizeProvider(id)
  if (normalized === 'unknown') return null
  return providers.some((p) => p.id === normalized) ? normalized : null
}
const current = pick(activeProvider) ?? pick(recentProvider) ?? pick(state.currentProvider) ?? providers[0]?.id ?? null
```

### 2.3 关键陷阱

| 项 | 约束 |
|---|---|
| 宿主路由名 ≠ 快照 id | 宿主报 `deepseek-account`，快照是 `deepseek-official`；任何身份比对都必须先过 `normalizeProvider`（Issue #2 的根因） |
| `current` 必须早于 `sort` | `current` 原位于 sort 之后，改排序基准前必须整段上移，否则引用未定义变量 |
| `active` 闭包陷阱 | `load` 若把 `active` 作为依赖，`usePolling` 只依赖 `refreshMs` 不会重排，定时器会一直跑旧闭包；必须读 ref |
| 归一化只影响输出 | 三级回退不写回 `state.currentProvider`、不落盘（BND-06） |
| 降级不得掩盖删除 | 无旧快照时维持 `:none`，只有存在旧值才降级 |
| 诊断先于修改 | 本 feature 前三轮误判均因缺乏可观测证据；`vm build` 补 `active` / `currentProviderId` 后才一步定位 |

### 2.4 最终验收

| 项 | 环境与方式 | 结果 |
|---|---|---|
| L1 `npm test` | 本地 `node --test` | **184 passed / 0 failed**（新增 13 项） |
| L4 `npm run e2e` | Playwright + 临时 DSH_HOME | 通过（UI assertions passed） |
| 语法检查 | `node --check` | 四个宿主文件全部 OK |
| 真机验收 | 桌面端 `2.5.0-local.6` | tencent → deepseek-official → opencode-go → tencent 四次切换全部即时跟随；`provider.slow` 归零；`probeMs=0`；`vm usage` 0~1ms |

> e2e 的 L2 更新检测依赖真实 npm registry，连续运行时受 429 限流影响；该问题与本次改动无关（`git stash` 基线同样失败），已转出记录。

## 三、计划—实际偏差

```text
计划 CHG-01~CHG-13 → 实际追加 CHG-14~CHG-17（原因：真机验收暴露「两个 API 间切换不跟随」「订阅窗口缺公共控件」「环与数字未垂直居中」「ⓘ 与剩余%冗余」四类问题）
计划 选卡读 active 直比 → 实际改为服务端归一化后经 VM 回显 activeProviderId（原因：UI 不应承担 provider 别名知识，直比在路由名不同字时必然落空）
```

## 四、不改动 / 边界（已确认）

- `BND-01`：Provider / VM / UI 分层与快照契约语义不变，仅新增只读字段 `stale`、`activeProviderId`。
- `BND-02`：429 复用快照与 `Retry-After` 退避路径未改动。
- `BND-03`：凭据只经 `ctx.credentials.resolve`，不读凭据文件；日志不记 Key 与响应体。
- `BND-04`：P3 看板取数链路、`document.hidden` 跳过轮询未改动。
- `BND-05`：不新增 provider、不做 per-provider 拆分；探测并发模型（单在途 promise）不变。
- `BND-06`：`currentProviderId` 仍取记账口径；UI 选择由新增的 `activeProviderId` 承载，两者并存互不写回。
- `BND-07`：`?active=` 仅作缓存与选卡输入，服务端归一化后回显；宿主侧仍不消费该参数。

## 五、Issue 记录（已压缩）

### Issue #1 · 切换供应商后 P1/P2 长时间不更新 [已修复]

**关闭口径**：2026-11-23 真机 local.6，`provider.slow` 归零、`probe=background` / `probeMs=0`、`vm usage` 0~1ms。

**根因**：`/summary`、`/usage` 缓存过期时同步 await 全量探测，所有请求排队；宿主调用无超时，最坏 30s。

**图**：见 §2.1 取数链路（三段式）、`tools/preview/drafts/sub-remain-cleanup.html`。

**处理**：CHG-01 / 02 / 03 / 04 / 06 / 08 / 09。

CL：未提交

**遗留**：无。

### Issue #2 · 两个 API provider 之间切换时 P1/P2 不跟随 [已修复]

**关闭口径**：2026-11-23 真机 local.6，`active=deepseek-account` 时 `currentProviderId=deepseek-official`（修复前为 `tencent`）。

**根因**：双层——① `Pill` 的 `load` 闭包捕获旧 `active`，`usePolling` 不重排；② `pick()` 字面比对，路由名与快照 id 不同字则落空。仅 API↔API 命中（`opencode-go` 字面一致故正常）。

**图**：见 §2.2 选卡骨架、`tools/preview/drafts/sub-window-final.png`。

**处理**：CHG-07（ref + 即时取数 + 诊断）、CHG-12（归一化）、CHG-14（VM 回显 `activeProviderId`）。

CL：未提交

**遗留**：新增 provider 时须同步 `normalizeProvider` 别名表。

### Issue #3 · P2 浮层标题区「ⓘ」按钮无实际作用 [已修复]

**关闭口径**：2026-11-23 真机确认 + e2e 反向断言固化（count 必须为 0）。

**根因**：文案停留在 5 家 provider 旧表述，且对已配置用户无操作价值。

**图**：无（纯控件移除）。

**处理**：CHG-17（删除 `InfoTip` 与其负偏移）。

CL：未提交

**遗留**：无。

### Issue #4 · 订阅窗口「剩余 x%」冗余 [已修复]

**关闭口径**：2026-11-23 真机确认；P2 窗口行只留倒计时，P3 卡片环下三行变两行。

**根因**：「剩余 %」与环上「已用 %」互为补数，属重复信息。

**图**：见 `tools/preview/drafts/sub-remain-cleanup.png`。

**处理**：CHG-17（P2 删剩余段、P3 `QuotaCell` 不传 `remaining`、`QuotaGauge` 签名与 aria 清理）。

CL：未提交

**遗留**：无。

### Issue #5 · 订阅窗口缺公共控件，时间对齐随标签长度漂移 [已修复]

**关闭口径**：2026-11-23 真机确认；P1/P2 订阅窗口均由 `SubWindow` 渲染。

**根因**：P2 用 `position:absolute; left:10px; translateX(-50%)` 把倒计时钉在环心，偏移随标签宽度变化；P1 另有一套实现。**澄清**：「边界场景溢出」经实测证伪。

**图**：见 `tools/preview/drafts/sub-window-final.png`。

**处理**：CHG-15（`SubWindow` 公共控件，`showTime` 开关，`ringTestId` 保留测试 id）。

CL：未提交

**遗留**：无。

### Issue #6 · P0 环与数字垂直方向未居中 [已修复]

**关闭口径**：2026-11-23 真机确认；中心偏差由 2.00px 降至 0.50px。

**根因**：字形盒在行盒内偏上（上半为 ascender 空间），`align-items:center` 对齐行盒而非字形。**注**：先按「line-height 过大」修过一次，实测无效被证伪。

**图**：见 `tools/preview/drafts/measure-ring-baseline.png`（五方案实测）。

**处理**：CHG-16（`lineHeight:1; paddingBottom:2`；五方案中仅此达 0.50px）。

CL：未提交

**遗留**：补偿值 2px 与 `font-size:12px` 绑定，改字号须等比复核。

### Issue #7 · P1 窗口点分隔符视觉偏下 [已放弃]

**关闭口径**：2026-11-23 放弃。已实施 U+00B7 → U+30FB 并随 `local.8` 安装，真机仍不平齐。

**根因**：几何中心 0.00px，症结在**整行各元素行盒高度不一致导致的基线错位**，单换符号无法消除。

**图**：见 `tools/preview/drafts/sep-and-label-options.png`。

**处理**：分隔符改为 `' ・ '`（U+30FB）。

CL：未提交

**遗留**：未达成目视平齐，转 [`feature_subrow_align.md`](../active/feature_subrow_align.md)。

### Issue #8 · 周期标签垂直居中观感不一致 [已放弃]

**关闭口径**：2026-11-23 放弃。B+D 方案随 `local.8` 安装后真机仍未平齐。

**根因**：`height:ringSize` 只锁定标签盒子，未解决环与标签在整行内的相对基线。

**图**：见 `tools/preview/drafts/sep-and-label-options.png`（A/B/C/D 四案）。

**处理**：标签改用 `display:inline-flex; align-items:center; lineHeight:1; height:ringSize; top:-0.5px`；P1 pill 行高实测 18.0px 未被撑大。

CL：未提交

**遗留**：**方法论教训**——两轮分别按「字形重心」「行盒高度」假设修改均被真机证伪；未先建立可量化目视判据就动手导致反复。转 `feature_subrow_align.md`，要求先定测量方法。

### Issue #9 · e2e 依赖真实 npm registry，限流时整轮失败 [已放弃]

**关闭口径**：2026-11-23 放弃并转出。不属于显示问题，也偏离本 feature 主题。

**根因**：`GET /update` 在 registry 非 2xx 时返回 502 且无 `data`；e2e 直接取 `.data.published` 抛 TypeError。触发条件是 npm registry 429。

**图**：无。

**处理**：**未实施**，`scripts/e2e.mjs` 未改动。

CL：未提交

**遗留**：已验证与 UI 改动无关（`git stash` 基线同样失败）。去向：由 `feature_subrow_align.md` 测试章节或单独 issue 承载。