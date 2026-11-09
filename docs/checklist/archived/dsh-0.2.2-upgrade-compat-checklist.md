# DSH 0.2.2 升级兼容评估 checklist

> 状态：已归档（S0–S3 完成；升级已在实机验证通过，未改代码）<br>
> 评估对象：DSH `0.2.1-rc.5` → `v0.2.2-rc.1`（2026-11-04 发布）<br>
> 结论：**兼容，已实机验证**（现网 DSH `0.2.2-rc.1` / 插件 `2.0.2`）<br>
> 依据：官方 GitHub Releases（[`deepseek-ai/deepseek-harness`](https://github.com/deepseek-ai/deepseek-harness/releases)）、`docs/design.md` §关键设计决策 15、插件运行日志<br>
> 生命周期：已归档至 `docs/checklist/archived/`

## 一、阶段总览

| 阶段 | 内容 | 状态 |
|---|---|---|
| S0 | 版本与发布说明核对 | 完成 |
| S1 | 插件 API 使用面与破坏性变更对照 | 完成 |
| S2 | 升级后冒烟 / 回归验证 | 完成（实机通过） |
| S3 | 升级 / 回滚决策 | 完成：升级并保留回滚路径 |

## 二、交付事实

| 项 | 值 | 证据 |
|---|---|---|
| 评估前 DSH | `0.2.1-rc.5`（exe `0.2.1.0`） | `DeepSeek Harness.exe` 版本信息 |
| 目标 / 现网 DSH | `v0.2.2-rc.1`（exe `0.2.2.0`） | exe `FileVersion = 0.2.2-rc.1` |
| 中间版本 | `v0.2.2-alpha.3` | GitHub Releases，2026-11-03 |
| Node 最低要求 | **24.9** | 0.2.2-alpha.2 / rc.1 release notes |
| Cordis | Core `4.0.0-rc.11`、Loader `1.0.0-rc.8`、Include `1.1.1` | alpha.3 release notes |
| 插件 engines | `>=20`（未变动） | `package.json` |
| 插件版本 | `2.0.2`（评估期 `1.3.0-local.9`） | profile `package.json` |
| 插件宿主 API | `ctx.effect`、`ctx.inject(sessionPersistence/webServer)`、`ctx.on('session/event')`、`webServer.register`、`slots.inject`、`locale`、`layout`、`credentials`、`deepseekAccount` | `index.js` / `client.js` / `src/collect.js` |

## 三、升级注意点与影响

| # | 0.2.2 变更 | 对本插件的影响 | 等级 | 实测结论 |
|---|---|---|---|---|
| 1 | 最低 Node.js 24.9 | 插件运行在宿主内，不单独要求；`engines >=20` 保留 | 中 | 无影响（安装包自带运行时） |
| 2 | Cordis Core/Loader/Include 升级 | 依赖 `ctx.effect / inject / on` 与 `webServer.register` | **高** | 通过 |
| 3 | Session API 独立拆分、Projection 注册改异步 | `backfill` 用 `sessionPersistence.list/open` | **高** | 通过（无 `degraded`） |
| 4 | 插件安装失败诊断 / 启用失败区分 | 不影响运行 API | 低 | 无影响 |
| 5 | 工具执行拆分、`tools.mode` 迁移、`agent.model` 固定 | 插件不定义工具、不调用 `agent/request` | 无 | 不涉及 |
| 6 | Node PTC / apply_patch / worktree 插件合并 | 插件均未使用 | 无 | 不涉及 |
| 7 | Web Fetch 不再拒绝非公网地址 | 用原生 `fetch` 访问 provider | 无 | 不涉及 |
| 8 | 设置页导航图标、动态请求头 | 插件无独立设置页 | 低 | 无影响 |
| 9 | 官方组合包 / profile bundle 变化 | 走 profile `dsh.profile.bundles` 安装 | 中 | 通过（插件仍在列表） |
| 10 | 客户端 `__ModuleLoader__` / slots | P1/P2/P3 是否挂载必须实测 | **高** | 通过 |

## 四、验证结果（S2 实测）

P0 全部通过，证据均为现网运行日志与 profile 实测：

| # | P0 项 | 结果 | 一句话证据 |
|---|---|---|---|
| 1 | 插件出现在 profile 列表且能启用 | ✅ | desktop `package.json` 依赖 `dsh-token-dash: 2.0.2` |
| 2 | P1 Pill、P2 浮层、P3 整页能挂载 | ✅ | 日志 `[TD:slot] mount.ok` 覆盖 main / sidebar.panellist / composer.dock |
| 3 | `/summary`、`/usage`、`/prefs` 正常返回 | ✅ | 日志 `[TD:vm] build` 86 次、`providers:2`，无 `route.failed` |
| 4 | `session/event` 实时记账正常 | ✅ | `daily.json` 当日有 tencent 真实 token 记录 |
| 5 | 7 家 adapter 未因升级全部 miss | ✅ | `[TD:adapter.deepseek] balance.ok` 持续输出，无 `probe.miss` |

P1 高风险项：`sessionPersistence.list/open`、`webServer.register({kind:'prefix'})`、`layout.selectPanel` / `slots.inject`、`credentials.resolve` / `deepseekAccount` 均实测可用；日志 `backfill.done` 4 次且 `degraded: null`。

## 五、风险清单（归档结论）

| 编号 | 风险 | 实测是否触发 | 处置 |
|---|---|---|---|
| R1 | 插件无法加载 | 否 | 保留回滚包 |
| R2 | 历史回填降级 | 否（`degraded: null`） | 已导出口径，回填正常 |
| R3 | 路由 404 | 否 | `vm.build` 正常 |
| R4 | 设置入口失效 | 否 | P3 可挂载 |
| R5 | 凭据解析失效 | 否 | `balance.ok` 正常 |
| R6 | Node 版本不满足 | 否 | 安装包自带运行时 |
| R7 | 升级覆盖 profile | 否 | 插件仍在列表且为 2.0.2 |
| R8 | 数据格式变化 | 否 | 新记录正常采集 |

## 六、升级验证步骤（已执行，保留供复验）

**AI 先行**

1. 备份 `$DSH_HOME/dsh-token-dash/` 与 desktop profile 的 `package.json` / lockfile；
2. 保存回滚包（评估期为 `build/dsh-token-dash-1.3.0-local.9.tgz`）；
3. 升级后检查 `dsh plugin --profile desktop list` 与安装版本；
4. 打开 P1/P2/P3，检查 `/summary` `/usage` `/prefs`；
5. 查看日志：`[TD:...]`、`provider.probe.miss`、`collect.backfill.degraded`、`adapter.*`；
6. 运行 `npm test` 与 `npm run e2e`；
7. 若 P0 失败，记录首个异常并停止，不继续改代码。

**你收尾**

1. 安装 DSH `0.2.2-rc.1`（先完全退出 DSH）；
2. 启动后确认版本号与插件仍在列表；
3. 截图 P1/P2/P3 与设置胶囊；
4. 回复暗号：`0.2.2 已启动，P0 通过/失败`。

## 七、移交 / 遗留

| 编号 | 内容 | 去向 |
|---|---|---|
| L1 | 未在 0.2.2-rc.1 实测 | **已关闭**：S2 实机通过 |
| L2 | OpenCode / Command Code 真机 Key 未验证 | 后续 provider 验收（不阻塞升级） |
| L3 | `engines >=20` 与 README Node 声明 | **已处置**：README 已声明 `0.2.1+ / Node 24.9+`；`engines >=20` 保留（宿主内运行） |
| L4 | 并发 `/summary` 重复刷新 | 仍存在，可选小修复，不阻塞 |

## 八、施工提醒

- 升级前先备份 profile 与回滚包，不要直接原地升级；
- 升级后先看插件是否还在 `dsh.profile.bundles`，再看 UI；
- 若只有历史数据缺失、实时正常，优先判 R2，不要回滚整个 DSH；
- 兼容修复必须先写 plan / checklist，不在清单里直接改代码；
- Node 24.9 是 DSH 自身要求，升级前确认安装包自带运行时。

## 九、plan 回写候选（已处置）

| # | 候选 | 状态 |
|---|---|---|
| 1 | S2 通过后更新 README 兼容范围与 engines | **已完成**：README / README.en 已声明 `0.2.1+`、`0.2.2-rc.1` 已验证、Node 24.9 |
| 2 | 若 `sessionPersistence` 变化则新建 compat plan | **不适用**：接口未变，未新建 |
| 3 | 若 Loader/slots 变化则新建 compat plan | **不适用**：未出现破坏 |
| 4 | 升级结论回写 `docs/design.md` 兼容性说明 | **已完成**：§关键设计决策 15「DSH 0.2.2 兼容基线」 |

## 十、执行日志

| 时间 | 轮次 | 结果 |
|---|---|---|
| 2026-11-05 | S0 | 读取本机 `0.2.1-rc.5`、官方 `v0.2.2-rc.1` release notes、Node 24.9 / Cordis 升级项 |
| 2026-11-05 | S1 | 对照插件宿主 API：高风险为 SessionPersistence、Cordis Loader/slots；工具/PTC/Web Fetch 不涉及 |
| 2026-11-05 | 决策 | 仅评估，不升级、不改代码；等待 S2 |
| 2026-11-09 | S2 | 实机验证通过：现网 `0.2.2-rc.1` + 插件 `2.0.2`，P0 五项全过，无 `degraded` / `probe.miss` / `route.failed` |
| 2026-11-09 | 归档 | 压缩归档；回写候选 #1 / #4 已落地，#2 / #3 判为不适用 |
