# P3 趋势图恢复动态 Y 轴

> 依据 plan：`../../plan/active/feature_trend_yaxis.md`<br>
> P4 CL：基线 `dab665a`（未改代码）<br>
> 状态：待批准（未批准前不改代码）<br>
> 归档去向：完成后移入 `docs/checklist/archived/`

## 阶段总览

| 阶段 | 一句话 | 状态 |
|---|---|---|
| S1 事实勘察 | 定位 Y 轴为何消失、确认 CC Switch 做法 | ✅ |
| S2 方案定稿 | 确定刻度档位、格式、宽度与命中率下限 | 进行中 |
| S3 代码实施 | `client.js` 恢复 Y 轴与网格，`ui-design.md` 同步 | 待办 |
| S4 测试 | L1 单测 + E2E 断言 Y 轴存在且随指标变化 | 待办 |
| S5 本地打包 | `2.3.1-local.1`，pack + 安装到 desktop profile | 待办 |

## 交付事实

| 事实 | 依据 |
|---|---|
| P3 趋势图**曾经有** Y 轴（最大 / 中间两档）与三条网格线 | `git show 9907212:client.js` 第 1051-1055 行渲染 `trendAxis` + `trendGrid` |
| Y 轴与网格线在 `c41b9eb`（悬停虚线提交）中被**删除** | `git show c41b9eb -- client.js` 该 5 行均为 `-` 开头 |
| 样式 `trendAxis` / `trendGrid` 仍在 `styles` 中，但**已无任何渲染点** | `grep -n "styles.trendAxis" client.js` 无结果；样式定义仍在 616-618 行 |
| 柱区左侧仍保留 34px 留白（`trendBars.paddingLeft: 34`），Y 轴删除后该留白**空置** | `client.js` 第 619 / 623 / 665 行 |
| `docs/ui-design.md` §5.5 **仍规定** Y 轴必须画（最大 / 中间两档、11px、占 34px） | `docs/ui-design.md` 第 361 行 |
| 因此当前状态属**实现与设计文档不一致**，不是需求变更 | 上两条对读 |
| CC Switch 用 recharts `<YAxis tickCount={3} width="auto">`，柱状图同样有 Y 轴 | `farion1231/cc-switch` `src/components/usage/UsageTrendChart.tsx` 第 427-435 行 |
| CC Switch 的 Y 轴格式按指标分流：成本走货币、命中率保留一位小数、其余走 compact 单位 | 同上 `formatYTick`（第 340-348 行） |
| CC Switch 命中率轴不从 0 起，下限计算与本项目 `hitRateFloor` 思路一致 | 同上 `hitRateAxisFloor`（第 86-96 行） |
| 本项目不引入图表库（BND 约束），只能手绘 Y 轴 | 归档 plan `feature_p3_usage_trend.md` BND-03 |

## 决策记录

| # | 问题 | 定案 |
|---|---|---|
| Q1 | 恢复几个档位 | 三档：顶部 = 最大值、中部 = 下限 + 半程、底部 = 下限（命中率下限非 0 时才显示底部档） |
| Q2 | 是否照抄 CC Switch 的 `tickCount=3` | 是，但解释为「3 个刻度位置」而非 3 段；与 Q1 等价 |
| Q3 | 是否恢复三条网格线 | 恢复。设计文档 §5.5 明确要求上 / 中 / 下三条，且网格与刻度互为参照 |
| Q4 | 34px 留白是否保留 | 保留。Y 轴无处安放正是因为留白被空置，恢复后自然复用 |
| Q5 | 是否改 `ui-design.md` | 不改规格，只补一句「v3.15 悬停改造误删，v3.17 恢复」的变更注记 |
| Q6 | 版本形态 | 本地构建 `2.3.1-local.1`，不 tag、不发布 |

## 阶段详情

### S1 事实勘察（✅ 已完成）

1. 定位删除点：`c41b9eb` 移除 5 行渲染（3 条网格 + 2 档 Y 轴）。
2. 确认样式残留：`trendAxis` / `trendGrid` 仍在 `styles`，无引用。
3. 确认设计文档仍要求 Y 轴，结论为「实现回退」而非「设计变更」。
4. 查阅 CC Switch 实现作为参照：`recharts YAxis` + `tickCount=3` + `width=auto` + 按指标分流 formatter。

### S2 方案定稿（进行中）

**AI 先行**

1. 出刻度计算方案（见下「技术方案」）。
2. 出渲染结构方案（DOM 层级、z-index、与悬停层的叠放）。
3. 出 E2E 断言方案。

**你收尾**

1. 确认 Q1-Q6 六个决策。
2. 回复暗号：`S2 方案通过，开始 S3`。

### S3 代码实施（待办）

**AI 先行**

1. `client.js` · `TrendChart`：恢复 3 条 `trendGrid` + Y 轴刻度渲染。
2. `client.js` · 新增 `trendAxisTicks(floor, max, metric, currency)` 纯函数，返回 `[{pos, text}]`。
3. `client.js` · `styles`：`trendAxis` 增加 `right: calc(100% - 30px)` 等定位修正（当前 `left: 0` 会与柱区重叠）。
4. `docs/ui-design.md` §5.5：补一行变更注记。

**你收尾**

1. 目检截图，确认刻度不压柱、不与日期刻度重叠。
2. 回复暗号：`S3 目检通过，开始 S4`。

### S4 测试（待办）

**AI 先行**

1. 单测：`trendAxisTicks` 的边界（全零、单点、命中率下限非 0、多币种禁用成本）。
2. E2E：断言 Y 轴存在 3 档；切指标后刻度文本变化；英文 locale 下不含「万 / 亿」。
3. 跑 `npm test` + `npm run e2e`。

**你收尾**

1. 确认测试全绿。
2. 回复暗号：`S4 通过，开始 S5`。

### S5 本地打包（待办）

**AI 先行**

1. 改 `package.json` 为 `2.3.1-local.1`；同步 `scripts/e2e.mjs` 两处版本 fixture。
2. `CHANGELOG.md` 顶部写 `## [2.3.1-local.1]` 块，标题下加「> 本地构建，未发布」。
3. `npm run pack` 生成 tarball。

**你收尾**

1. 授权本地安装（我不自动装）。
2. 回复暗号：`S5 完成`。

## 技术方案（S2 输出）

### 刻度档位

```text
现状（c41b9eb 之前，2 档）              目标（本次，3 档）
┌──────────────────────┐              ┌──────────────────────┐
│ max ─────────────    │              │ max ─────────────    │
│ (网格线)              │              │ mid ─────────────    │
│ mid ─────────────    │              │ floor ───────────    │
│ (网格线)              │              │ (网格线 ×3)           │
└──────────────────────┘              └──────────────────────┘
```

| 档位 | 位置（相对 132px 柱区） | 取值 | 何时显示 |
|---|---|---|---|
| 顶部 | `top: 0` | `max` | 恒显示 |
| 中部 | `top: 50%`（`translateY(-50%)`） | `floor + span / 2` | 恒显示 |
| 底部 | `bottom: 18` | `floor` | 仅当 `floor > 0`（即命中率轴不从 0 起）时显示 |

### 格式分流（复用现有函数，不新增）

| 指标 | 格式化函数 | 示例 |
|---|---|---|
| Tokens | `fmtTrendTokens` | `1.6千万` / `800万` / `1.6M` |
| 费用 | 现有 `fmtMetric` 的 cost 分支 | `¥12.5` |
| 命中率 | `fmtHitTick` | `97.5%` |
| 请求 | `fmtTrendTokens` 的整数路径 | `1,024` |

### 与悬停层的叠放

| 层 | z-index | 说明 |
|---|---|---|
| `trendGrid` / `trendAxis` | 0 | 最低，压在柱体之下 |
| `trendBars` | 1 | 柱体 |
| `trendHoverLine` | 4 | 虚线 |
| `trendHoverDot` | 5 | 柱顶圆点 |
| `trendTip` | 6 | 浮层 |

### 宽度与定位修正（关键）

```text
当前样式 trendAxis: { position:'absolute', left:0 }  ← 会与柱体重叠
修正后:            { position:'absolute', right:'calc(100% - 30px)', textAlign:'right' }
```

理由：柱区左侧 `paddingLeft: 34`，刻度文字需右对齐到 30px 处，右侧留 4px 与柱体分隔。

## 测试 / 走查表

| 用例 | 结果 | 一句话证据 |
|---|---|---|
| Y 轴显示 3 档刻度 | 待办 | — |
| 切指标后刻度文本随之变化 | 待办 | — |
| 全零数据时不显示刻度文字但保留网格 | 待办 | — |
| 命中率指标下限非 0 时显示底部档 | 待办 | — |
| 英文 locale 刻度不含「万 / 亿」 | 待办 | — |
| 刻度不与柱体 / 日期刻度重叠 | 待办 | — |
| `npm test` 全绿 | 待办 | — |
| `npm run e2e` 全绿 | 待办 | — |

## 移交 / 遗留

| 编号 | 一句话内容 | 原因/去向 |
|---|---|---|
| M1 | 本地安装需用户授权 | 仓库规则：本地打包须显式指令；安装同样不自动执行 |
| M2 | P2 浮层无趋势图，无需处理 | 已核实：`client.js` 中趋势图仅 1 处渲染（`token-dash-trend`），第二张截图的「使用趋势 · 当天」+ 00:00–14:00 刻度属 CC Switch 参照图，非本项目界面 |

## 施工提醒

1. Y 轴是**恢复既有设计**，不是新增需求——`ui-design.md` §5.5 一直要求画。
2. `c41b9eb` 删除这 5 行时未同步删样式，也未改设计文档，属于孤立回退。
3. 本项目不引入图表库（BND-03），必须手绘。
4. 34px 留白是既有常量，多处 `calc(34px + ...)` 依赖它，不要改动数值。
5. 命中率下限逻辑已存在于 `hitRateFloor`，直接复用，不重写。

## plan 回写候选

1. `docs/plan/archived/feature_p3_usage_trend.md` 已归档，按规则不追改；如需记录，另立 active plan 或在 `ui-design.md` 变更注记中体现。
2. `docs/ui-design.md` §5.5：补「v3.17 恢复 Y 轴」注记。

## 执行日志 + 踩坑

- 2026-11-19：checklist 创建；S1 已完成勘察，S2 方案已出，等批准。

```text
踩坑 1 · Y 轴被悬停改造顺手删掉且样式残留（2026-11-19 [已定位]）：
- 现象：    P3 趋势图左上有 34px 空留白，没有任何刻度文字。
- 根因：    c41b9eb 重写柱区渲染时删除 3 条网格与 2 档刻度渲染，未删样式、未改设计文档。
- 修复：    待 S3 恢复渲染，并修正 trendAxis 的定位（原 left:0 会压柱）。
- 验证锚点： 柱区左侧出现 3 档右对齐刻度，且不与柱体重叠。
- 沉淀：    删除渲染点时须同步清理样式，或以注释标明「暂时隐藏」。
```
