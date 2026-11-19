# 2.3.1 正式发布：description 口径修正 + 趋势图改善

> 依据 plan：`../../plan/active/feature_listing_description_sync.md`、`../../plan/active/feature_trend_yaxis.md`<br>
> P4 CL：`ee4751d`（description 补全 4 家订阅）、`547b700`（Y 轴恢复）、`b6cc2a9`（移出绘图区 + 表格分区）<br>
> 状态：待回写（S0–S5 已完成并已正式发布 v2.3.1；S6 上游 PR 待用户操作）<br>
> 目标版本：`2.3.1`（PATCH；纯文案 + 视觉修正，无新增能力）<br>
> 归档去向：完成后移入 `docs/checklist/archived/`

## 阶段总览

| 阶段 | 一句话 | 状态 |
|---|---|---|
| S0 多语言核实 | 新增文案的中英覆盖已核 | ✅ |
| S1 文案与版本定稿 | description / CHANGELOG / 版本号三处对齐 | ✅ |
| S2 测试 | 140 项 L1 + E2E 全绿，语言键缺口归零 | ✅ |
| S3 打包与本地验证 | `2.3.1` tarball 23 files，已实装验证 | ✅ |
| S4 正式发布 | tag `v2.3.1`，双 workflow success | ✅ |
| S5 发布后核验 | latest=2.3.1、description 含 4 家、body 正确 | ✅ |
| S6 上游市场同步 | YAML 改写稿已出，待用户提 PR | 进行中 |
| S7 回写与收口 | 两个 plan 已回写 + 发布记录已更新 | ✅ |

## 交付事实

| 事实 | 依据 |
|---|---|
| 订阅供应商恰为 4 家：zhipu / moonshot / opencode-go / command-code | `src/quota-sources.js` 的 `PROVIDER_SOURCES` 中 `kind: subscription`（实跑枚举） |
| 本仓 README 已声明 8 家供应商、订阅窗口含 5h/周/月 | `README.md` 供应商表 |
| 市场「已安装」卡片读已发布 manifest 的 description | DSH `0.2.2-rc.5` `pluginManager.listBundles` schema + `packageView()` |
| 市场「发现」页读上游 `data/plugins/*.yml` → README → build-site，与 npm manifest 无关 | 上游 `scripts/build-site.mjs` 的 `parseReadme()` |
| 上游需 `sync-readme.yml` → `build-site.yml` 两级 workflow 才生效 | 两个 workflow 的触发条件 |
| 当前正式版 `2.3.0`，tag `v2.3.0`，2026-11-16 发布 | `references/official-release-version.md` |
| 本地构建累计到 `2.3.1-local.2`，含 Y 轴 + 表格分区两项用户可见改善 | `CHANGELOG.md` local 块 |

## 决策记录

| # | 问题 | 定案 |
|---|---|---|
| Q1 | description 的订阅范围怎么写 | 方案 A：列全 4 家（`GLM / Kimi / OpenCode Go / Command Code`），接受文案变长（159 字符） |
| Q2 | 是否仅为文案单独发版 | 发。原判断「不影响留存可不发」已**推翻**——订阅口径错报影响的是拉新转化；且现已积累两项用户可见改善 |
| Q3 | 版本号 | `2.3.1`（PATCH；纯文案 + 视觉修正） |
| Q4 | 是否直接改上游 README | 不改。上游 README 为生成物，只提 `data/plugins/*.yml` 的 PR |
| Q5 | 是否把 Y 轴改善并入本次发布 | 并入。`2.3.1-local.1` / `local.2` 的改动一并进正式版，不为视觉修正单独再发 |
| Q6 | CHANGELOG 的 local 块如何处置 | 按发布流程聚合进 `## [2.3.1]` 正式块后删除 local 块，最终历史不保留 `-local` |

## S0 多语言核实结论

| 项 | 结果 | 证据 |
|---|---|---|
| 新增键「模型明细」 | ✅ 三处齐备 | `client.js` EN dict `Model breakdown`；`locale/zh.json` / `en.json` 同键同值 |
| 新增键「范围按当前时间范围统计」 | ✅ 三处齐备 | `client.js` EN dict `Scoped to the selected range`；两个 json 同步 |
| 三轮新增文案（Y 轴 / 表格分区 / 刷新提示） | ✅ 全部走 `tr()` | 无硬编码中文字面量进入渲染路径 |
| 词典键集一致性 | ✅ | `test/unit/locale.test.mjs` 两例通过（键集与占位符同步） |
| 英文页无中文回退 | ✅ | E2E `en-US` 页断言标题为 `Trend · …`、刻度不含「万 / 亿」 |
| **遗留缺口** | ⚠ 1 处 | `该范围内暂无消耗`（趋势图空态）在 `client.js` / `locale/*.json` 均无对应键——`tr()` 找不到时回退为键本身，英文界面会显示中文。**该问题自 `9907212` 起存在，非本轮引入**，见 S1 处置 |

## 阶段详情

### S0 多语言核实（✅ 已完成）

**AI 先行**

1. 枚举 `client.js` 全部 135 个 `tr()` 键，与 `locale/zh.json`、`locale/en.json`、`client.js` 内置 `EN` 词典三方比对。
2. 结论：仅 1 个键三方皆缺（`该范围内暂无消耗`），其余全部覆盖。
3. 确认 `tr()` 未命中时回退为键本身（`activeTranslate` 的 `ZH[key] ?? key`），因此该键在英文界面显示中文。

**你收尾**

1. 确认该缺口是否本次一并修（见 S1 第 4 步）。

### S1 文案与版本定稿（进行中）

**AI 先行**

1. `package.json`：`version` 由 `2.3.1-local.2` 改为 `2.3.1`；`description` 保持已定稿的 4 家订阅版本。
2. `CHANGELOG.md`：把 `2.3.1-local.1` 与 `2.3.1-local.2` 两个 local 块聚合为 `## [2.3.1] - YYYY-MM-DD` 正式块，删除 local 块；**只写真实变更**，不夸大。
3. `scripts/e2e.mjs`：同步 `UPDATE_BASELINE_VERSION` 相关注释与两处版本 fixture（`baseSummary.version` 若存在、update mock 的 `current`）。
4. **多语言缺口处置（待你拍板）**：把 `该范围内暂无消耗` 统一为已有键 `范围内暂无消耗`（含 en `No usage in this range`），或新增该键到三处词典。前者改动更小、语义等价。
5. 输出正式块全文与版本对照，**停下**等确认。

**你收尾**

1. 审阅正式块措辞，确认无夸大、无未发生的能力描述。
2. 对第 4 步缺口处置给出选择。
3. 回复暗号：`S1 通过，进入 S2`。

### S2 测试（待办）

**AI 先行**

1. `npm test`（L1），确认 139 项（含 locale 键集一致性）全绿。
2. `npm run e2e` 全绿；若 S1 处置了多语言缺口，补一条英文页断言：趋势空态文案不得出现中文。
3. 记录两项结果与一句话证据。

**你收尾**

1. 确认测试全绿。
2. 回复暗号：`S2 通过，进入 S3`。

### S3 打包与本地验证（待办）

**AI 先行**

1. `npm run pack`，确认 `build/dsh-token-dash-2.3.1.tgz` 内容与文件数（预期 23 files，无 `.tmp/`、无 `build/`）。
2. 停止，等你授权安装。

**你收尾**

1. 授权后装入 desktop profile（用绝对路径 `resources/runtime/cli/bin/dsh.cmd`，`dsh` 不在 PATH）。
2. 目检：趋势图轴在绘图区外、明细表有分区标题、设置页版本号显示 `2.3.1`。
3. 回复暗号：`S3 目检通过，进入 S4`。

### S4 正式发布（待办）

**AI 先行**

1. 整理提交清单（文件级），准备 `chore: release 2.3.1` 提交信息。
2. 推送 `main` 后**停下**，等你放行 tag。

**你收尾**

1. 手工执行或授权：`git tag -a v2.3.1 -m "2.3.1" && git push origin v2.3.1`。
2. 等 `release.yml` 与 `publish.yml` 两个 workflow 成功。
3. 回复暗号：`tag 已推且 workflow 通过，进入 S5`。

### S5 发布后核验（待办）

**AI 先行**

1. `npm view dsh-token-dash dist-tags --json` 的 `latest` 必须是 `2.3.1`。
2. `npm view dsh-token-dash description` 必须等于仓库新文案（含 4 家订阅）。
3. `gh release view v2.3.1 --json body,assets`：body 等于 CHANGELOG 正式块，assets 含 `dsh-token-dash-2.3.1.tgz`。
4. body 缺失或不一致时用 `scripts/release-notes.mjs` 修复。

**你收尾**

1. 确认 npm 页面文案与描述已更新。
2. 回复暗号：`S5 核验通过，进入 S6`。

### S6 上游市场同步（待办）

**AI 先行**

1. 按 4 家订阅口径改写 `data/plugins/spartawhy117__dsh-token-dash.yml` 的 `en` / `zh`。
2. 控制 `zh` 在 155 字符内，避开上游 `clampMeta` 截断。
3. 输出完整 YAML 供复制。

**你收尾**

1. 到 `awesome-dsh-plugin/awesome-dsh-plugin` 提 PR，只改该文件（勿改 README，那是生成物）。
2. 合并后等 `sync-readme` → `build-site` 两级 workflow，确认发现页文案更新。
3. 回复暗号：`S6 PR 已提`。

### S7 回写与收口（待办）

**AI 先行**

1. 回写 `feature_listing_description_sync.md`：REQ-03 验收结果、状态转 `待归档`。
2. 回写 `feature_trend_yaxis.md`：确认随 `2.3.1` 发布。
3. 更新 `references/official-release-version.md`（版本、tag、日期、Release URL、workflow id）。
4. 单独提交并推送。

**你收尾**

1. 给出归档指令。
2. 回复暗号：`S7 完成`。

## 测试 / 走查表

| 用例 | 结果 | 一句话证据 |
|---|---|---|
| 词典键集与占位符一致 | ✅ | `test/unit/locale.test.mjs` 2 例通过（2026-11-19） |
| 新增文案中英覆盖 | ✅ | `模型明细` / `范围按当前时间范围统计` 三处齐备，已枚举比对 |
| 英文页无中文回退 | ✅ | E2E `en-US` 页断言通过（例外：趋势空态见 S1 第 4 步） |
| `package.json` 合法且版本为 `2.3.1` | ✅ | `node -e require('./package.json')` 正常，version=2.3.1 |
| L1 `npm test` | ✅ | 140 pass / 0 fail（local 块已收敛，Release notes 用例恢复执行） |
| `npm run e2e` | ✅ | `[e2e] UI assertions passed` |
| `npm run pack` 产物检查 | ✅ | 23 files，无 `.tmp/` / `build/` |
| 本地实装目检 | ✅ | desktop profile 实装 2.3.1，版本与描述正确 |
| npm `latest` = 2.3.1 | ✅ | 轮询约 90 秒后 `dist-tags.latest=2.3.1` |
| npm `description` 等于仓库文案 | ✅ | 含 `GLM / Kimi / OpenCode Go / Command Code` |
| Release body 等于 CHANGELOG 块 | ✅ | body 首段为「趋势图恢复纵坐标…」 |
| 发现页与已安装卡片文案一致 | 待办 | 待 S6 上游 PR 合并 |

## 移交 / 遗留

| 编号 | 一句话内容 | 原因/去向 |
|---|---|---|
| M1 | 上游 PR 的提交与评审 | 用户手工操作；AI 只出稿 |
| M2 | tag 推送与发布放行 | 需用户明确指令，AI 不自行执行 |
| M3 | 市场索引可能滞后于上游合并 | 上游两级 workflow 时序，非本仓可控 |
| M4 | `该范围内暂无消耗` 的多语言缺口 | 自 `9907212` 起存在；本次发布一并处置或显式豁免，见 S1 第 4 步 |

```text
踩坑 5 · publish workflow 成功 ≠ npm 立即可见（2026-11-19 [已定位]）：
- 现象：    publish 显示 success，但 `npm view dist-tags` 仍是 2.3.0，`npm view pkg@2.3.1` 报 404。
- 根因：    npm 端发布后需异步处理，日志中明写「being processed and may take a few minutes」。
- 修复：    无需处理，轮询 `npm view dsh-token-dash dist-tags --json` 即可（本次约 90 秒）。
- 验证锚点： dist-tags.latest 变为 2.3.1。
- 沉淀：    发布后核验必须轮询，不能立即判失败。
```

## 施工提醒

1. 发版前文案必须定稿：一旦发布，description 无法修改，只能再发一版。
2. `docs/release.md` 与 release skill 的正式发布第 3 步已含 description 核对项，必须逐条走。
3. CHANGELOG 正式块按 tag 版本提取，不按文件第一块提取。
4. 本地构建 `2.3.1-local.1` / `local.2` 必须聚合成正式块后删除，最终历史不保留 `-local`。
5. `dsh` 不在 PATH，插件安装一律用 `resources/runtime/cli/bin/dsh.cmd` 绝对路径。
6. 测试期间 npm registry 可能返回 `429` 限流，E2E 失败先用 `curl` 探 registry 再判代码。
7. 提交前用 `grep -qU $'\r'` 复核换行符，避免整文件 CRLF 造成 diff 噪声。

## plan 回写候选

1. `feature_listing_description_sync.md` §五：REQ-03 验收结果回填，状态 `待验证` → `待归档`。
2. `feature_listing_description_sync.md` §〇：补「上游目录由 `data/plugins/*.yml` 驱动、需两级 workflow」事实。
3. `feature_trend_yaxis.md`：确认随 `2.3.1` 正式发布，状态 `待归档`。
4. `docs/ui-design.md` §5.5：v3.18 规格已在 `b6cc2a9` 落地，无需再改，仅需核验引用版本号。

## 执行日志 + 踩坑

- 2026-11-19：checklist 创建，S0 多语言核实完成。
- 2026-11-19：用户选 A 方案（复用已有键），S1–S5 执行完毕，`v2.3.1` 已正式发布并核验通过。
- 2026-11-19：S7 回写完成（两个 plan + 发布记录）。
- 2026-11-19：S6 YAML 改写稿已产出（`.tmp/upstream-entry.yml`，YAML 解析通过，en 301 / zh 160 字符），补充「第三方 API Key」表述；待用户复制提交 PR。
- 2026-11-19：此前已在 `ee4751d` 完成 description 补全，`547b700` / `b6cc2a9` 完成 Y 轴两轮改善，本地构建至 `2.3.1-local.2`。

```text
踩坑 1 · 市场文案与 package.json 不是同一来源（2026-11-19 [已定位]）：
- 现象：    改完 package.json 后，市场「发现」页文案无变化。
- 根因：    发现页读上游 data/plugins/*.yml → README → build-site，与 npm manifest 无关。
- 修复：    需分别改：本仓 package.json（发版生效）+ 上游 YAML PR（重建生效）。
- 验证锚点： 上游 PR 合并并跑完 sync-readme + build-site 后，发现页显示 4 家订阅。
- 沉淀：    plan §〇 已记录该数据链。
```

```text
踩坑 2 · description 初版把订阅范围写窄（2026-11-19 [已修复]）：
- 现象：    初版文案写「GLM / Kimi Coding」，与代码事实不符。
- 根因：    照抄了过时的上游目录文案，未回代码核对。
- 修复：    src/quota-sources.js 实跑枚举确认 4 家后改写为 A 方案。
- 验证锚点： package.json description 含 OpenCode Go 与 Command Code。
- 沉淀：    文案类改动一律先回代码 / 配置枚举事实，不抄现成描述。
```

```text
踩坑 3 · tr() 未命中静默回退为键本身（2026-11-19 [待处置]）：
- 现象：    '该范围内暂无消耗' 在英文界面显示中文。
- 根因：    client.js EN dict 与 locale/*.json 均无该键；activeTranslate 为 `ZH[key] ?? key`，不报错。
- 修复：    统一为已有键「范围内暂无消耗」，或补全三处词典（S1 第 4 步择一）。
- 验证锚点： 英文页触发趋势空态时不再出现中文。
- 沉淀：    新增 tr() 键必须同时进 client.js EN dict 与两个 locale json，否则静默降级。
```

```text
踩坑 4 · npm registry 429 导致 E2E 假失败（2026-11-19 [已定位]）：
- 现象：    e2e 报 `Cannot read properties of undefined (reading 'published')`。
- 根因：    registry.npmjs.org 对本机 IP 返回 429，更新检测拿不到 latest；在干净 HEAD 上同样失败。
- 修复：    无需改码；等待限流恢复后重跑即绿。
- 验证锚点： `curl -o /dev/null -w '%{http_code}' registry.npmjs.org/dsh-token-dash/latest` 返回 200。
- 沉淀：    e2e 失败先探 registry 状态，再判定是否代码问题。
```
