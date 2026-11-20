# 后端 Provider 覆盖与取数可靠性

> 状态：已实施（2026-11-20 归档：Issue #2 / #3 / #4 / #5 全部 `[已修复]`，真机复核通过；本地包 `2.3.1-local.2`）<br>
> 完成时间：2026-11-05（`1.3.0-local.9`）；2026-11-20 重开<br>
> 关联逻辑根：`dsh-token-dash`（`src/`、`index.js`）<br>
> 关联资料：[`design.md`](../../design.md)（v3.3）、第三方参考 [`shy3130-dsh-quota.md`](../../reference/shy3130-dsh-quota.md) / [`invisiblesirius-dsh-quota-dashboard.md`](../../reference/invisiblesirius-dsh-quota-dashboard.md)、旧能力清单 [`backend-capability-checklist.md`](../../checklist/archived/backend-capability-checklist.md)

## 一、最终需求与范围

| ID | 最终处置 | 需求 / 边界 / 风险 | 最终结论或迁移去向 |
|---|---|---|---|
| REQ-01 | 完成 | 后端覆盖 7 家：现有 5 家 + OpenCode Go + Command Code | registry 与源表均 7 家；无 Key 不伪造数据 |
| REQ-02 | 完成 | 声明式源表 `src/quota-sources.js` | `PROVIDER_SOURCES` 驱动 `readProviders` |
| REQ-03 | 完成 | 凭据两型 `bearer` / `oauth-reuse` | 统一走宿主 `credentials.resolve`，不读环境变量/文件 |
| REQ-04 | 完成 | `preflight` 取 query；失败软返回空串 | Command Code `orgId` |
| REQ-05 | 完成 | 窗口 0–3、key 合法、百分比夹取、缺窗不补 | `normalizeWindows` + 两家 parse |
| REQ-06 | 完成 | 每源成功 60s / 失败 10s + in-flight | adapters 持有 TTL，index 传 Map |
| REQ-07 | 完成 | `unconfigured` 软态；5xx 标 `upstream`；`probe.misses` | 旧行为兼容，日志可诊断 |
| REQ-08 | 完成 | 非回环 `requestRejection` / 回环三重校验 | 回环放行；403 记 `route.forbidden` |
| REQ-09 | 完成 | 错误/响应脱敏 | 错误只返回 reason，不带上游 body / Key |
| REQ-10 | 完成 | OpenCode Go 三窗，404/405 回退 | `opencode.ai/zen/go/v1/usage` → `api/v1/usage` |
| REQ-11 | 完成 | Command Code credits + 两窗 | `command-code` / CNY；preflight `orgId` |
| REQ-12 | 完成 | 7 家解析与缓存测试，不联网 | 单测 78 通过 / 1 跳过 |
| REQ-13 | 完成 | e2e 7 家字段契约 | e2e 通过 |
| REQ-14 | 完成 | 文档同步 | `design.md` §Provider/鉴权/日志、plan §七 |
| REQ-15 | 完成 | 订阅重查覆盖全部订阅源 | GLM / Kimi / OpenCode Go / Command Code；Kimi 不查余额 |
| BND-01 | 保持 | 不改 `/summary` `/usage` `/prefs` 字段 | 前端零改动 |
| BND-02 | 保持 | 不做 Cookie / 本机登录 / 组织用量 / 自定义 URL | 与旧能力清单一致 |
| BND-03 | 保持 | 不引入 provider 插件系统 / DI | 单文件源表 + legacy reader |
| BND-04 | 保持 | 不做 `/repo` / star 计数 | 静态链接 |
| RSK-01 | 已验证 | 新 provider schema 变化 | parse 容错；失败降级 `parse`，不伪造 0 |
| RSK-02 | 已验证 | 源表重构回归 | 前 5 家保留 legacy reader |
| RSK-03 | 已验证 | 7 家并发打上游 | 每源缓存 + in-flight |
| RSK-04 | 已验证 | 安全门误伤 e2e | 回环放行 |

## 二、最终实现

### 3.0 最终改动总览

| ID | 类型 | 文件 | 开发改动说明 |
|---|---|---|---|
| CHG-01 | 新增 | `src/quota-sources.js` | `PROVIDER_SOURCES` 7 行；OpenCode/Command Code 解析、preflight、fallback |
| CHG-02 | 修改 | `src/adapters.js` · `readProviders` / `readSubscriptions` | 按源迭代；缓存 Map；`failures[]`；订阅重查 |
| CHG-03 | 修改 | `src/providers.js` | 注册 `opencode-go` / `command-code` 与别名；pricingLinks 7 家 |
| CHG-04 | 修改 | `index.js` · `providerCache` | Map + 每源 TTL/in-flight；prefs/import/refresh 清缓存 |
| CHG-05 | 修改 | `src/adapters.js` · 错误归一 | 5xx 加 `upstream`；`unconfigured` 软态 |
| CHG-06 | 修改 | `src/adapters.js` · `resolveCredential` | `bearer` / `oauth-reuse` 两型 |
| CHG-07 | 新增 | `src/adapters.js` · `sourceQuery` | preflight 软失败 |
| CHG-08 | 修改 | `index.js` · 路由 | 回环放行；非回环拒绝；`route.forbidden` |
| CHG-09 | 修改 | `index.js` / adapters | 错误只留 reason / 分类，不带 body |
| CHG-10 | 新增 | `src/quota-sources.js` · OpenCode | 三窗容错 + 404/405 回退 |
| CHG-11 | 新增 | `src/quota-sources.js` · Command Code | credits + fiveHour/weekly |
| CHG-12 | 修改 | `tools/mock/fixtures.mjs` | 7 家 fixture 已存在，字段对齐 |
| CHG-13 | 修改 | `test/unit/adapters.test.mjs` 等 | 7 家 registry、解析、缓存、失败映射 |
| CHG-14 | 修改 | `scripts/e2e.mjs` | 7 家 mock 契约保持不变 |
| CHG-15 | 修改 | `docs/design.md` | 7 家源表、缓存、安全、日志模块 |
| CHG-16 | 修改 | `src/diagnostics.js` / adapters / index | `prefix [TD:module]`、`detect.fail`、`route.forbidden`、`cache.state` |

### 2.1 最终结构

```text
quota-sources.js
  PROVIDER_SOURCES = [
    { id, kind, currency, legacy? }                       // 旧 5 家
    { id, kind, currency, credential, quota, preflight? } // OpenCode / Command Code
  ]

adapters.readProviders(ctx, prefs, cache)
  → 旧源 legacy(ctx, prefs)
  → 新源 resolveCredential → preflight? → fetch(url | fallbackUrl)
  → parse → normalizeWindows（0–3、夹取、缺窗不补）
  → toSnapshot → 每源缓存 60s / 10s + in-flight
  → SummaryVM（字段不变）
```

| 节点 | 职责 |
|---|---|
| `PROVIDER_SOURCES` | 端点、凭据引用、preflight、parse |
| `readProviders` | 迭代、隔离失败、`misses[]` / `failures[]` |
| `providerCache` | 每源 `{at, ok, data, promise}`；index 传入 |
| `readSubscriptions` | 绕过缓存，只刷新订阅源 |
| `toSnapshot` | 统一 `ProviderSnapshot` |

### 2.2 关键决策与陷阱

| 项 | 最终结论 |
|---|---|
| 源表形态 | 旧 5 家 `legacy` reader，新 2 家声明式；避免一次重写 DeepSeek 钱包 / Kimi 双路径 |
| Command Code | id `command-code`、币种 CNY，与 UI fixture 一致 |
| OpenCode | USD；404/405 才回落 |
| 缓存位置 | adapters 内按源读写，index 仅持有 Map；整包缓存无法按源失效 |
| Kimi 订阅重查 | 只查 Coding 配额；失败回落 API 时不请求 moonshot 余额 |
| 安全门 | 回环放行；非回环先 `requestRejection`，再三重校验 |
| 日志 | 每行 `prefix [TD:module]`；源级异常 `detect.fail`；新 provider 模块 `adapter.opencode/commandcode` |
| 真机边界 | OpenCode / Command Code 未用真实 Key 验证，解析按已知 schema 容错 |

### 2.3 反馈收口

| Issue | 结论 |
|---|---|
| #1 日志覆盖与前缀分类 | 已补 `prefix`、`failures[] detect.fail`、`route.forbidden`、`cache.state`、模块清单；单测覆盖 |

### 2.4 重开改动总览（Issue #2 / #3 / #4 / #5）

> 2026-11-20 重开：首次真机 Key 验证 OpenCode Go，暴露凭据名不兼容与窗口字段漂移；同轮追加订阅卡宽度缺陷。下表为落点与实施结果（均已落地，单测 145 通过、`npm run e2e` UI assertions passed）。

| ID | 类型 | 文件 | 开发改动说明 | 归属 |
|---|---|---|---|---|
| CHG-17 | 修改 | `src/quota-sources.js` · opencode-go `credential` | refs 增补 `OPENCODE_API_KEY` 并前置，旧名 `OPENCODE_GO_API_KEY` 保留兜底 | #2 |
| CHG-18 | 修改 | `src/adapters.js` · `readProviders` / `logAdapterFailures` | 声明式源缺凭据并入 `failures`，日志带尝试过的 ref 名；`:none` 契约不变 | #2 |
| CHG-19 | 修改 | `src/quota-sources.js` · `parseOpenCodeUsage` / `parseWindow` | `5h` 候选名补 `rolling`；重置时间补 `resetsAt` 且接受 ISO 字符串 | #3 |
| CHG-20 | 修改 | `test/unit/adapters.test.mjs` | 新增 `rolling` 三窗夹具、双名凭据命中、缺凭据 `failures` 断言 | #2 / #3 |
| CHG-21 | 修改 | `README.md`、`docs/design.md` | 凭据名改双名、OpenCode Go 三窗字段与实测 schema 说明 | #2 / #3 |
| CHG-22 | 修改 | `tools/preview/templates/_base.css` · `.grid.sub` | 订阅网格由 auto-fit 改为 flex + `max-width: var(--card-max)`，与 `.grid.api` 对齐 | #4 |
| CHG-23 | 修改 | `client.js` · `styles.quotaCards` / `styles.quotaCard` | 同步为 flex + `maxWidth: 260`，去掉无上限的 auto-fit 网格 | #4 |
| CHG-24 | 修改 | `tools/preview/spec.mjs`、`tools/preview/templates/cards-sub.html` | 原型补 1 / 2 / 3 家情形；`maxCard` 与 `cardWidth` 的适用范围写清（`docs/pic/panel-sub-*.png` 是 P2 面板截图，与本项无关，不动） | #4 |
| CHG-25 | 修改 | `docs/ui-design.md` §5.4 | 校正为「与按量卡同一 flex + 260 上限」，删掉与原型冲突的表述 | #4 |
| CHG-26 | 修改 | `scripts/e2e.mjs` | 补订阅卡宽度上限断言（单家卡宽 ≤ 260）+ 两套网格「无横向滚动」断言 | #4 / #5 |
| CHG-27 | 修改 | `client.js` · `styles.cardCaption` | 说明行允许换行并 `overflowWrap: anywhere`，长文案不再撑宽卡片 | #5 |
| CHG-28 | 修改 | `client.js` · `styles.apiCard` / `styles.quotaCard` | 加 `gridTemplateColumns: 'minmax(0, 1fr)'`，卡片列宽不再按 max-content 撑破 | #5 |

> **构建与安装**：2026-11-20 出本地包 `build/dsh-token-dash-2.3.1-local.1.tgz`（版本 `2.3.1-local.1`，CHANGELOG 顶部已记 local 块），已以 `file:` 依赖装入 `desktop` profile；单测 144 通过 / 1 跳过（本地构建跳过 Release notes 用例）/ 0 失败，e2e UI assertions passed。未打 tag、未发布，npm latest 仍为 `2.3.1`。
## 三、不改动 / 边界

- 不改 `/summary` / `/usage` / `/prefs` 契约；前端无需改动。
- 不做 Cookie / 本机登录 / 组织用量 / 自定义 URL / `/repo`。
- 不引入 provider 插件系统或构建链；`client.js` 仍是唯一产物。
- 不改 UI 布局、颜色、间距。

## 四、最终验收

| 项 | 方式 | 结果 |
|---|---|---|
| 7 家 registry / pricingLinks | 单测 | 通过 |
| OpenCode / Command Code 解析 | fixture 单测 | 通过 |
| 缓存复用 / in-flight | 单测调用计数 | 通过 |
| 源级失败日志映射 | 单测 | 通过 |
| 日志前缀 / JSON 完整性 | 单测 + 本机日志 | 通过；local.9 段落 100% 带前缀 |
| e2e 7 家 UI | `npm run e2e` | 通过 |
| 单测 | `npm test` | 78 通过 / 1 跳过 / 0 失败 |
| plan 校验 | `validate_plan.py` | 0 error / 1 warning（Issue 24 行，软目标） |
| 安装 | desktop profile | `1.3.0-local.9` |

## 五、计划—实际偏差

```text
计划 全量声明式源表 → 实际 旧 5 家 legacy + 新 2 家声明式（原因：DeepSeek 钱包 / Kimi 双路径特例）
计划 缓存由 index 整包管理 → 实际 adapters 按源管理、index 传入 Map（原因：整包无法按源失效）
计划 订阅重查只保留 subscription → 实际 GLM/Kimi 保留 API 回落（原因：兼容既有行为）
计划 真机验证 OpenCode/Command Code → 实际仅 fixture 验证（原因：暂无真实 Key；保留待验证）
补充 2026-11-20：OpenCode Go 真机验证已执行，暴露凭据名不兼容与 5h 窗口字段漂移（Issue #2 / #3）；同轮发现订阅卡单家铺满（Issue #4）；Command Code 仍待验证
```

## 六、关联资料

- 设计：[`design.md`](../../design.md) v3.3
- 第三方：[`shy3130-dsh-quota.md`](../../reference/shy3130-dsh-quota.md)、[`invisiblesirius-dsh-quota-dashboard.md`](../../reference/invisiblesirius-dsh-quota-dashboard.md)
- 旧能力清单：[`backend-capability-checklist.md`](../../checklist/archived/backend-capability-checklist.md)

## 七、Issue 记录（压缩）

> 关闭口径统一为：用户真机复核｜dsh-token-dash 自查修复｜验证：2026-11-20 / Windows + DSH 0.2.2-rc.5 / `npm test` 144 通过 + `npm run e2e` UI assertions passed + 真机日志 `[TD:adapter.opencode] quota.ok windows: 3`｜TAPD 不适用

### Issue #2 [已修复] 2026-11-20 OpenCode Go 凭据名与 pi-ai 生态不一致

> 关闭口径：用户真机复核｜dsh-token-dash 自查修复｜验证：2026-11-20 / Windows + DSH 0.2.2-rc.5 / 真机日志出现 `adapter.opencode quota.ok` 且不再报该源缺凭据｜TAPD 不适用

**根因**：`<ROUTE>_API_KEY` 派生规则只适用于自定义 route。pi-ai 对 `opencode` 与 `opencode-go` 两个内置 route 都固定读 `OPENCODE_API_KEY`，且 Zen 与 Zen Go 共享同一把 Key；插件却按 route id 派生出 `OPENCODE_GO_API_KEY`，同一把 Key 要填两个名字。次要根因：`readProviders` 的 `:none` 只表示「该源返回 null」，不区分原因也不记录尝试过的 ref 名，失败无法归因。引入点：`1.3.0-local.9` 接入时仅有 fixture 验证、无真机 Key。

```text
【起点】用户按 pi-ai 约定保存 OPENCODE_API_KEY —— 目的：opencode-go 路由可用（LLM 请求正常）
【★问题根源】PROVIDER_SOURCES · opencode-go 条目的 credential.refs 硬编码为 ['OPENCODE_GO_API_KEY']；resolveCredential 逐个 resolve，全落空即返回 undefined
【触发】readDeclarativeSource 拿到 undefined → 直接 return null → 该源不产出 ProviderSnapshot → readProviders 记 misses `opencode-go:none`
【对比】同源 zhipu / moonshot / qwen 均声明 2–3 个 refs 别名，同一 Key 可兜底命中；opencode-go 与 command-code 是唯二单名源
【补足】daily.json 已有 opencode-go 用量行 → buildSummary · accumulate 用 providerEmpty 补卡，windows 默认 [] → client.js 空窗分支渲染「套餐查询失败」
【修复】refs 增补 OPENCODE_API_KEY 并前置；缺凭据时补一条 detect.fail 并带上尝试过的 ref 名
```

**处理**：`src/quota-sources.js` · `PROVIDER_SOURCES` 的 opencode-go `credential.refs` 改为 `['OPENCODE_API_KEY', 'OPENCODE_GO_API_KEY']`；`src/adapters.js` · `readProviders` 在声明式源缺凭据时把 `{ kind: 'missing-credential', refs }` 并入 `failures`，`logAdapterFailures` 把 `refs` 写进日志。不变边界：`:none` 字符串契约、`summary.providers` 的「无 Key 不出卡」规则、缓存 TTL 均未动。
CL：N/A（git 仓，未提交）

**遗留**：`missing-credential` 每轮探测都会记一条，未走 `missSignature` 去重，缺 Key 的 provider 会造成日志刷屏（本轮已知回归，待补去重）。

### Issue #3 [已修复] 2026-11-20 OpenCode Go 仅解析出 2 窗，5h 窗口字段漂移未识别

> 关闭口径：用户真机复核｜dsh-token-dash 自查修复｜验证：2026-11-20 / Windows + DSH 0.2.2-rc.5 / 真机日志 `quota.ok windows: 3` + 单测三窗用例通过｜TAPD 不适用

**根因**：接口字段由文档假设的 `fiveHour` 族改为 `rolling`，解析器候选表未跟进（RSK-01 的实际命中）；同时 `parseWindow` 的重置时间只认 `resetAt` / `reset_time` 一族并强制 `Number()`，而接口给的是 `resetsAt` 的 ISO 字符串，键名与形态双双不匹配。引入点：`1.3.0-local.9` 按已知 schema 容错实现，夹具也照抄了 `fiveHour`，因此从未暴露。

```text
【起点】真机响应 usage.rolling / weekly / monthly，每窗含 status、percent、resetsAt
【★问题根源】parseOpenCodeUsage 的 5h 候选名表为 ['fiveHour','five_hour','fiveHourWindow','5h']，不含 rolling → collectFromMap 对该窗全部落空
【触发】该窗解析为 null → 不入 windows → normalizeWindows 只剩 week / month
【对比】weekly / monthly 键名恰好与候选表一致，能正常出窗——说明取数与归一链路本身通，差异只在键名
【次级】parseWindow 的重置时间只认 resetAt / reset_at / resetTime / reset_time / nextResetTime / next_reset_time 且强制 Number()；接口给的是 resetsAt（ISO 字符串），键名与形态双双不匹配
【修复】5h 候选表补 rolling；重置时间补 resetsAt 键并接受 ISO 字符串
```

**处理**：`src/quota-sources.js` · `parseOpenCodeUsage` 的 `5h` 候选名补 `rolling`；`parseWindow` 补 `resetsAt` / `resets_at` 键并按「字符串走 `Date.parse`、其余走 `Number`」解析。`test/unit/adapters.test.mjs` 新增真机 schema 三窗用例，并保留一例旧 `fiveHour` 夹具做兼容回归。不变边界：百分比夹取、缺窗不补、`normalizeWindows` 的 3 窗上限、窗口 key `5h` 均未动。
CL：N/A（git 仓，未提交）

**遗留**：`rolling` 是否恒为 5 小时窗口依赖接口语义；若接口改换滚动口径，标签需重新评估。

### Issue #4 [已修复] 2026-11-20 P3 订阅卡只有一家时铺满整段

> 关闭口径：用户真机复核｜dsh-token-dash 自查修复｜验证：2026-11-20 / Windows + DSH 0.2.2-rc.5 / `npm run e2e` 新增卡宽 ≤ 260 断言通过 + 原型渲染实测 1 家 260 / 2–3 家 260 / 4 家 229｜TAPD 不适用

**根因**：`.grid.sub` 用 `repeat(auto-fit, minmax(220px, 1fr))`，单卡时只生成一条 `1fr` 轨道必然铺满；而 `--card-max: 260` 只被按量卡的 `.grid.api .cell` 引用，订阅网格从未引用它——`spec.mjs` 中 `maxCard` 的注释「避免 3 家时被拉成 309」，3 家订阅恰恰就是 309。文档侧另有冲突：`ui-design.md` §5.4 把订阅卡写成 `flex: 1 1 220` / `max-width: 260`，那实际是 §5.3 按量卡的规则，按「组件形态以原型为准」应以原型为准。

```text
【起点】QuotaTable 按 provider 渲染卡片；容器 quotaCards 是 grid，列模板 repeat(auto-fit, minmax(220px, 1fr))
【★问题根源】auto-fit 在只有 1 张卡时只生成 1 条轨道，轨道取 1fr 的上界即占满整段；quotaCard 未设 max-width，卡片随之被拉满
【触发】订阅源只配置 1 家 → providers.length === 1 → 单轨道铺满 → 卡内 windows 再用 repeat(N, minmax(0,1fr)) 等分这块超宽区域 → 相邻环被推到两端
【对比】同页按量卡 .grid.api .cell 带 max-width: var(--card-max)，无论几家都不会超过 260——证明「封顶」本就是既有规则，只是订阅网格漏了引用
【修复】订阅网格改为 flex + max-width 260，与按量卡同源；1 家 260、2–3 家各 260、4 家 229，末行居中
```

**处理**：`tools/preview/templates/_base.css` · `.grid.sub` 改为 flex-wrap + `.cell` 加 `flex: 1 1 var(--card-min)` / `max-width: var(--card-max)`；`client.js` · `styles.quotaCards` 改 flex 换行居中、`styles.quotaCard` 加 `flex: 1 1 220px` / `maxWidth: 260`；`cards-sub.html` 补 1 / 2 / 3 家场景；`spec.mjs` 与 `ui-design.md` §5.3 / §5.4 口径同步。备选方案「卡宽 = 窗数 × 单窗宽」已评估否决：1–2 窗会被卡头约 200px 的下限托住而宽度接近，且多供应商时卡宽参差。不变边界：窗列等分、「N 窗」说明行、失败态展示口径均未动。
CL：N/A（git 仓，未提交）

**遗留**：无。家数增长时靠换行承载，7–8 家实测 2 行 × 4 张、横向溢出 0px（见 #5）。

### Issue #5 [已修复] 2026-11-20 API 卡长说明行撑破卡片，看板出现横向溢出

> 关闭口径：自查发现（#4 新增断言触发）｜dsh-token-dash 自查修复｜验证：2026-11-20 / Windows + DSH 0.2.2-rc.5 / e2e「两套网格无横向滚动」断言通过 + 截图确认说明行折为两行｜TAPD 不适用

**根因**：`styles.cardCaption` 的 `whiteSpace: 'nowrap'` 遇上 `styles.apiCard` 隐式单列 `auto` 网格——该列 min-content 由最宽子元素决定，长说明行把列撑到 296px（卡宽 229、内容宽 197），子元素整体右移溢出。引入点：说明行在加入周期 / 限流 / 渠道用量三项后变长，而卡片宽度规则未变。

```text
【起点】BudgetTable 用 flex + wrap 排卡，卡宽 flex 1 1 220px、maxWidth 260、minWidth 220 → 4 家时每卡 229
【★问题根源①】apiCard 是 display: grid 且只有隐式单列 auto；该列的 min-content 由最宽的子元素决定，宽内容会把列撑到 296 而非卡宽的 197 内容宽
【★问题根源②】说明行沿用 cardCaption 的 whiteSpace: nowrap；Ollama 叠加周期 / 限流 / 渠道后文本约 296px，正好成为那个 min-content
【触发】任一 provider 出现较长说明文案（多字段叠加或本地化后更长）→ 卡内列变宽 → 子元素整体右移 → 溢出卡片与看板
【对比】其余三张卡文案短，min-content 小于内容宽，列被正常约束，因此长期看不出问题
【修复】说明行改为 whiteSpace: normal + overflowWrap: anywhere；apiCard / quotaCard 的列模板固定为 minmax(0, 1fr)
```

**处理**：`client.js` · `styles.cardCaption` 允许换行并按任意位置断行；`styles.apiCard` / `styles.quotaCard` 加 `gridTemplateColumns: 'minmax(0, 1fr)'`。`scripts/e2e.mjs` 新增两套网格 `scrollWidth <= clientWidth + 1` 断言——正是这条断言在修复前抓到 1036 > 952。不变边界：卡片宽度规则与上限不动，只解决卡内内容溢出；说明行选择换行而非截断，因为承载的是周期 / 限流 / 渠道三项关键信息。
CL：N/A（git 仓，未提交）

**遗留**：窄屏（< 480px）下说明行会占更多行高，卡片高度随文案增加；如需固定高度需另定折叠策略。
