# 订阅行排版对齐：P1 / P2 周期标签与圆环基线统一

> 状态：实施中<br>
> 创建时间：2026-11-23<br>
> 更新时间：2026-11-23<br>
> 关联逻辑根：`dsh-token-dash`（`client.js`、`tools/preview/`）<br>
> 关联资料：[`ui-design.md`](../../ui-design.md) §2.6（字号 token）、§3（P1 Pill）、§4.3（P2 主区）、§4.4（P2 订阅行）；探索稿 [`p1-type-compare.html`](../../tools/preview/drafts/p1-type-compare.html)

## 〇、前置依赖 / 代码探查事实（已确认）

### 已明确 · 测量口径

> 采集方式：`client.js` 当前工作区代码 + `tools/mock/fixtures.mjs` 假数据，DSH web profile + Playwright，Chromium 2x。基线用「0 高 inline-block 探针底边」实测，非盒子中心。

**基线位置 = (pill 高 − 字形高) / 2 + ascent，与 `line-height` 无关**（推导见 §2.4 陷阱 1）。因此同一行内不同字号必然产生不同基线 —— 这是「看着不齐」的根因，也是盒子中心全部为 0.00px 却仍不平的原因。

### 已明确 · 现状实测（`client.js` 现行）

| 态 | 元素 | 字号 | 字重 | line-height | 基线（距 pill 顶） |
|---|---|---|---|---|---|
| API | 前缀 `[API]` | 16px | 600 | normal | 19.5 |
| API | 数值 `¥0.16` / `¥87.66` | 16px | 600 | normal | 19.5 |
| API | 百分比 `91.9%` | 16px | 600 | 16px | 18.0 |
| API | 标签 `预算` / `今日` / `余额` | 11px | 400 | normal | 17.5 |
| 订阅 | 前缀 `[订阅]` + 分隔符 `・` | 16px | 600 / 400 | normal | 19.5 |
| 订阅 | 百分比 `42.5%` | 12px | 600 | 12px | 17.0 |
| 订阅 | 标签 `5h` / `周` / `月` | 11px | 400 | 11px | 12.5 |

- **API 态存在 3 条不同基线（17.5 / 18.0 / 19.5），离散 2.0px。**
- **订阅态存在 3 条不同基线（12.5 / 17.0 / 19.5），离散 7.0px** —— 这是 P1 最明显的不齐，`5h` 比 `・` 低 7px。
- pill 实测高 26px（设计为 24），环 SV 14/2 几何中心始终在 13.0px（即 pill 中线），但没有任何一条文字基线经过环心。

### 已明确 · 根因：环+数字是跨 P1/P2/P3 的共享组合组件

- `InlineRing`（`client.js:992`）是**组合共享组件**：内部 = `ProgressRing` + 右侧文本，被三处复用 —— P1 预算环（14/2）、P2 摘要环（20/2.5）、`SubWindow` 订阅窗口环（P1 传 14/2、P2 默认 20/2.5）。
- 组件有两条文本分支，**只有一条带字号**：

```js
// client.js:992 —— 现状
text !== undefined
  ? h('b', { style: { fontWeight: 600, color: stateColor(state),
                  lineHeight: 1, paddingBottom: 2 } }, text)          // ← 无 fontSize，继承外层
  : h(PercentValue, { percent, state, size: 12, testid: percentTestid }) // ← 显式 12px
```

- P1 传 `text`（`client.js:1737`）→ 走无字号分支 → **继承 pill 的 16px**；P2 与 SubWindow 不传 `text` → 走 `PercentValue` 的 12px。**这就是 API 态 16px / 订阅态 12px 同 pill 内分裂的确切来源。**
- `styles.pill`（`client.js:465`）未声明 `fontSize` / `lineHeight` / `height`，三者全部继承宿主 → 16px 数值、`normal` 行高、26px 高的来源。
- 标签 `styles.summaryLabel` = `fontSize: 11` 被 **P1 与 P2 共用**；`ui-design.md` §4.3 明确 P2 标签就该是 11px —— 因此**不能就地改 `summaryLabel`**，否则回归 P2。
- `ui-design.md` §2.6 已定义 `--td-fs-pill`（12px，「P1 全部文字与数字」）、`--td-lh-pill`（20px）、`--td-fs-body`、`--td-fs-micro`；全仓 `--td-fs-*` / `--td-lh-*` 在 `client.js` 与 `tools/preview/templates/` **命中 0 次**，token 从未被消费。§2.6「禁止写死 px 字号」当前持续违反。
- §3 明确 P1「字号 12px、高 24」——**设计从未要求数值比标签大**，16px 是继承泄漏，不是设计意图。

### 已明确 · 方案 A 实测（已用探索稿验证）

| 版本 | API 态宽 | 订阅 3 窗宽 | pill 高 | API 基线 | 订阅基线 |
|---|---|---|---|---|---|
| 现状 | 319.4px | 303.7px | 26px | 2.0px / 2 条 | 2.0px / 3 条 |
| **方案 A（全 12px）** | **278.6px** | **287.8px** | **24px** | **0.0px / 1 条** | **0.0px / 1 条** |

- 方案 A 下单字号 → 单基线 17.0（离散 0.0）；环心 12.0 与汉字「预算」墨迹中心 12.0 **重合（0.0px）**，与数字墨迹中心差 0.5px —— 该 0.5px 属 RSK-02 的光学中线问题，本 feature 不承诺消除。
- 订阅 3 窗由 303.7px 收窄到 287.8px（省 15.9px），API 态由 319.4px 收窄到 278.6px。
- **验证结论（2026-11-23 复刻结构实测）**：按当前 CHG-01~04，API 态可达单基线，**订阅态不可达** —— 订阅窗口走 `SubWindow`，其标签用 `summaryLabel`(11px) + `height:14` + `top:-0.5`，百分比走 `PercentValue`(12px + `lineHeight:1` + `paddingBottom:2`)，两者都不在 CHG-01~04 覆盖范围内。实测订阅态仍有 3 条基线（11.5 / 16.0 / 17.0），离散 5.5px，**仅比现状的 7.0px 略好**。
- **补改后可达标**：把 SubWindow 的标签改用 `pillLabel` 语义（12px / 16px 行高，去掉 `height:ringSize` 与 `top:-0.5`）、百分比改用 16px 行高并去掉 `paddingBottom` 后，订阅态实测收敛为 **1 条基线（17.0）、离散 0.0px**。
- **但 SubWindow 是 P0 共享控件**（P2 订阅行同样在用，`ui-design.md` §4.4 规定 P2 为 20/2.5）—— 因此该修正必须以「P1 专用参数」形式引入，不能改 SubWindow 的默认行为，否则回归 P2。
- **`paddingBottom: 2` 的补偿在单字号下有害**：保留它会把该文本框整体上移 1px（实测基线 17.0 → 16.0、离散 0 → 1.0px），因此 P1 的环内文本必须不带该补偿。

## 一、需求（已对齐）

| ID | 优先级 | 需求 / 边界 / 风险 | 成功信号 |
|---|---|---|---|
| REQ-01 | P0 | P1 pill 内全部文字与数字统一为 **12px**（前缀 / 标签 / 数值 / 百分比 / 分隔符），不再继承宿主字号 | 实测所有文本节点 `font-size` 均为 12px，无 16px / 11px 残留 |
| REQ-02 | P0 | P1 pill 内所有文字落在**同一条基线**上 | 基线离散 0.0px、不同基线数 = 1（API 态与订阅态各测一次） |
| REQ-03 | P0 | P1 pill 高度回到设计的 **24px** | 实测 `height` = 24 |
| REQ-04 | P1 | `InlineRing` 的文本分支必须**显式接收字号**，不得依赖外层继承 | 组件内无「无 fontSize 的文本分支」；三处调用各自传值 |
| REQ-05a | P0 | 订阅态窗口（`SubWindow`）同样必须满足 REQ-01/02：标签与百分比均 12px、与 pill 其余文字同基线 | 订阅 3 窗基线离散 0.0px、不同基线数 = 1 |
| REQ-05 | P1 | 共享组件改造后 **P2 / P3 不劣化**：P2 摘要环 20/2.5、P2 订阅行环径与列布局不变；P2 订阅行首行标签↔百分比的墨迹差**不得大于现状 4.0px** | P2 环径 / 列宽 / SubWindow 高不变，且标签与百分比墨迹差 ≤4.0px（现状实测 4.0px） |
| BND-01 | 边界 | 不改 `ProgressRing` 几何（`viewBox` / `strokeDasharray` / 尺寸档位） | 环渲染结果不变 |
| BND-02 | 边界 | 不改 `--td-fs-body` 语义，P2 / P3 正文仍 13px | `--td-fs-pill` 仅作用于 P1 |
| BND-03 | 边界 | 不改 VM / 服务端；纯 UI 排版 | 无后端改动 |
| RSK-01 | 风险 | 直接改共用的 `styles.summaryLabel` 会外溢到 P2 | P2 标签仍 11px（§4.3） |
| RSK-02 | 风险 | 环与字形的**光学**中线属于未决问题（前序 Issue #6 / #8 两轮失败） | 本 feature 只承诺「文字之间基线一致」；环心与字形的光学偏差**已于 2026-11-23 由真机确认为可感知（实测 0.5px）并转为 Issue #1**，不在本 feature 内伪造通过 |

## 二、设计方案（已对齐）

### 2.1 结构（字号解析链：现状 vs 目标）

> 本 feature 的链路是「一个文本节点最终拿到哪个字号」，属于判定分支，用分支图表达。

**现状 · 继承泄漏**

```text
渲染 P1 pill
  ├─ styles.pill 有 fontSize？──没有──> 继承宿主 16px
  │                                        ├─ 前缀 [API] / 分隔符 ・ → 16px
  │                                        └─ InlineRing 文本分支（无 fontSize）→ 16px
  ├─ 标签 styles.summaryLabel → 显式 11px（P1/P2 共用）
  └─ 订阅百分比 → PercentValue 显式 12px
结果：同一 pill 内 16 / 11 / 12 三档并发 → 3 条基线
```

**目标 · 显式收敛（方案 A）**

```text
渲染 P1 pill
  ├─ styles.pill 声明 fontSize: --td-fs-pill (12) + lineHeight + height: 24
  ├─ 前缀 / 标签 / 数值 / 分隔符 → 一律继承 pill 的 12px（不再各自声明）
  └─ InlineRing 文本分支 → 显式接收 fontSize 入参（P1 传 12，P2/P3 保持现值）
结果：单一字号 → 单一基线（实测 17.0，离散 0.0）
```

### 2.2 关键签名 / 字段（已确认）

| 层 | 名称 | 备注 |
|---|---|---|
| client | `styles.pill` | 补 `fontSize` / `lineHeight` / `height`；数值取 §2.6 的 `--td-fs-pill`、`--td-lh-pill` |
| client | `styles.pillLabel` | **新增** P1 专用标签样式（12px），与 P2 共用的 `summaryLabel`（11px）解耦 |
| client | `InlineRing({ fontSize })` | **新增入参**；`text` 分支据此声明 `fontSize`，缺省回落到现有行为以保证 P2/P3 不变 |
| client | `PercentValue({ size })` | 已存在，P2/P3 继续用；P1 统一走 pill 继承，不再特例 |
| preview | `SPEC.inlineRing.font` | 已存在 = 12，与方案 A 目标值一致，无需改值 |

### 2.4 关键陷阱（已确认）

| 项 | 约束 |
|---|---|
| 陷阱 1：基线位置与 line-height 无关 | 基线 = (容器高 − 字形高) / 2 + ascent。`line-height` 只改变行盒高度，行盒在 `align-items:center` 下被居中，半行距上下均分，**基线位置不变**（实测 `line-height` 16px 与 20px 结果完全相同）。因此「调 line-height 修对齐」无效，前序 Issue #8 的 B 方案失败正因如此。 |
| 陷阱 2：基线随字号漂移 | 字形高随 `font-size` 变化，(容器高 − 字形高) / 2 随之变化，故**多字号必然多基线**。这是必须收敛为单一字号的数学原因，不是审美偏好。 |
| 陷阱 3：`paddingBottom:2` 补偿不可混用 | 该值是 Issue #6 为 `PercentValue` 加的字形补偿。它把文本整体上移 1px；在「全部文字都带补偿」时自洽，在「部分文字带」时**直接制造 1px 基线差**。P1 单字号方案下必须不带。 |
| 陷阱 4：共用样式外溢 | `summaryLabel` 被 P1 与 P2 共用，就地改字号会回归 P2（§4.3 要求 11px）。必须新增 P1 专用样式。 |
| 陷阱 6：P2 的标签本来就不齐 | 真机实测 P2 订阅行首行：标签 `5h` 墨迹中心距环心 **4.5px**、百分比 `12%` 距环心 0.5px，两者相差 **4.0px** —— P2 现状的标签与数字同样不在同一视觉线。因此「改 SubWindow 会让 P2 变化」不等于「改坏了」：正确判据是**P2 是否比现状更差**，而不是是否零变化。 |
| 陷阱 7：P2 行高不受标签盒高影响 | P2 实测 `SubWindow` 高 36px，由 `ring(20) + gap(3) + rel(13)` 决定；标签当前 `height:ringSize(20)` 与去掉后的 16px 行盒都小于 20px 的环高，**不会撑高列**。因此 P1 专用化改造不会引发 P2 布局位移（实测三种写法 panel 高均 110px、SubWindow 高均 36px）。 |
| 陷阱 5：共享组件默认值 | `InlineRing` 新增 `fontSize` 入参时必须给出与现状等价的行为，避免 P2 摘要环（20/2.5）与 `SubWindow` 被顺带改掉。 |

## 三、实现要点（已实施）

### 3.0 开发改动总览（已落地）

| ID | 类型 | 文件 | 开发改动说明 |
|---|---|---|---|
| CHG-01 | 修改 | `client.js` `styles.pill` | **已落地**（`client.js:465`）：补 `fontSize: 12` / `lineHeight: '16px'` / `boxSizing: 'border-box'`，高度维持 24，消除宿主 16px 继承泄漏 |
| CHG-02 | 新增 | `client.js` `styles.pillLabel` | **已落地**（`client.js:549`）：P1 专用标签 12px / 16px 行高；`summaryLabel` 保持 11px 供 P2 使用 |
| CHG-03 | 修改 | `client.js` `InlineRing` | **已落地**（`client.js:999`）：新增 `fontSize` 与 `percentLineHeight` 入参，两分支均支持覆盖，缺省保持旧行为 |
| CHG-04 | 修改 | `client.js` P1 Pill | **已落地**（`client.js:1751` 起）：预算环传 `fontSize: 12`，三处标签改用 `pillLabel` |
| CHG-05 | 修改 | `client.js` `SubWindow` | **已落地**（`client.js:1992`）：新增 `labelFontSize`；P1 传 12 并关闭 `height`/`top` 补偿，百分比同步走 16px 行盒；P2 不传、行为不变 |
| CHG-05b | 修改 | `client.js` `PercentValue` | **已落地**（`client.js:986`）：新增 `lineHeight` 入参并做「数字 → px 字符串」归一化 —— React 把 `lineHeight` 当无单位属性，传数字 16 会算成 192px（实测发现并修复） |
| CHG-06 | 修改 | `docs/ui-design.md` §2.6 / §3 / §4.4 | **已落地**：新增 §2.6.1「P1 单一字号与基线判据」，§3 补单一字号约定，§4.4 注明 P2 仍为多字号取舍 |
| CHG-07 | 测试 | `test/unit/client-slots.test.mjs` | **已落地**：新增 4 条断言（字号收敛 / pillLabel 与 summaryLabel 解耦 / 行高归一化 / SubWindow 双路径） |

### 3.1 改动清单（待实施）

#### CHG-01 · `client.js` `styles.pill`

- `pill`：声明字号与高度，不再继承宿主。

```diff
  pill: {
    display: 'inline-flex', alignItems: 'center', gap: 6, height: 24, padding: '0 8px',
    borderRadius: 999, cursor: 'pointer', maxWidth: '100%', fontVariantNumeric: 'tabular-nums',
+   fontSize: 12, lineHeight: '16px',
    border: `1px solid ${T.border}`, color: T.text,
  },
```

#### CHG-02 · `client.js` `styles.pillLabel`

- 新增 P1 专用标签样式，与 P2 共用样式解耦。

```diff
+ pillLabel: { color: T.muted, fontSize: 12, lineHeight: '16px' },
  summaryLabel: { color: T.muted, fontSize: 11 },
```

#### CHG-03 · `client.js` `InlineRing`（共享组件）

- `text` 分支：新增 `fontSize` 入参，显式声明字号；不传时保持「无字号」的旧行为，保证 P2/P3 不变。

```diff
- function InlineRing({ percent, state = stateOf(percent), size = 14, stroke = 2, text, testid, percentTestid }) {
+ function InlineRing({ percent, state = stateOf(percent), size = 14, stroke = 2, text, fontSize, testid, percentTestid }) {
    ...
      ? h('b', { 'data-testid': percentTestid, style: {
          fontWeight: 600, color: stateColor(state),
-         lineHeight: 1, paddingBottom: 2,
+         lineHeight: 1,
+         ...(fontSize === undefined ? { paddingBottom: 2 } : { fontSize }),
        } }, text)
```

- 已验证：`lineHeight: 1` 且去掉 `paddingBottom` 时，API 态全部文字基线落到 17.0（离散 0.0）；`lineHeight` 取 1 或 16px 结果完全相同，再次印证 §2.4 陷阱 1。

#### CHG-04 · `client.js` P1 Pill

- 预算环传 `fontSize: 12`；三处标签改用 `pillLabel`；分隔符继承 pill 字号即可。

```diff
      h(InlineRing, {
        percent: hasBudget ? percent : null,
        state: hasBudget ? stateOf(percent, API_CRITICAL) : 'empty',
-       size: 14, stroke: 2,
+       size: 14, stroke: 2, fontSize: 12,
        text: hasBudget ? fmtRatio(budget.percent) : tr('未设置'),
      }))
```

- 同文件同函数内三处 `data-td-label` 的 `styles.summaryLabel` → `styles.pillLabel`。

#### CHG-05 · `client.js` `SubWindow`（P0 共享控件）

- 现状：标签固定 `summaryLabel`(11px) + `display:inline-flex` + `lineHeight:1` + `height: ringSize` + `top:-0.5`；P1/P2 共用同一套 hack。
- 目标：新增 `labelFontSize` 入参。传入时按该字号渲染标签并**去掉 `height` / `top` 补偿**；不传时保持现状，P2 不受影响。

```diff
- function SubWindow({ plan, showTime = true, place = 'center', testKey, ringTestId, ringSize = 20, ringStroke = 2.5 }) {
+ function SubWindow({ plan, showTime = true, place = 'center', testKey, ringTestId, ringSize = 20, ringStroke = 2.5, labelFontSize }) {
    ...
          h('span', {
            style: {
-             ...styles.summaryLabel,
-             display: 'inline-flex', alignItems: 'center', lineHeight: 1,
-             height: ringSize, position: 'relative', top: -0.5,
+             ...(labelFontSize === undefined ? styles.summaryLabel : { color: T.muted, fontSize: labelFontSize }),
+             ...(labelFontSize === undefined
+               ? { display: 'inline-flex', alignItems: 'center', lineHeight: 1, height: ringSize, position: 'relative', top: -0.5 }
+               : { lineHeight: '16px' }),
            },
          }, plan?.key ? windowLabel(plan.key) : '—'),
```

- 同文件 `subscriptionNodes`：传入 `labelFontSize: 12`。

```diff
-     nodes.push(h('span', { key: plan.key, style: styles.inlineWrap },
-       h(SubWindow, { plan, showTime: false, ringSize: 14, ringStroke: 2, ringTestId: `token-dash-pill-ring-${plan.key}` })))
+     nodes.push(h('span', { key: plan.key, style: styles.inlineWrap },
+       h(SubWindow, { plan, showTime: false, ringSize: 14, ringStroke: 2, labelFontSize: 12, ringTestId: `token-dash-pill-ring-${plan.key}` })))
```

- 同时 `PercentValue` 需要一并去掉 P1 侧的补偿：`SubWindow` 内的 `InlineRing` 亦需传 `fontSize: 12`（同 CHG-03/04 机制），使百分比走「12px + 16px 行高 + 无 paddingBottom」。

#### CHG-07 · `test/unit/client-slots.test.mjs`

- 断言 `styles.pill` 含 `fontSize: 12`；断言 `InlineRing` 的文本分支不再是无字号的裸 `<b>`；断言 `summaryLabel` 仍为 11px（P2 保护）。
- 追加断言：`SubWindow` 的标签分支在收到 `labelFontSize` 时不含 `height` / `top` 补偿（P1 路径），未传时保持原 hack（P2 路径）。

#### CHG-06 · `docs/ui-design.md` §2.6 / §3

- §2.6 记录 token 已接入 P1；§3 记录「P1 单一字号 12px、基线判据与实测值」，注明度量基于系统字体，换字体需复核。

## 四、不改动 / 边界（已确认）

- `BND-01`：`ProgressRing` 几何与三档尺寸（14/2、20/2.5、40/4）不变。
- `BND-02`：`--td-fs-body` / P2 / P3 正文字号不变；`--td-fs-pill` 仅作用于 P1。
- `BND-03`：无 VM / 服务端改动。
- P2 标签保持 11px（`ui-design.md` §4.3），P2 摘要环保持 20/2.5。

## 五、验收要点（待验证）

| 项 | 来源 | 验证方式 | 结果 |
|---|---|---|---|
| P1 全部文本 `font-size` = 12px | REQ-01 | Playwright 遍历 pill 内文本节点读 `getComputedStyle` | **通过**：API / 订阅两态实测字号集合均为 `["12px"]`，无 16px / 11px 残留 |
| P1 基线离散 0.0px、不同基线数 = 1（API 态） | REQ-02 | 基线探针法实测 | **通过**：单一基线 17.0px，离散 0.0 |
| P1 基线离散 0.0px、不同基线数 = 1（订阅 3 窗） | REQ-02 | 基线探针法实测 | **通过**：9 个文本节点全部落在 17.0px，离散 0.0 |
| P1 pill 高度 = 24px | REQ-03 | 实测 `getBoundingClientRect().height` | **通过**：实测 24.00（API 宽 283.05 / 订阅宽 297.5） |
| `InlineRing` 文本分支无「无字号」路径 | REQ-04 | 代码断言 + P1 调用点传参 | **通过**：`fontSize` 入参已引入，P1 两处调用点均传入 12；单测覆盖 |
| P2 摘要环 20/2.5、P2 订阅行环径 20/2.5、SubWindow 高 36px 不变 | REQ-05 | 真机实测环径 / 列宽 / 高度 | **通过**：改造前后均为环 20、高 36.00、宽 63.58，逐值一致 |
| P2 订阅行首行标签↔百分比墨迹差不劣于现状 4.0px | REQ-05 | 真机墨迹中心实测 | **通过**：`5h` 距环心 −4.5px、`12%` −0.5px，与改造前完全相同（P2 未受影响） |
| 订阅 3 窗基线离散 0.0px | REQ-05a | 真机实测 | **通过**：需 CHG-05（`labelFontSize`）才成立；仅 CHG-01~04 时为 1.0px |
| 墨迹中心与环心差（记录项，非硬门槛） | RSK-02 | ink center 实测 | API 态汉字 `预算` 与环心重合（0.0px），数字差 0.5px；订阅态标签 0.5px、百分比 0.5px。**该 0.5px 为字形固有度量差，按 RSK-02 不承诺消除** |
| 环几何未变 | BND-01 | 对比 `ProgressRing` 渲染结果 | **通过**：`ProgressRing` 未改动，环心仍为 pill 中线（12.0） |
| L1 `npm test` 全绿 | 全局质量门槛 | 本地执行 | **通过**：190 tests / 189 pass / 0 fail / 1 skip |
| L2 `npm run e2e` 全绿（涉及 UI 链路） | 全局质量门槛 | 本地执行 | **通过**：UI assertions passed（注：Issue #2/#3/#4 未实施，E2E 断言仍为旧版本） |
| 订阅段单侧视觉留白 = 7px（gap 4 + 无空格分隔符） | Issue #1 | 真机 + 实测容器 gap / 子节点间隙 | **通过**：订阅 3 窗宽度由 297.5 收窄至 289.5 |
| 环墨迹中心与文字墨迹中心差 ≤ 0.25px | Issue #1 | DOM 几何实测 | **通过**：环心 12.75 / 文字墨迹 12.5，残差 0.25px |

## 九、自测反馈台（活跃期，归档前删除）

### Issue #1 [已修复] 2026-11-23 P1 订阅态窗口间隔过散、圆环与文字重心不齐

> 关闭口径：真机反馈（用户截图）｜修复方：本仓 `client.js` + `page-p1.html`｜验证：2026-11-23 本地，L1 190 tests 全绿（含本 Issue 6 条断言）+ DOM 几何实测残差 0.25px；**P1 已落地，P2 部分转 Issue #6**｜TAPD：N/A

**根因**：两处独立成因。

问题一（间距过散）为**三重盒宽叠加**：pill 的 `gap: 6` 对每个直接子节点各计一份，分隔符 `' ・ '` 两侧半角空格又各占约 3px 盒宽，叠加 U+30FB 全角字形自身的横向留白，使单侧视觉留白达到 12px（API 态仅 6px）。

问题二（数字显沉）定性曾走弯路，最终确认是**环偏高而非数字偏低**：文字之间基线本就统一，环墨迹中心 11.84 比文字墨迹中心 12.58 低 0.74px，且环体量更大（13.7px vs 8.2px）被当作视觉参照。

```text
单侧视觉留白 = gap + (分隔符盒宽 / 2) − (分隔符墨迹宽 / 2)
现状  gap 6 + ' ・ ' 盒宽 18 -> 6 + 9  − 3 = 12.0px
采用  gap 4 + '・'   盒宽 12 -> 4 + 6  − 3 =  7.0px
API   gap 6 + 无分隔符          ->              6.0px

环去就文字（API 态墨迹实测，4x 逐列扫描）
  预算   6.73 .. 18.44  center 12.58
  91.9%  8.47 .. 16.69  center 12.58   <- 数字与金额上下沿完全一致
  今日   6.98 .. 18.44  center 12.71
  圆环   4.98 .. 18.69  center 11.84   <- 错位的是环，差 0.74px
```

**处理**：`client.js` · `subscriptionNodes` 分隔符去掉两侧空格并包进 `styles.pillGroup`（`gap: 4`）；`InlineRing` 新增 `ringShift`，P1 分支传 0.75（`SubWindow` 的 P1 路径同步）；P2 / P3 走不传参数的原路径，行为不变。`page-p1.html` 同步冻结该排版。否决方案：直接把 pill 的 `gap` 降到 4（会连带 API 段）、给百分比加 `top` 补偿（依赖字体度量，换字体失效）。
CL：N/A（git 仓，未提交；产物 `2.5.0-local.10`）

**遗留**：① 环-文字残差 0.25px 为 0.75px 取整后的极限，再进一步需改环径或字号并重算。② P2 订阅行的多字号不齐已转 Issue #6 处理，不在本 Issue 范围。③ 0.75px 绑定「环径 14 / 字号 12」组合，改变其一须按 RSK-02 复核。

### Issue #2 [已修复] 2026-11-23 P2 主区三组未形成「左 / 中 / 右」对齐

> 来源：真机截图反馈（用户，2026-11-23）｜合并用户原反馈第 1 条与第 3 条（二者同源：`summaryRow` 分组与单元格对齐缺省值）｜引入版本：早于 `2.5.0-local.9`｜**已实施（`2.5.0-local.11`）**

**现象**
- 主区三组（环 / 已用·预算 / 真实余额）没有形成清晰的三段对齐：中间块夹在环与余额之间左右都不落地，右端余额两行左缘参差。

**根因**

```text
summaryRow  gridTemplateColumns: auto | minmax(120px,1.2fr) | minmax(80px,1fr) | minmax(0,1fr)
             └ col1: 环   └ col2: 已用/预算  └ col3+4: 余额 (gridColumn: '3 / 5')

★问题点 1：col2 被 1.2fr 拉得很宽，summaryCell 是 flex-column + 默认 alignItems:stretch，
      标签贴列左缘、数值几乎占满整列 -> 两行块的左右边界都不落地。
★问题点 2：余额块 justifySelf:end + alignItems:flex-end 只把「盒子」推到右缘；
      flex-end 对块内两行分别生效，11px 标签与 12px 数值各自贴右后左缘必然错开。
★问题点 3：余额跨 col3+4 两列，窗口宽度变化时 120px/80px/1fr 比例随之漂移。
```

**方案（定稿：三栏制）**

| 栏 | 内容 | 对齐 | 落点 |
|---|---|---|---|
| 左 | 环 + 百分比 | `align-items: flex-start` | 贴内容左缘 |
| 中 | 已用 / 预算 | `align-items: center` | 栏内水平居中 |
| 右 | 真实余额 | `align-items: flex-end` + `textAlign: right` | 贴内容右缘 |

- 列宽 `minmax(0,1fr) minmax(0,1.5fr) minmax(0,1fr)`：中栏内容最长（`¥91.90 / ¥100.00`），给 1.5fr 避免换行；左右两栏内容短，1fr 仍可贴边。
- 被否决：曾把余额改 `flex-start` 左对齐，破坏「右侧对齐」的原设计，已回退。

**效果（预览稿实测，行宽 346px）**

| 栏 | 单元格 | 内容范围 | 判定 |
|---|---|---|---|
| 左 | 0 – 92 | 0 – 57 | 贴左缘（x=0） |
| 中 | 104 – 242 | 145.8 – 218 | 居中（中点 181.9 / 栏中点 173） |
| 右 | 254 – 346 | 302 – 346 | 贴右缘（x=346 = 行宽） |

- 右栏右端点与标题行 `[ API 用量 ]` 共用同一条右边线。
- **该数据取自预览稿**（`tools/preview/templates/page-p2.html`），正式代码尚未同步。

**实施与验收（已完成）**
- `client.js` · `styles.summaryRow` 改三栏列宽；`P2Summary` 三个子项分别加 `alignItems: flex-start / center / flex-end`。
- 真机复测：L1 194 tests / 193 pass；E2E UI assertions passed；截图确认左贴左、中居中、右贴右。


### Issue #3 [已修复] 2026-11-23 P2 用量表：表头分隔线与数据行分隔线长度不一致

> 来源：真机截图反馈（用户，2026-11-23）｜引入版本：早于 `2.5.0-local.9`｜**已实施（`2.5.0-local.11`）**

**现象**
- 表头（`模型 / Tokens / 请求 / 命中`）下方的分隔线**比数据行下方的分隔线短**，右端提前收尾；两者断口位置不同，视线上一眼可见。

**根因**

```text
TokenTable 用 display:contents 把表头展开成 4 个独立 grid item，
每条下边线由各自 cell 的 borderBottom 拼成，而不是整行一条：

  表头 headCell：paddingBottom 6 + borderBottom
  数据 cell   ：padding '5px 0' + borderBottom

★相邻 cell 之间有 columnGap 8px，该间隙没有任何元素，
  于是整条表头线被切成 4 段，每段之间留 8px 断口。
★数据 cell 的最小宽度与表头 cell 不同，断口落在不同横向位置，
  两者叠加后看起来「长度不同」。
```

**方案（定稿）**

- 表头 cell 仍保留 `display:contents`，与数据行共享**同一套列宽定义**（避免出现内层 grid 列宽不一致）。
- 分隔线改由一条**独立的跨列行**承载：`grid-column: 1 / -1; height: 1px; background: var(--border)`，不再被 `columnGap` 切断。
- **被否决**：把表头行改成内层 grid 并加 `borderBottom` —— 实测导致内层列宽与数据行不一致，`模型/Tokens/请求/命中` 挤成两行换行，已回退。

**效果**
- 预览稿中表头线与数据线均横贯整表宽、两端对齐。
- **该效果取自预览稿**，正式代码尚未同步。

**实施与验收（已完成）**
- `client.js` · `TokenTable`：`headCell` 去掉 `borderBottom`；表头行后插入跨列分隔行（`gridColumn: '1 / -1'`）。
- 真机确认表头线与数据线等长、两端对齐。


### Issue #4 [已修复] 2026-11-23 P2 失败态重试入口唯一化：标题栏单一重试，不新增按钮

> 来源：真机截图反馈（用户，2026-11-23）· 提问「这个状态确定有吗，如果有的话这个按钮要单独右对齐」；后续复议「不想要多增加按钮，但任一接口失败就显示重试更合理」｜引入版本：早于 `2.5.0-local.9`｜**已实施（`2.5.0-local.11`）**

**状态可达性（已核实代码）**

| 接口 | 供数 | 失败标志 | 触发条件 |
|---|---|---|---|
| `/summary` | 顶部环 / 已用·预算 / 真实余额 / 订阅窗口 | `error` | 请求失败（超时 10s、非 2xx、JSON 解析失败） |
| `/usage?range=` | 下方模型表格 | `usageError` | 同上 |

两条链路独立轮询；`refreshAll()` 本身就是两个接口一起刷，因此**任一失败都应让用户一次性恢复**。

**根因（现状代码）**

```text
表体内渲染 errorStrip「范围数据加载失败 + 重试」，
标题栏同时保留独立刷新图标。
-> 同一屏出现两个刷新/重试入口，语义重复；
   errorStrip 未设 justifyContent，按钮紧跟文案而非右对齐。
```

**方案（定稿）**

**不新增任何按钮**：失败时把标题栏唯一的刷新位换成语义更明确的「重试」；表体内的错误条与按钮一律移除。

| 状态 | 标题栏右侧 | 表体 |
|---|---|---|
| 正常 | 刷新图标（`token-dash-refresh`） | 表格 |
| **任一接口失败** | **「重试」按钮**（`token-dash-retry`，实红描边 + 14% 红底 + 红字 / 600） | **不显示旧数据**：`/usage` 失败即 `setUsage(null)`，显示空态「范围内暂无消耗」；不插错误条 |

- **判定口径**：`failed = error || usageError`，避免用户分辨「这次坏的是哪一半」。
- **入口唯一**：全屏只有一个重试入口（标题栏）。
- **表体清空**：保留旧数据会让用户把陈旧数字当成当前值；宁可显示「暂无」，也不展示过期数据。
- `styles.retryChip`：高 22、圆角 6、**实红 1px 描边**（`T.over` 原色，不用透明稀释）+ 14% 红底，11px / 600。不用淡色描边，因为与蓝色关闭按钮同为「描边 + 浅底」形态时仅靠色相区分不够。

**实施与验收（已完成）**
- `client.js` · `PanelHeader`：新增 `failed` 参数，失败时渲染 `retryChip` 取代 `IconButton`。
- `client.js` · `Panel`：移除 `errorStrip` 与 `strip` 变量；`loadUsage` 的 catch 补 `setUsage(null)`。
- `scripts/e2e.mjs`：断言改为「失败态 `token-dash-retry`=1 / `refresh`=0」「表体清空为范围内暂无消耗」「恢复后点重试复位」。
- 真机截图确认：失败态标题栏红框「重试」、表体空态、无错误条。


### Issue #5 [已放弃] 2026-11-23 P2 页脚「更新于」时间口径

> 来源：复议 Issue #4 时由用户提出「除非显示的上次使用率缓存数据」｜结论：**放弃，不做**｜决定：2026-11-23 用户拍板

**原问题**
- `/usage` 失败时若仍展示旧表格，页脚「更新于」却取的是 `/summary` 的 `updatedAt`，两者不同步时会出现「表格是 10 分钟前的、页脚却说更新于刚刚」。

**放弃原因**
- 采用「失败即不显示旧数据」的方案后，旧数据根本不会再被展示，页脚时间与表格数据互相冒充的前提消失，本 Issue 失去意义。**不做时间口径改造**。

**连带结论（并入 Issue #4 待实施）**
- `/usage` 失败时**清空 usage 数据**（`setUsage(null)`），表体改显示空态「范围内暂无消耗」，不再保留上一次的表格。
- 这同时回应了「除非显示的上次使用率缓存数据」的顾虑：不展示陈旧数据，就不存在误导。

---

### Issue #6 [已修复] 2026-11-24 P2 订阅窗口：周期标签与环心高低不齐（4.0px），时间行未居中

> 来源：真机截图反馈（用户，2026-11-24）· 诉求「圈和数值与右侧两行内容垂直居中」「订阅态下面的文字要和上面的圈中心对齐」｜引入版本：早于 `2.5.0-local.9`

**现象（真机 4x 实测）**

| 元素 | 字号 | 行高 | paddingBottom | 墨迹中心 | 距环心 |
|---|---|---|---|---|---|
| 标签 `5h` | 11px | 11px | 0 | 6.0 | **+4.0px** |
| 百分比 `12%` | 12px | 12px | **2px** | 10.0 | 0.0 |
| 环（20/2.5） | — | — | — | 10.0 | — |

- 标签比环心高 **4.0px**，数字恰好压环心 —— 同一行内两个元素不在同一视觉线上。
- 时间行（`2 小时后`）中心 X = 31.79，环中心 X = 26.16，**水平相差 5.63px**。

**根因**

```text
SubWindow 走「不传 labelFontSize」的旧分支（隔离 P1 的 P1 专用改造）：

  标签 = summaryLabel(11px) + display:inline-flex + alignItems:center
         + lineHeight:1 + height:ringSize(20) + position:relative + top:-0.5
  百分比 = PercentValue(12px) + lineHeight:1 + paddingBottom:2

★问题点 1：这是前序 Issue #8 的「B+D 方案」（锁高 + 上移 0.5px），
      该方案在 P1 上已被真机证伪并替换，P2 仍残留使用。
★问题点 2：align-items:center 让 11px 行盒居中，但字形墨迹在行盒内偏上，
      再叠 top:-0.5，最终偏离环心 4.0px。
★问题点 3：时间行随「标签+环+百分比」整段居中；而环在该段里被标签挤偏，
      环的位置又随标签字数（5h 两字 / 月 一字）变化，环心不固定。
```

**方案（定稿：与 P1 同款）**

| 项 | 现状 | 定稿 |
|---|---|---|
| 标签字号 | 11px | **12px** |
| 标签行高 | 11px + `height:20` + `top:-0.5` | **16px，无补偿** |
| 百分比行高 | 12px + `paddingBottom:2` | **16px，无 pb** |
| 环位置 | 自然对齐 | **下移 0.75px** |

- 实现方式：`WindowRow` 向 `SubWindow` 传 `labelFontSize: 12`，即走 P1 已建好的单字号分支（`fontSize:12` / `percentLineHeight:16` / `ringShift:0.75`），**无需新增代码路径**。
- 效果：标签与百分比共用 16px 行盒天然共基线；环下移 0.75px 使环心贴合文字墨迹；时间行居中于该段。
- **不采用**「时间行对齐环心」的强制方案：环的位置随标签字数变化，逐种标签计算偏移会重新引入魔法值。
- **API 主区不动**：`P2Summary` 走 `PercentValue`（`pb:2`），实测环心 17.0 / 两行块中心 17.5 仅差 0.5px，已对齐。

**验收（已完成）**
- 真机实测：标签 `5h` 距环心 **+0.25px**（原 4.0px）、百分比 `12%` 距环心 0.25px，两者同为 12px / 16px 行盒。
- P1 回归通过（P1 与 P2 共用 `SubWindow`，L1 194 tests / 193 pass、E2E 全绿）。

---