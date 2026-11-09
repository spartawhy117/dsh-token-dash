# 看板卡片化施工 checklist

> 状态：已归档（S0–S4 完成，随 plan 归档）<br>
> 方案：[`feature_board_cards_redesign.md`](../../plan/archived/feature_board_cards_redesign.md)<br>
> 设计：`ui-design.md` v3.2、[`board-visual-review-checklist.md`](board-visual-review-checklist.md)<br>
> 完成版本：`1.3.0-local.7`（2026-11-05）

## 一、阶段结果

| 阶段 | 内容 | 结果 |
|---|---|---|
| S0 | 四组件 | `ProgressRing` / `PercentValue` / `InlineRing` / `QuotaGauge` 落地，旧页面行为不变 |
| S1 | P1 Pill | 14/2 内联环、三色、最多 3 窗、SVG 箭头、空态 `--` |
| S2 | P2 浮层 | 固定 380、单行摘要、满宽范围条、订阅三槽位、表格右对齐 |
| S3 | P3 整页 | 两区卡片、摘要带、明细底框、三行胶囊、自持滚动 |
| S4 | 脚本与文档 | e2e 全绿、`shots` 重出、README / CHANGELOG / ui-design 同步 |

## 二、测试矩阵

| 层 | 命令 | 结果 |
|---|---|---|
| L1 | `npm test` | 75 通过 / 1 跳过 / 0 失败 |
| L2+L3 | `npm run e2e` | 通过：环同色、P2 固定 380、数值右缘、胶囊两组、滚动 |
| 预览 | `npm run preview page-p1/p2/p3` | 已目检 |
| 截图 | `npm run shots` | 已重出 `docs/pic/` |
| 打包 | `npm run pack` | 已出 `1.3.0-local.7.tgz` 并安装 |

## 三、偏差

| 计划 | 实际 | 原因 |
|---|---|---|
| P2 `fit-content` 280–480 | 固定 380 | 宿主中栏窄，自适应会留白 / 跳宽 |
| 胶囊三组含立即刷新 | 两组：间隔左 / 余额右 | 刷新按钮冗余 |
| 明细模型列 1.6fr | ≤240 + 数值 1fr / 13px | 模型名挤压数字 |
| P3 由宿主滚动 | `board-scroll` 自持滚动 | 宿主 main 无可见滚动条 |

## 四、执行日志

| 时间 | 阶段 | 结果 |
|---|---|---|
| 2026-11-04 | 建稿 | 设计冻结，按 S0–S4 启动 |
| 2026-11-04 | S0–S3 | 四组件、P1/P2/P3 卡片化、摘要带与胶囊落地 |
| 2026-11-04 | S4 | e2e 改卡片结构，截图重出，版本 `1.3.0-local.1` |
| 2026-11-05 | 反馈 | P2 固定 380、表格右对齐、P3 页头/胶囊、滚动与列宽四项收口 |
| 2026-11-05 | 收口 | `npm test` 75 通过、e2e 通过，`1.3.0-local.7` 安装 |

## 五、回写去向（已完成）

- 施工结论 → 归档 plan §一 / §二 / §三；
- 设计变更 → `ui-design.md` §2.7 / §4 / §5.5 / §5.7 / §5.8；
- 版本记录 → `CHANGELOG.md` 1.3.0-local.1 ~ local.7；
- 遗留：无。
