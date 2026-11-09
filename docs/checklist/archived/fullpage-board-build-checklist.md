# 整页看板施工稿（S0–S6）

> 状态：已归档（S0–S6 全部落地，测试通过；用户 2026-11-04 指令归档）<br>
> 上游方案：[`feature_fullpage_board.md`](../../plan/archived/feature_fullpage_board.md)（第 2 版）<br>
> 关联契约：[`ui-design.md`](../../ui-design.md) v3.1、归档清单 [`ui-reference-checklist.md`](../archived/ui-reference-checklist.md)、[`backend-capability-checklist.md`](../archived/backend-capability-checklist.md)<br>
> 目标版本：`1.2.0-local.2`（本地构建，不 tag、不发布）

## 一、阶段与改动映射

| 阶段 | 内容 | 改动项 | 完成判据 | 结果 |
|---|---|---|---|---|
| S0 | 公共件 | CHG-01/02/03/24 | 三页可调用；旧行为不变；`npm test` 绿 | 完成 |
| S1 | P3 骨架 | CHG-04/19/22/23 | 侧栏入口 + 中栏整页 + `更新于`/`⟳` 可用 | 完成 |
| S2 | 设置迁移 | CHG-10/20/06a/17a | 三行设置可在 P3 操作；P2 无 tab | 完成 |
| S3 | P2 收敛 | CHG-06b/06c/12/21/17b | 面板 280–480、无进度条、三路关闭 | 完成 |
| S4 | P3 数据区 | CHG-07/08/09/11/13/14/17c | 两表分流、两卡分行、编辑即时回写 | 完成 |
| S5 | P1 | CHG-05/15/16/17d | 三态环、切模型跟随、可见性暂停 | 完成（投影与隐藏态未自动覆盖） |
| S6 | 脚本与文档 | CHG-18/25/26 | `npm run shots` 可跑；README/design 同步 | 完成 |

## 二、测试计划

| 层 | 命令 | 覆盖 | 结果 |
|---|---|---|---|
| L1 | `npm test` | host 侧聚合、备份、locale 词典 | 76 项：75 通过 / 1 跳过（local 跳过 Release notes） |
| L2+L3 | `npm run e2e` | 真实宿主 + Playwright：P1/P2/P3、编辑、空态、窄屏、暗色 | 全绿 |
| 脚本 | `npm run shots` | README 截图可重新生成 | 已重生成 `panel-api` / `panel-sub-2` / `panel-sub-3` / `settings` / `pill-*` |
| 打包 | `npm run pack` | `build/dsh-token-dash-1.2.0-local.2.tgz` | 待执行 |

## 三、执行日志

| 时间 | 阶段 | 结果 |
|---|---|---|
| 2026-11-04 | 建稿 | 按方案第 2 版启动施工 |
| 2026-11-04 | S0–S4 | 公共件、整页骨架、设置三行、P2 四列、两表与编辑全部落地 |
| 2026-11-04 | S5 | P1 环 / 三窗 / 三级取值（账本兜底）/ 可见性轮询落地 |
| 2026-11-04 | 调试 | 预算编辑保存改为以输入框当前值为准（受控 state 时序问题）；E2E 改为原生 setter + 事件派发（headless 无系统焦点） |
| 2026-11-04 | 测试 | `npm test` 75 pass / 1 skip；`npm run e2e` 通过；`npm run shots` 通过 |
| 2026-11-04 | S6 | README / README.en / design.md / ui-design §5.1 同步；截图重生成 |
| 2026-11-04 | 收口 | star chip 改为纯 GitHub 跳转（不再请求 `/repo`，原 B15 依赖作废）；E2E 断言同步；方案稿按 plan skill 精简到 227 行 |

## 四、偏差与遗留

| 项 | 说明 |
|---|---|
| 投影取值 | 宿主 `useProjection('modelSelection')` / `agentDefaultModel` 在测试环境不可用，代码走防御式降级到账本值；B14 上线后自动生效 |
| star chip | 按最终要求改为纯跳转：恒显示 `★`，不请求 `/repo`、不显示计数；后端 B15 可不再实施 |
| 页面隐藏态 | `visibilitychange` 已实现；E2E 无法模拟 `document.hidden`，仅验证恢复可见立即刷新 |
| E2E 输入 | headless 窗口拿不到系统焦点，预算输入改用原生 setter + `KeyboardEvent` 派发 |
| 截图 | 整页看板以 `zoom: .72` + 胶囊静态化截图，避免滚动容器裁剪 |
| 浮层范围 | 关闭再打开回到「当天」默认值（沿用原行为，未持久化） |

## 五、回写去向

- 需求结论 → `docs/plan/archived/feature_fullpage_board.md` §五 验收结果。
- 复用知识 → `docs/knowledge/`（宿主 `main` / `sidebar.panellist` 注册与 `selectPanel` 抛错口径）。
- 版本记录 → `CHANGELOG.md` 顶部 `[1.2.0-local.1]`。
