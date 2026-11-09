# 自定义价目与未定价可观测

> 状态：待审批（未授权实施）<br>
> 创建时间：2026-11-09<br>
> 更新时间：2026-11-09（首版：由 tencent 自定义 provider 费用恒为 0 触发）<br>
> 关联逻辑根：`dsh-token-dash`（`src/pricing.js` / `src/core.js` / `src/store.js` / `index.js` / `client.js`）<br>
> 关联资料：[`design.md`](../../design.md) §关键设计决策 8、[`ui-design.md`](../../ui-design.md) §5.6 / §5.7

## 〇、问题事实（已复现，未改代码）

### 0.1 现象

本机 `~/.dsh/dsh-token-dash/daily.json`：

```json
"tencent":{"models":{"deepseek-v4.1-flash-ioa":{
  "input":187201,"cacheRead":8088448,"cacheWrite":0,"output":62808,
  "requests":123,"cost":0,"priced":false}}}
```

token 齐全、`cost:0`、`priced:false`；P3 明细该行渲染「未定价」，两格卡与预算卡均为 ¥0.00。
`~/.dsh/logs/dsh-token-dash/dsh-token-dash-20261109.log` 同期 `[TD:vm] usage` 报 322 万 → 790 万 tokens，
但**全程无 pricing 相关 warn**，问题完全静默。

### 0.2 根因链（两层，第一层不是模型匹配）

| # | 环节 | 代码事实 | 结果 |
|---|---|---|---|
| 1 | `normalizeProvider('tencent')` | [`providers.js`](../../../src/providers.js) `ALIASES` 只含 7 家，未收录的 id 原样透传 | 得到 `tencent`，不报错 |
| 2 | `providerDescriptor` | 返回 `null` | 静默降级 |
| 3 | `providerCurrency` | `?? 'CNY'` | 币种看起来正常，掩盖了未登记 |
| 4 | `exactEntry(provider, model)` | 要求 `entry.provider === provider` **且** model 相等 | 目录无 `provider === 'tencent'` 的行 → `null` |
| 5 | `aliasEntry` / `familyEntry` | 同样限定同 provider | 全部 `null` |
| 6 | `priceFor` 返回 `null` | `addRecord` 记 `priced=false`、`cost+=0` | 费用恒 0 |

实测（`.tmp/probe-price.mjs`，未入库）：

```text
tencent          / deepseek-v4.1-flash-ioa => null
tencent          / deepseek-v4.1-flash      => null   ← 模型名改成一模一样仍是 null
deepseek-official/ deepseek-v4.1-flash      => { input: 1, cacheRead: 0.02, output: 4 }
```

**结论：provider 白名单先把 `tencent` 拦在门外，模型名根本没参与比较。**

### 0.3 社区价目表的两个缺口

拉取 gitee 原始表（223 行）核实：

- 表内**没有 `provider` 字段**，全靠 [`pricing.js`](../../../src/pricing.js) 的 `inferProvider()` 猜（只认 glm / kimi / qwen / deepseek）；
- 结果 **176/223 行被判 `unknown` 并丢弃**，其中包含表内本就存在的 `family: "tencent"` 三行（`hy3` / `hy3-preview` / `hy4`）；
- `deepseek-v4.1-flash-ioa` 在整表（modelId / aliases / aliasPatterns）中**不存在**。

### 0.4 两个连带风险

1. **同族兜底会误配到错误价档**：内置目录 `family: "deepseek"` 粒度过宽，一旦 provider 换成 `deepseek-official`，`deepseek-v4.1-flash-ioa` 会落到 `deepseek-chat`（1.89 / 7.7）并标 `≈`。按本机当日用量估算：真 flash 价 ¥0.69（闲时）～¥1.39（高峰），误配为 **¥5.39**，偏高 4～8 倍。**「能匹配上」比「显示未定价」更危险。**
2. **修好单价也不会自动回填**：`repriceState` 仅在 `state.costVersion !== 3` 时重算，当前已是 3；不 bump 版本，历史 0 成本将永久留存。

## 一、需求与边界

| ID | 优先级 | 需求 / 边界 / 风险 | 成功信号 |
|---|---|---|---|
| REQ-01 | P0 | `prefs` 新增 `priceOverrides`，按 `provider:model` 配置自定义单价 | 保存后该行 `priced=true`、费用非 0 |
| REQ-02 | P0 | 自定义单价优先于「精确 → 别名 → 同族」三级目录匹配 | 命中时 `source='override'`、`approximate=false` |
| REQ-03 | P0 | 单价支持 input / cacheRead / cacheWrite / output 四段 + 币种 | 四段与币种均参与计算 |
| REQ-04 | P0 | P3 设置区提供价目维护入口（新增 / 编辑 / 删除） | 不改 `daily.json` 即可修正费用 |
| REQ-05 | P0 | 未定价可观测：`pricing` 模块打 miss 事件，`vm.build` 带未定价模型 | 日志可还原「哪家哪个模型无价」 |
| REQ-06 | P0 | P3 明细与设置区展示未定价模型清单 | 用户不必翻日志即可发现 |
| REQ-07 | P1 | 价目变更后历史成本可重算 | 提供显式重算路径，不静默改写 |
| BND-01 | 边界 | 不把任意 provider 自动登记进 `providers.js` registry | 不为每家中转加代码分支 |
| BND-02 | 边界 | 不做跨 provider 模型名兜底匹配 | 避免 0.4-1 的误配 |
| BND-03 | 边界 | 不做 provider 插件化 / per-provider 拆文件 | 维持单文件源表 |
| BND-04 | 边界 | 不引入在线价目编辑器外的新依赖 | 零构建、纯 ESM 不变 |
| BND-05 | 边界 | 不改 `daily.json` 既有桶结构 | 只在 prefs 层扩展 |
| RSK-01 | 风险 | 自定义单价填错导致费用严重失真 | 输入校验 + 保存前回显 + 命中来源可见（`override` 标记） |
| RSK-02 | 风险 | 重算把已确认的历史成本覆盖 | 重算只作用于 `priced=false` 的行，已计价行不动 |
| RSK-03 | 风险 | `priceOverrides` 键格式歧义（大小写 / 前缀） | 键统一走 `normalizeProvider` + `normalizeModel` 归一 |
| RSK-04 | 风险 | 导出 / 导入包携带自定义价目造成串机污染 | 明确 `prefs` 是否随导出走，见 §2.4 |

## 二、设计方案

### 2.1 数据形状

`prefs.json` 新增一段（默认空对象，向后兼容）：

```json
{
  "version": 1,
  "budgets": {},
  "billingModes": {},
  "refreshMs": 60000,
  "showBalance": true,
  "priceOverrides": {
    "tencent:deepseek-v4.1-flash-ioa": {
      "input": 1,
      "cacheRead": 0.02,
      "cacheWrite": 0,
      "output": 4,
      "currency": "CNY",
      "note": "腾讯 copilot 转发，按 DeepSeek 官方 flash 价"
    }
  }
}
```

- 键：`${normalizeProvider(provider)}:${normalizeModel(model)}`，写入与读取都归一，避免大小写 / 前缀漂移（RSK-03）；
- 值：四个单价必填（`cacheWrite` 缺省 0），`currency` 只允许 `CNY` / `USD`，`note` 可选；
- 存储位置：`prefs.json`，由 [`store.js`](../../../src/store.js) `loadPrefs` 白名单收编，不写进 `daily.json`。

### 2.2 匹配顺序（`priceFor`）

```text
priceFor(provider, model, ts)
  ├─ 0. overrideEntry  ← 新增，命中即返回 { source: 'override', approximate: false }
  ├─ 1. exactEntry
  ├─ 2. aliasEntry
  └─ 3. familyEntry    ← 保留但加护栏，见 2.3
```

override 放在最前：它表达的是「用户对这条记录的事实声明」，优先于任何目录推测。

### 2.3 family 兜底护栏（RSK 配套）

现状 `family: "deepseek"` 会吞掉所有未知 deepseek 变体。建议：

- 目录条目新增可选 `strictFamily: true`，命中时 `approximate=true` 且**在 UI 显式标 `≈`**（已有）；
- 或更保守：当 `family` 命中的条目与请求模型**版本号段不同**（如请求 `v4.1-*`、命中 `chat`），不再兜底，直接视为未定价。

本条与 REQ 解耦，可独立评估；若不做，至少保证 override 优先于 family，用户可自行覆盖掉误配。

### 2.4 导出 / 导入策略（RSK-04 决策点）

价目是**机器相关配置**（同一 provider 在不同中转价不同），倾向：

- **默认随 `prefs` 导出**，但在 bundle 里单列 `prefs.priceOverrides`，导入时**只补缺失键、不覆盖已存在键**；
- 若判定为纯机器配置，则改为导入时丢弃并提示。

> 该决策需在审批时确认，影响 [`backup.js`](../../../src/backup.js) 的 `buildExport` / `validateBundle` 与导入提示文案。

### 2.5 历史重算（REQ-07）

不 bump 全局 `costVersion`（会连带重算他人已确认数据），改为：

- 新增路由 `POST /token-dash/api/pricing/reprice`，body 携带范围（`all` 或指定 `provider:model`）；
- 只对 `priced === false` 的行按**当日 00:00 价目**重算，已计价行不动（RSK-02）；
- 重算结果写回后记 `[TD:pricing] reprice` 事件（rows / models）；
- 日级聚合无单条时间戳，峰谷只能按 00:00（闲时）代表，结果标注为估算。

### 2.6 未定价可观测（REQ-05 / REQ-06）

- **日志**：`priceFor` miss 时由调用方汇总，`index.js` 在 `vm.build` 前后打
  `[TD:pricing] miss { models: N, sample: [...], providerSources: [...] }`，样本上限 5 条；
- **VM**：`SummaryVM.cost.unpricedModels` 已存在（[`core.js`](../../../src/core.js)），补充字段 `unpriced` 结构化数组（`providerId` / `modelId` / `tokens` / `requests`），供 UI 直接消费；
- **UI**：P3 明细行保留「未定价」；设置区版本行旁增加入口，展示未定价清单并支持「为此行填价」（直接打开 REQ-04 编辑器并预填 provider/model）。

### 2.7 UI 入口（REQ-04）

- 位置：P3「设置与数据管理」胶囊新增一行「价目」，与「日志」行同构（按钮：`自定义价目`）；
- 形式：不做新弹窗框架，复用现有 panel 形态或行内展开；
- 字段：provider（只读，来自未定价清单或手填）、model、input / cacheRead / cacheWrite / output、币种、备注；
- 校验：四个单价为 ≥0 十进制（拒绝负数 / 科学计数法 / 货币符号），与预算输入同规则；
- 保存走既有 `PUT /token-dash/api/prefs`，`normalizePrefs` 增加 `priceOverrides` 白名单收编。

## 三、改动总览

| 文件 | 改动 |
|---|---|
| `src/pricing.js` | 新增 `overrideEntry`；`priceFor` 前置 override；新增 `setPriceOverrides()` 注入；`catalogInfo` 不变 |
| `src/core.js` | `costOf` / `addRecord` 无需改（走 `priceFor`）；`buildSummary` 增结构化 `unpriced`；`repriceState` 拆出「只补未定价行」的路径 |
| `src/store.js` | `DEFAULT_PREFS` 增 `priceOverrides: {}`；`loadPrefs` 白名单收编 + 键归一 |
| `index.js` | `normalizePrefs` 增 `priceOverrides` 校验；启动时注入 override；新增 `POST /pricing/reprice`；`vm.build` 增 miss 统计 |
| `client.js` | P3 设置区新增「价目」行 + 编辑控件；未定价清单展示；`styles` 复用现有胶囊 / 行样式 |
| `locale/zh.json` / `en.json` | 新增词条（价目相关约 12～15 条，中英同步占位符） |
| `src/backup.js` | 按 §2.4 决策调整导出 / 导入 |
| `test/unit/pricing.test.mjs` | override 优先级、键归一、四段单价、与 family 兜底的先后 |
| `test/unit/store.test.mjs` | `priceOverrides` 读取收编与非法值丢弃 |
| `test/unit/core.test.mjs` | `unpriced` 结构化输出、重算只碰 `priced=false` |
| `test/unit/backup.test.mjs` | 按 §2.4 决策断言 |
| `scripts/e2e.mjs` | 设置区「价目」行可见、未定价清单可读、填价后费用非 0 |
| `docs/design.md` | §关键设计决策 8 的 `prefs` 字段清单增 `priceOverrides`；§模块职责补 pricing override 职责 |
| `docs/ui-design.md` | §5.6 / §5.7 补价目行与未定价清单的形态与文案 |
| `CHANGELOG.md` | 对应版本块补新增 / 修改（中英双语） |

### 不改动

- 不把 `tencent` 等自定义 provider 写进 `providers.js` registry（BND-01）；
- 不做跨 provider 模型名兜底（BND-02）；
- 不改 `daily.json` 桶结构与 `costVersion` 语义（BND-05）；
- 不改预算、订阅、余额、日志导出等既有链路。

## 四、施工顺序

1. **S1 数据层**：`store.js` 白名单收编 + 键归一 + 单测（不含 UI，可独立验收）；
2. **S2 匹配层**：`pricing.js` override 前置 + `index.js` 启动注入 + 单测；
3. **S3 可观测**：miss 事件 + `buildSummary` 结构化 `unpriced` + 单测；
4. **S4 重算**：`POST /pricing/reprice`（只补未定价行）+ 单测；
5. **S5 UI**：设置区价目行 + 未定价清单 + locale + e2e；
6. **S6 文档**：`design.md` / `ui-design.md` / `CHANGELOG.md` 同步。

S1～S4 为宿主侧，S5 为客户端侧；S1 完成即可让 §0.1 的 `tencent` 行通过手工写 `prefs.json` 恢复计价，适合先做小步验证。

## 五、验收

- 手工在 `prefs.json` 写入 §2.1 的 override 后，`tencent:deepseek-v4.1-flash-ioa` 的 `priced` 变为 `true`、费用非 0；
- 未登记的 `provider:model` 仍为「未定价」，且日志出现 `[TD:pricing] miss`；
- override 命中时不出现 `≈`（`approximate=false`）；
- 重算只改动 `priced=false` 的行，已计价行历史值不变；
- 非法单价（负数 / 科学计数法 / 非数字）被拒绝且不落盘；
- `npm test` 全绿；涉及 UI 时 `npm run e2e` 通过。

## 六、待确认决策

| # | 决策点 | 选项 |
|---|---|---|
| D-1 | 价目是否随导出包迁移（§2.4） | A 随包但只补缺失键（倾向）／B 不导出 |
| D-2 | family 兜底是否加护栏（§2.3） | A 本轮一并做严格化／B 只保证 override 优先／C 暂不动 |
| D-3 | 重算是否提供「全部重算」而不只是未定价行 | A 只补未定价（倾向，RSK-02）／B 支持全量重算并二次确认 |

## 九、自测反馈台

- 2026-11-09：排查确认根因是 provider 白名单（非模型匹配），社区表 176/223 行因缺 `provider` 字段被丢弃；
- 2026-11-09：确认 `family: "deepseek"` 会误配到 `deepseek-chat`，高估 4～8 倍，故 BND-02 排除跨 provider 兜底；
- 2026-11-09：本文档为排查产出，**未修改任何代码**。
