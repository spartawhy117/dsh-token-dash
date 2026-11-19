# P3 趋势图 Y 轴恢复

> 状态：草案<br>
> 创建时间：2026-11-19<br>
> 关联逻辑根：`dsh-token-dash`（`client.js`）<br>
> 关联资料：`docs/ui-design.md` §5.5、`docs/checklist/active/trend-chart-yaxis-build-checklist.md`

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
| CHG-01 | 新增 | `client.js` · `trendAxisTicks` | 纯函数产出 2-3 档刻度（含底部档的条件） |
| CHG-02 | 修改 | `client.js` · `TrendChart` | 恢复 3 条 `trendGrid` + Y 轴刻度渲染 |
| CHG-03 | 修改 | `client.js` · `styles.trendAxis` | 定位由 `left: 0` 改为右对齐留白右缘 |
| CHG-04 | 修改 | `test/unit/` | 新增 `trendAxisTicks` 边界用例 |
| CHG-05 | 修改 | `scripts/e2e.mjs` | 断言 Y 轴 3 档存在、随指标变化、英文无「万 / 亿」 |
| CHG-06 | 修改 | `docs/ui-design.md` §5.5 | 补变更注记（v3.15 误删，v3.17 恢复） |

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
| Y 轴显示 3 档且随指标变化 | REQ-01 / REQ-03 | `npm run e2e` | 待验证 |
| 三条网格线可见 | REQ-02 | 目检 + E2E | 待验证 |
| 命中率底部档出现 | REQ-04 | 单测 + E2E | 待验证 |
| 刻度不重叠 | REQ-05 | 目检截图 | 待验证 |
| 无回归 | BND-01~03 | `npm test` + `npm run e2e` | 待验证 |

## 九、自测反馈台

- 2026-11-19 用户反馈：P3 趋势图没有动态变化的纵坐标，CC Switch 有。状态：进行中（根因见 §〇：`c41b9eb` 误删渲染，非设计变更）。
