# package.json#description 与插件市场实际能力不一致

> 状态：待归档<br>
> 创建时间：2026-11-19<br>
> 更新时间：2026-11-19<br>
> 关联逻辑根：`dsh-token-dash`（仓库根 `package.json`）<br>
> 关联资料：`docs/release.md`

## 〇、前置依赖 / 代码探查事实

### 已明确

- 本仓 `package.json#description` 当前为「DeepSeek Harness Token 看板：月度预算与订阅配额、账户余额、时间范围费用与真实 Tokens 明细，支持本地 JSON 导出 / 导入备份。」，自 `1.0.x` 起未改动过（来源：`git log -p -- package.json`，description 仅出现在首次提交）。
- 同一文案在 `v2.3.0` tag 内仍存在（来源：`git show v2.3.0:package.json`），即 npm registry `dsh-token-dash@2.3.0` 对外发布的也是这版旧文案（来源：registry.npmjs.org/dsh-token-dash）。
- DSH 插件管理器的 `pluginInventory.list` / `pluginManager.listBundles` 返回的是 **manifest descriptions**（来源：DSH `0.2.2-rc.5` 内 `packages/boot/plugin-manager/src/index.ts` 中 `pluginManager/listBundles` 的 schema 说明）。
- 官方市场「已安装」卡片的数据链为：Host `listBundles` → `packageView()` 透出 `bundle.description` → 卡片直接渲染，**不读取市场索引 description**（来源：DSH `0.2.2-rc.5` 客户端 `@deepseek-ai/dsh-client-ui-plugin-market` 的 `InstalledStore.read()` 与 `packageView()`）。
- 市场「发现」页走另一条链：`parseMarketIndex` → `plugin()` 中的 `optional(object, "description", …)`，即索引 JSON 声明的 description（来源：同上 `parseMarketIndex` 实现）。
- Awesome DSH Plugin 索引（`dsh-plugin-catalog@2026.1118.23310` 的 `index.json` / `plugins.json`，jsDelivr 线上同版）里 `dsh-token-dash` 的 `description.zh` 已是新版卖点文案，但长度为 159 字符并以 `可导出 /…` 截断（来源：`plugins.json` 与线上 `index.json` 对读）。
- 本地实测：`~/.dsh/profiles/desktop/node_modules/dsh-token-dash/package.json` 的 description 仍为旧文案，与「已安装」卡片显示完全一致（来源：本机文件读取，2026-11-19）。

### 待对齐

- 无。

## 一、需求

| ID | 优先级 | 需求 / 边界 / 风险 | 成功信号 |
|---|---|---|---|
| REQ-01 | P0 | `package.json#description` 改写为与当前产品能力一致的卖点文案（覆盖多供应商预算、订阅配额、账户余额、Pill / 浮层 / 整页三处展示、缓存命中率、未定价模型不按 0 元计、本地 JSON 备份） | 源发新版后，`npm view dsh-token-dash description` 与「已安装」卡片显示新文案 |
| REQ-02 | P1 | 该文案作为**发版前固定检查项**写入发布流程文档，避免再次遗忘 | 发布技能 / `docs/release.md` 的检查清单中出现 description 核对项 |
| REQ-03 | P1 | 发布前核对三处一致：npm metadata、市场索引 `description`、本地已装包 `package.json` | 核验记录可复现 |
| BND-01 | 边界 | 不改动插件运行时代码（`index.js` / `client.js` / `src/` / `locale/`），不改版本号，不打包、不发布 | `git diff` 仅触及 `package.json`、文档与发布技能文档 |
| RSK-01 | 风险 | 文案过长在「已安装」卡片单行处被截断，反而降低可读性 | 首句在约 40 个中文字符内即构成完整卖点 |

## 二、设计方案

### 2.1 结构：描述字段的取值来源

```text
现状
  package.json#description ──(npm publish)──► registry metadata ──┐
                                                                  ├─► 「已安装」卡片（manifest）
  已装包 package.json ──(listBundles)─────────────────────────────┘
  市场索引 index.json description ──(parseMarketIndex)──► 「发现」页卡片

目标
  发布前 description 三处同源核对：仓库 package.json（唯一维护源）→ registry → 目录索引
```

读法：唯一可维护的源头是仓库 `package.json#description`；市场索引文案由第三方目录自行抓取，不在本仓控制范围内，只能作为核对对象。

### 2.2 关键字段

| 层 | 名称 | 备注 |
|---|---|---|
| npm manifest | `package.json#description` | 字符串；同时被 npm 页面与 DSH 「已安装」卡片消费 |
| 发布流程 | 发布前检查清单 | 位置见 `docs/release.md` 与发布技能 SKILL |

### 2.4 关键陷阱

| 项 | 约束 |
|---|---|
| 只改本地不发布 | 已装包读的是已发布 manifest，改仓库不影响任何卡片 |
| 把市场索引当成可维护源 | 索引由 awesome-dsh-plugin 自动生成、自动发布、不接受 PR，且摘要按字节截断 |
| 发版后才改 description | 已安装用户不会自动看到，需随版本重新安装生效；因此必须在发版前定稿 |

## 三、实现要点

### 3.0 开发改动总览

| ID | 类型 | 文件 | 开发改动说明 |
|---|---|---|---|
| CHG-01 | 修改 | `package.json` | `description` 换为与 2.3.0 实际能力一致的文案；不动其它字段 |
| CHG-02 | 修改 | `docs/release.md` | 发布前检查清单新增「description 与产品能力一致性核对」项 |
| CHG-03 | 修改 | `.agents/skills/dsh-token-dash-release/SKILL.md` | 同上，写入技能流程，保证每次发版必查 |

### 3.1 改动清单

#### CHG-01 · `package.json`

- `description`：替换为覆盖多供应商预算 / 订阅配额 / 余额 / Pill + 浮层 + 整页 / 缓存命中率 / 未定价模型 / JSON 备份的新文案。

```diff
- "description": "DeepSeek Harness Token 看板：月度预算与订阅配额、账户余额、时间范围费用与真实 Tokens 明细，支持本地 JSON 导出 / 导入备份。",
+ "description": "DeepSeek Harness Token 与费用看板：按供应商查看预算、订阅配额（GLM / Kimi Coding）与账户余额；Pill、浮层、整页三处展示费用与真实 Tokens、缓存命中率与用量趋势；未定价模型不按 0 元计，可导出 / 导入本地 JSON 备份。",
```

#### CHG-02 / CHG-03 · 发布流程文档

- 在发布前检查清单增加一项：`package.json#description` 是否仍准确描述当前版本能力；发布后核对 npm 与本地已装包两处文案一致。

## 四、不改动 / 边界

- `BND-01`：不改插件运行时代码、不改版本号、不打包、不发布、不推 tag。
- 市场索引 `description`（第三方目录）不在本仓维护范围内，仅作为核对对象。

## 五、验收要点

| 项 | 来源 | 验证方式 | 结果 |
|---|---|---|---|
| description 已更新且为合法 JSON | REQ-01 / BND-01 | `node -e "require('./package.json')"` + 读取字段 | 已通过（2026-11-19，JSON 可解析，字段为新文案） |
| 发布前检查项已写入流程文档 | REQ-02 | 读取 `docs/release.md` 与发布技能 SKILL | 已通过（2026-11-19，release.md 3b 步、SKILL 正式发布第 3 步） |
| 首句在单行卡片内不被截断 | RSK-01 | 人工判读首句长度 | 已通过（首句「DeepSeek Harness Token 与费用看板：按供应商查看预算…」在单行内独立成义） |
| 发版后三处文案一致 | REQ-03 | `npm view dsh-token-dash description` + 本地已装包 `package.json` | 已通过（2.3.1，2026-11-19：npm description 含 4 家订阅；本地 npm 装包一致） |

## 九、自测反馈台

- 2026-11-19 复查发现：初版文案把订阅范围写成「GLM / Kimi Coding」，漏了 OpenCode Go 与 Command Code（`src/quota-sources.js` 中 `kind: subscription` 共 4 家），也与本仓 README「8 家供应商的订阅窗口」不一致。已按方案 A 补全为 4 家。
- 2026-11-19 用户观察：市场「已安装」页 `dsh-token-dash` 卡片描述与产品实况不符，误判为「市场没刷新」。根因见 §〇：卡片读的是已发布 manifest 的 description，而该字段自 1.0.x 未更新。状态：[已修复]（随 `2.3.1` 发布，npm description 已含 4 家订阅供应商）。
