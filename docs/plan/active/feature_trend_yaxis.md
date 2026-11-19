# P3 趋势图 Y 轴恢复

> 状态：待归档（已随 `2.3.1` 正式发布，2026-11-19）<br>
> 创建时间：2026-11-19<br>
> 关联逻辑根：`dsh-token-dash`（`client.js`）<br>
> 关联资料：`docs/ui-design.md` §5.5、`docs/checklist/archived/trend-chart-yaxis-build-checklist.md`（已归档）

## 〇、前置依赖 / 代码探查事实

### 已明确

- P3 趋势图原先有 Y 轴（最大 / 中间两档）与三条网格线，实现在 `9907212` 的 `client.js` 第 1051-1055 行（来源：`git show 9907212:client.js`）。
- 上述 5 行在 `c41b9eb`「趋势柱悬停虚线指示线与即时浮层」中被删除，该提交未删样式、未改设计文档（来源：`git show c41b9eb -- client.js` 全为 `-` 行）。
- 样式 `trendAxis` / `trendGrid` 仍保留在 `styles`（`client.js` 第 617-618 行），但已无渲染点（来源：`grep -n "styles.trendAxis" client.js` 无结果）。
- 柱区左侧仍保留 34px 留白，Y 轴删除后该留白空置（来源：`trendBars.paddingLeft: 34`、`trendTicks.left: 34`、`trendMsg.inset` 均仍为 34）。
- `docs/ui-design.md` 第 361 行仍规定 Y 轴必须绘制：两档、11px、占 34px、按指标分流格式。
- 结论：当前为**实现回退**，非需求变更。
- 本项目不引入图表库（归档 plan BND-03），Y 轴须手绘。
- `client.js` 中趋势图仅一处渲染点（`data-testid: token-dash-trend`），P2 浮层无趋势图（来源：全局 grep）。

### 待对齐

- 无。

## 一、需求

| ID | 优先级 | 需求 / 边界 / 风险 | 成功信号 |
|---|---|---|---|
| REQ-01 | P0 | P3 趋势图恢复 Y 轴刻度，随指标与数据动态变化 | 柱区左侧出现 3 档刻度，数值随范围与指标改变 |
| REQ-02 | P0 | 恢复上 / 中 / 下三条网格线 | 柱区内可见 3 条 1px 横线，与刻度对齐 |
| REQ-03 | P1 | 刻度格式按指标分流：Tokens 万/亿、费用带币种、命中率百分比、请求整数 | 切换四个指标时刻度文本正确变化 |
| REQ-04 | P1 | 命中率轴下限非 0 时显示底部档 | 命中率指标下出现 `floor` 档刻度 |
| REQ-05 | P1 | 刻度不压柱、不与日期刻度重叠 | 目检 + E2E 位置断言通过 |
| BND-01 | 边界 | 不引入图表库，`dependencies` 保持为空 | `package.json#dependencies` 不变 |
| BND-02 | 边界 | 不改柱区 132px 高、18px 日期刻度行、34px 轴宽、柱宽上限 36px | 既有 E2E 尺寸断言不变 |
| BND-03 | 边界 | 不改 `/usage` DTO、采集层、导出结构 | `src/` 无改动 |
| RSK-01 | 风险 | 刻度文字过长（如 `1.6千万`）溢出 34px 留白 | 目检确认最长刻度不越界；必要时缩到 30px 宽度 |

## 二、设计方案

### 2.1 结构：刻度取值与渲染层级

```text
现状（c41b9eb 之后）                目标
┌────────────────────────┐        ┌────────────────────────┐
│ [34px 空留白] ┃ 柱 ┃柱┃柱│        │ 1.6千万 ─────────────── │
│              ┃    ┃  ┃  │        │ 800万  ─────────────── │
│              ┃    ┃  ┃  │        │ 0      ─────────────── │
│  10-31  11-04  11-08     │        │  10-31  11-04  11-08     │
└────────────────────────┘        └────────────────────────┘
     无刻度、无网格                      3 档刻度 + 3 条网格
```

读法：34px 留白本来就是给 Y 轴的，恢复后自然复用；网格线横向贯穿柱区，刻度右对齐在留白内。

### 2.2 关键字段

| 层 | 名称 | 备注 |
|---|---|---|
| 纯函数 | `trendAxisTicks({ floor, max, metric, currency })` | 返回 `[{ pos: 'top'\|'mid'\|'bottom', text }]`，便于单测 |
| 样式 | `styles.trendAxis` | 由 `left: 0` 改为右对齐到留白右缘，修正原定位缺陷 |
| 样式 | `styles.trendGrid` | 复用既有定义，不改 |

### 2.4 关键陷阱

| 项 | 约束 |
|---|---|
| 原 `trendAxis` 样式为 `left: 0` | 直接恢复会压在柱体上，必须改为右对齐 |
| 刻度与网格需对齐 | 三条网格线的 `top` / `50%` / `bottom: 18` 必须与三档刻度的纵向位置一一对应 |
| 全零数据 | 保留网格与高度，但不显示刻度文字（避免 `0 0 0`） |
| 多币种禁用成本 | 该指标本就不画柱，刻度同样不画 |

## 三、实现要点

### 3.0 开发改动总览（计划）

| ID | 类型 | 文件 | 开发改动说明 |
|---|---|---|---|
| CHG-01 | 已落地 | `client.js` · `trendAxisTicks` | 纯函数产出 2-3 档刻度（`floor > 0` 时补底部档）；单测 5 例 |
| CHG-02 | 已落地 | `client.js` · `TrendChart` | 恢复 3 条 `trendGrid` + 三档刻度渲染，带 `data-testid=token-dash-trend-axis-*` |
| CHG-03 | 已落地 | `client.js` · `styles.trendAxis` + `axisPad` | 右对齐到 `axisPad`，轴宽按最长刻度估算（中文 11px/字、其余 6.2px/字，下限 28px）；柱区 / 日期刻度 / 悬停层 / 空态同步跟随 |
| CHG-04 | 已落地 | `test/unit/trend-axis.test.mjs` | 7 例：两档/三档、全零、max<floor、非数值、渲染点存在、axisPad 生效 |
| CHG-05 | 已落地 | `scripts/e2e.mjs` | 断言上/中档存在、floor=0 时无底部档、刻度不压柱、命中率刻度带 `%` |
| CHG-06 | 已落地 | `docs/ui-design.md` §5.5 | Y 轴条目改为自适应宽度 + 底部档条件，并记 v3.15 误删 / v3.17 恢复 |

### 3.1 改动清单

#### CHG-02 · `client.js` · `TrendChart`

- 柱区容器内、`trendBars` 之前，恢复网格与刻度渲染。

```diff
 h('div', { style: styles.trendPlot },
+  ...gridLines.map((top) => h('span', { key: top, 'aria-hidden': true, style: { ...styles.trendGrid, top } })),
+  ...axisTicks.map((tick) => h('span', { key: tick.pos, 'aria-hidden': true, style: { ...styles.trendAxis, ...tick.style } }, tick.text)),
   emptyMessage === null ? h('div', { style: styles.trendBars, ...
```

## 四、不改动 / 边界

- `BND-01`：不引入图表库。
- `BND-02`：不改 132 / 18 / 34 / 36 四个既有常量。
- `BND-03`：不改 `src/` 与 `/usage` DTO。

## 五、验收要点

| 项 | 来源 | 验证方式 | 结果 |
|---|---|---|---|
| Y 轴显示 3 档且随指标变化 | REQ-01 / REQ-03 | `npm run e2e` | 通过 |
| 三条网格线可见 | REQ-02 | 目检 + E2E | 通过（`settings.png` 目录可见三条横线） |
| 命中率底部档出现 | REQ-04 | 单测 + E2E | 通过 |
| 刻度不重叠 | REQ-05 | 目检截图 + E2E 位置断言 | 通过 |
| 无回归 | BND-01~03 | `npm test` + `npm run e2e` | 通过（137 pass / 1 预期 skip，E2E 全绿） |

## 九、自测反馈台

- 2026-11-19 用户反馈：P3 趋势图没有动态变化的纵坐标，CC Switch 有。根因见 §〇：`c41b9eb` 误删渲染，非设计变更。状态：[已修复]。
- 2026-11-19 追加反馈（第二轮）：① 刻度应像 CC Switch 一样在绘图区之外；② 柱状图与明细表之间分区不清。两条均已处理，随 `2.3.1-local.2` 交付。

### 追加处置（v3.18）

| 项 | 现象 | 根因 | 处置 |
|---|---|---|---|
| 轴位置 | 刻度压在柱体区域内 | 刻度用绝对定位画在 `trendPlot` 内部；CC Switch 的 `<YAxis>` 由图表库在绘图区外单独占列 | `trendPlot` 改两列网格，左列专供轴，右列才是绘图区 |
| 命中率刻度怪值 | 显示 `99.6% / 49.8%` | 顶档取数据最大值；下限被单个 0% 日拽回 0，中档＝(0+0.996)/2 | 顶档固定 100%；`hitRateFloor` 忽略离群 0% |
| 表格分区 | 图表与表格仅 1px 分隔 | 明细表无区块标题 | 新增「模型明细」标题行 + 范围说明 + 16px 外边距 |

最终交付：`2.3.1-local.2`（本地构建，未发布）；`npm test` 139 pass / 1 预期 skip，`npm run e2e` 全绿。
