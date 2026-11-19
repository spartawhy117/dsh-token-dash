# 2.3.1：趋势图纵坐标恢复 + 插件描述与市场能力对齐

> 状态：已实施（`2.3.1`，2026-11-19 发布）<br>
> 完成时间：2026-11-19<br>
> 关联逻辑根：`dsh-token-dash`（`client.js` · `package.json` · `docs/release.md`）<br>
> 关联资料：[`ui-design.md`](../../ui-design.md) §5.5（v3.18）、[`release.md`](../../release.md)、施工稿 [`trend-chart-yaxis-build-checklist.md`](../../checklist/archived/trend-chart-yaxis-build-checklist.md)、[`listing-description-release-build-checklist.md`](../../checklist/archived/listing-description-release-build-checklist.md)

本文件由两份 active plan 合并压缩而来：`feature_trend_yaxis.md`（趋势图纵坐标）与 `feature_listing_description_sync.md`（描述口径）。两者同期交付、同一个发布版本，且共享「视觉与对外信息都要和实际能力一致」这一条主线。

## 一、最终需求与范围

### 1.1 趋势图纵坐标

| ID | 最终处置 | 需求 | 最终结论 |
|---|---|---|---|
| REQ-01 | 完成 | 恢复 Y 轴刻度，随指标与数据动态变化 | 三档刻度：顶部最大值、中部中位值、命中率额外补下限档 |
| REQ-02 | 完成 | 恢复上 / 中 / 下三条网格线 | 三条 1px 横线与三档刻度一一对齐 |
| REQ-03 | 完成 | 刻度格式按指标分流 | Tokens 走「万 / 亿」，费用带币种，命中率为百分比，请求为整数 |
| REQ-04 | 完成 | 命中率轴下限非 0 时显示底部档 | `floor > 0` 时补出，为 0 时省略以免挤占高度 |
| REQ-05 | 完成 | 刻度不压柱、不与日期刻度重叠 | 轴独占一列，E2E 断言 `axis.right <= plot.left` |
| REQ-06 | 完成 | （追加）刻度应在绘图区之外，与 CC Switch 一致 | `trendPlot` 改两列网格，轴列 + 绘图区列分离 |
| REQ-07 | 完成 | （追加）命中率刻度取值要有参考价值 | 顶档固定 100%；下限忽略离群 0% 日 |
| REQ-08 | 完成 | （追加）柱状图与明细表需要清晰分区 | 明细表新增「模型明细」标题行 + 范围说明 |

### 1.2 插件描述口径

| ID | 最终处置 | 需求 | 最终结论 |
|---|---|---|---|
| REQ-09 | 完成 | `package.json#description` 与产品实际能力一致 | 改为覆盖 8 家供应商、4 家订阅配额、第三方 API Key 的文案 |
| REQ-10 | 完成 | 描述核对写入发版流程，避免再次遗忘 | `docs/release.md` 第 3b 步 + 发布技能正式发布第 3 步 |
| REQ-11 | 完成 | 发版后三处文案一致 | 2.3.1 核验：npm description 含 4 家订阅，本地装包一致 |
| REQ-12 | 完成 | 市场「发现」页口径同步 | PR [#16877](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/16877) 已提交 |

### 1.3 边界与风险

| ID | 最终处置 | 内容 |
|---|---|---|
| BND-01 | 保持 | 不引入图表库，`dependencies` 仍为空 |
| BND-02 | 保持 | 柱区 132px、日期刻度行 18px、柱宽上限 36px 不变（轴宽已改为自适应） |
| BND-03 | 保持 | 不改 `/usage` DTO、采集层、导出结构 |
| BND-04 | 保持 | 市场索引文案属于上游目录，本仓只作为核对对象 |
| RSK-01 | 已验证 | 刻度文字过长溢出留白 → 已改为按最长刻度自适应轴宽 |
| RSK-02 | 已验证 | 文案过长在卡片单行被截断 → 首句 30 字内独立成义 |

## 二、最终实现

### 3.0 最终改动总览

| ID | 类型 | 文件 | 最终落点 |
|---|---|---|---|
| CHG-01 | 新增 | `client.js` · `trendAxisTicks` | 纯函数产出 2–3 档刻度；命中率顶档固定 1，`floor > 0` 时补底部档 |
| CHG-02 | 修改 | `client.js` · `TrendChart` | `trendPlot` 改两列网格：轴列 `token-dash-trend-axis-col` + 绘图区 `token-dash-trend-plot-area`；恢复三条网格线与三档刻度 |
| CHG-03 | 修改 | `client.js` · `styles` | `trendAxis` 由 `left: 0` 改右对齐；轴宽按最长刻度估算（中文 11px/字、其余 6.2px/字，下限 28px）；柱区 / 日期刻度 / 悬停层 / 空态跟随 `axisPad` |
| CHG-04 | 修改 | `client.js` · `hitRateFloor` | 忽略离群 0% 日，避免下限塌回 0 使中档落到 49.8% |
| CHG-05 | 修改 | `client.js` · `BoardPage` | 明细表上方新增「模型明细」区块标题 + 范围说明，16px 外边距 + 1px 分隔线 |
| CHG-06 | 修改 | `client.js` · 词条 | 新增「模型明细」「范围按当前时间范围统计」；趋势空态改用已有键 `范围内暂无消耗` |
| CHG-07 | 修改 | `locale/zh.json` / `locale/en.json` | 与 `client.js` 内置 `EN` 词典三处同键同值 |
| CHG-08 | 修改 | `package.json` | `description` 换为 8 家供应商 / 4 家订阅 / 第三方 API Key 版本 |
| CHG-09 | 修改 | `docs/release.md` | 正式发布清单新增 3b「description 核对」步骤 |
| CHG-10 | 修改 | `release` skill SKILL | 正式发布第 3 步加入同一核对，后续步骤重新编号 |
| CHG-11 | 修改 | `docs/ui-design.md` §5.5 | 补 v3.18 规格：轴在绘图区外、自适应宽度、命中率上下限口径 |
| CHG-12 | 新增 | `test/unit/trend-axis.test.mjs` | 7 例覆盖档位、全零、上限 100%、离群 0%、渲染点、轴列结构 |
| CHG-13 | 修改 | `scripts/e2e.mjs` | 断言刻度存在、`axis.right <= plot.left`、命中率刻度带 `%`、明细表标题；更新检测断言不再钉死历史版本号 |

### 3.1 关键结构与契约

```text
趋势图：轴与绘图区两列分离（v3.18）
┌──────────┬─────────────────────────────┐
│ 100%  ──┼─────────────────────────────│  ← 轴列（宽度自适应）
│  50%  ──┼─────────────────────────────│
│   0%  ──┼─────────────────────────────│
│         │  10-31   11-04   11-08       │  ← 绘图区列（网格/柱/悬停/日期刻度）
└──────────┴─────────────────────────────┘
```

| 层 | 名称 | 约束 |
|---|---|---|
| 纯函数 | `trendAxisTicks({ floor, max, metric, currency })` | 命中率顶档恒为 1；`floor > 0` 时返回三档，否则两档 |
| 纯函数 | `hitRateFloor(values)` | 排序后取首个正值作下限，全部为 0 时回落 0 |
| DOM | `token-dash-trend-axis-{top,mid,bottom}` | 刻度节点，`aria-hidden` |
| DOM | `token-dash-trend-plot-area` | 绘图区边界，供 E2E 校验轴在其之外 |
| 数据链 | `package.json#description` → npm registry → 「已安装」卡片 | 唯一维护源；市场「发现」页另走上游 YAML |

### 3.2 描述字段的取值来源（事实链）

```text
package.json#description ──(npm publish)──► registry metadata ──┐
                                                                ├─► 「已安装」卡片（manifest）
已装包 package.json ──(listBundles)──────────────────────────────┘
上游 data/plugins/*.yml ──► README.zh.md ──► build-site ──► 「发现」页
```

读法：本仓唯一可维护的是 `package.json#description`；「发现」页由上游 YAML 驱动，需另提 PR，两者互不自动同步。

## 四、不改动 / 边界（已确认）

- `BND-01`：不引入图表库，`dependencies` 保持为空。
- `BND-02`：132 / 18 / 36 三个既有尺寸常量不变；34px 轴宽被自适应取代属预期变更。
- `BND-03`：`src/` 与 `/usage` DTO 未改动。
- `BND-04`：上游目录文案不在本仓维护范围，仅提交 PR。

## 五、验收要点

| 项 | 来源 | 验证方式 | 结果 |
|---|---|---|---|
| 趋势图显示三档刻度且随指标变化 | REQ-01 / REQ-03 | `npm run e2e` | 通过 |
| 三条网格线可见 | REQ-02 | 目检 + E2E | 通过（`settings.png`） |
| 命中率底部档出现 | REQ-04 | 单测 + E2E | 通过 |
| 刻度在绘图区之外 | REQ-06 | E2E `axis.right <= plot.left` | 通过 |
| 命中率刻度取值合理 | REQ-07 | 单测 + 目检 | 通过（100% / 50% / 0%） |
| 明细表有分区标题 | REQ-08 | E2E 断言标题文本 | 通过 |
| 描述与能力一致 | REQ-09 | `npm view dsh-token-dash description` | 通过（含 4 家订阅） |
| 描述核对入流程 | REQ-10 | 读取 `release.md` 与 SKILL | 通过 |
| 三处文案一致 | REQ-11 | npm + 本地装包对读 | 通过 |
| 全量回归 | BND-01~04 | `npm test` + `npm run e2e` | 通过（140 pass / 0 fail，E2E 全绿） |

## 六、关键结论（可复用）

1. **轴与绘图区必须是两个布局单元**，不能靠绝对定位在同一个容器里“让出”空间——否则任何留白调整都会让刻度与柱体争位置。
2. **命中率轴的两条口径**（顶档固定 100%、下限忽略离群 0%）应写进规格，它们决定读图是否有参考价值。
3. **删渲染点必须同步删样式或注明隐藏**：`c41b9eb` 只删了 5 行渲染，样式与设计文档都留在原地，造成“文档说要画、代码没画”的长期不一致。
4. **三个展示面三个来源**：npm manifest / 上游 YAML / 本仓 README 互不自动同步，发版前必须逐处核对。
5. **`tr()` 未命中会静默回退为键本身**，新增文案必须同时进 `client.js` 内置 `EN` 与两个 locale json。

## 七、诊断锚点

- LogCategory：`vm`，前缀 `[TD:vm]`
- 趋势相关：`/usage` 的 `range / grain / points / seriesCurrencies` 可区分「无数据」与「补零过多」
- 发布相关：`npm view dsh-token-dash dist-tags --json` 在 publish 成功后约 90 秒才可见新版本，核验需轮询

## 八、遗留与去向

| 项 | 状态 | 去向 |
|---|---|---|
| 上游市场 PR #16877 | 已提交，待评审 | `awesome-dsh-plugin/awesome-dsh-plugin`，合并后自动重建发现页 |
| P2 浮层无趋势图 | 已核实无需处理 | `client.js` 仅一处趋势图渲染点 |
| 本地构建残留 | 已收敛 | `2.3.1-local.1` / `local.2` 已聚合进 `2.3.1` 正式块并删除 |

## 九、关联资料

- UI 规格：[`ui-design.md`](../../ui-design.md) §5.5（v3.18）
- 发布流程：[`release.md`](../../release.md) 正式发布第 3b 步
- 施工稿：[`trend-chart-yaxis-build-checklist.md`](../../checklist/archived/trend-chart-yaxis-build-checklist.md) · [`listing-description-release-build-checklist.md`](../../checklist/archived/listing-description-release-build-checklist.md)
- 发布记录：`v2.3.1`（[Release](https://github.com/spartawhy117/dsh-token-dash/releases/tag/v2.3.1)）
- 市场 PR：[#16877](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/16877)
