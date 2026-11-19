# 2.3.1 发布：description 口径修正 + 市场文案对齐

> 依据 plan：`../../plan/active/feature_listing_description_sync.md`<br>
> P4 CL：`ee4751d`（description 补全 4 家订阅供应商）、`49d301c`、`62d7c1a`<br>
> 状态：待批准（未批准前不执行任何发布动作）<br>
> 归档去向：完成后移入 `docs/checklist/archived/`

## 阶段总览

| 阶段 | 一句话 | 状态 |
|---|---|---|
| S1 文案定稿 | 三个展示面的文案口径统一为「4 家订阅」 | 进行中 |
| S2 CHANGELOG | 写 2.3.1 正式块（中英双语），预览待确认 | 待办 |
| S3 测试与打包 | L1 + E2E 全绿，pack 出 tarball | 待办 |
| S4 提交与 tag | 提交发布、推 tag、双 workflow 上线 | 待办 |
| S5 核验 | npm latest / description / Release body 三项核验 | 待办 |
| S6 上游市场 | 提 PR 改 `data/plugins/*.yml`，让发现页同步 | 待办 |
| S7 回写与收口 | plan 验收回填 + 正式发布记录更新 | 待办 |

## 交付事实

| 事实 | 依据 |
|---|---|
| 订阅供应商恰为 4 家：zhipu / moonshot / opencode-go / command-code | `src/quota-sources.js` 的 `PROVIDER_SOURCES` 中 `kind: subscription`（2026-11-19 实跑枚举） |
| 本仓 README 已声明 8 家供应商、订阅窗口含 5h/周/月 | `README.md` 供应商表 |
| 市场「已安装」卡片读已发布 manifest 的 description | DSH `0.2.2-rc.5` `pluginManager.listBundles` schema + `packageView()` |
| 市场「发现」页读上游 `README.zh.md`，源头是 `data/plugins/*.yml` | 上游 `scripts/build-site.mjs` 的 `parseReadme()`；本条目文件 `data/plugins/spartawhy117__dsh-token-dash.yml` |
| 上游不读本仓 `package.json`；YAML 内无任何指向 npm manifest 的字段 | 已读取该 YAML 全文 |
| 上游 `dsh-plugin-catalog` npm 包自动生成、不接受 PR；真正源仓库是 `awesome-dsh-plugin/awesome-dsh-plugin` | 该包 README 自述 |
| 上游合并后需 `sync-readme.yml` → `build-site.yml` 两级 workflow 才生效 | 两个 workflow 的触发条件 |
| 当前正式版 `2.3.0`，tag `v2.3.0`，2026-11-16 发布 | `references/official-release-version.md` |

## 决策记录

| # | 问题 | 定案 |
|---|---|---|
| Q1 | description 的订阅范围怎么写 | 方案 A：列全 4 家（`GLM / Kimi / OpenCode Go / Command Code`），接受文案变长 |
| Q2 | 是否仅为文案单独发版 | 发。理由：能力口径对外错报 2 家，属对外信息失准，非排版问题 |
| Q3 | 版本号 | `2.3.1`（PATCH；纯文案 / 元数据，无功能改动） |
| Q4 | 是否直接改上游 README | 不改。上游 README 为生成物，只提 `data/plugins/*.yml` 的 PR |
| Q5 | 早期判断「发版不影响留存可直接不发」 | 已推翻：订阅口径错误影响的是拉新转化，不是留存 |

## 阶段详情

### S1 文案定稿（进行中）

**AI 先行**

1. `package.json#description` 已更新为 4 家订阅版本（`ee4751d`）。
2. 核对 `README.md` / `README.en.md` 顶部一句话与供应商表，确认与 4 家订阅一致。
3. 核对 `docs/pic/` 市场截图（`panel-sub-2.png` / `panel-sub-3.png`）是否已反映 4 家订阅卡片。
4. 输出三处文案的最终对照表供审阅。

**你收尾**

1. 确认 description 文案可用（长度 159 字符是否接受）。
2. 确认截图是否需要重拍。
3. 回复暗号：`S1 定稿，进入 S2`。

### S2 CHANGELOG（待办）

**AI 先行**

1. 在 `CHANGELOG.md` 顶部新增 `## [2.3.1] - YYYY-MM-DD`，中英双语。
2. 只写真实变更：description 口径修正、补全 4 家订阅、e2e 断言不再钉死历史版本号。
3. 输出正式块全文预览，**停下**等确认。

**你收尾**

1. 审阅正式块措辞，确认无夸大。
2. 回复暗号：`S2 通过，进入 S3`。

### S3 测试与打包（待办）

**AI 先行**

1. 同步 `scripts/e2e.mjs` 需要跟版本的地方（`UPDATE_BASELINE_VERSION` 与相关注释）。
2. 运行 `npm test`（L1）与 `npm run e2e`。
3. `npm run pack`，确认 `build/dsh-token-dash-2.3.1.tgz` 内容不含 `.tmp/`、`build/`。

**你收尾**

1. 确认 tarball 大小与文件清单。
2. 回复暗号：`S3 通过，进入 S4`。

### S4 提交与 tag（待办）

**AI 先行**

1. 整理提交清单（文件级），准备 `chore: release 2.3.1` 的提交信息。
2. 推送 `main` 后**停下**，等你放行 tag。

**你收尾**

1. 手工执行或授权：`git tag -a v2.3.1 -m "2.3.1" && git push origin v2.3.1`。
2. 回复暗号：`tag 已推，进入 S5`。

### S5 核验（待办）

**AI 先行**

1. `npm view dsh-token-dash dist-tags --json` 的 `latest` 必须是 `2.3.1`。
2. `npm view dsh-token-dash description` 必须等于仓库新文案。
3. `gh release view v2.3.1 --json body,assets`：body 等于 CHANGELOG 块，assets 含 tarball。
4. body 缺失时用 `scripts/release-notes.mjs` 修复。

**你收尾**

1. 确认 npm 页面文案已更新。
2. 回复暗号：`S5 核验通过，进入 S6`。

### S6 上游市场（待办）

**AI 先行**

1. 按 4 家订阅口径改写 `data/plugins/spartawhy117__dsh-token-dash.yml` 的 `en` / `zh` 两段。
2. 控制 `zh` 在 155 字符内，避开上游 `clampMeta` 截断。
3. 输出完整 YAML 供你复制。

**你收尾**

1. 到 `awesome-dsh-plugin/awesome-dsh-plugin` 提 PR，只改上述一个文件。
2. 合并后等两级 workflow 跑完，确认发现页文案更新。
3. 回复暗号：`S6 PR 已提`。

### S7 回写与收口（待办）

**AI 先行**

1. 回写 plan：REQ-03 验收结果、状态转 `待归档`。
2. 更新 `references/official-release-version.md`（版本、tag、日期、Release URL、workflow id）。
3. 单独提交并推送。

**你收尾**

1. 确认无需归档 plan（或给出归档指令）。
2. 回复暗号：`S7 完成`。

## 测试 / 走查表

| 用例 | 结果 | 一句话证据 |
|---|---|---|
| `package.json` 合法且为新文案 | 待办 | — |
| L1 `npm test` | 待办 | — |
| `npm run e2e` | 待办 | — |
| `npm run pack` 产物检查 | 待办 | — |
| npm `latest` = 2.3.1 | 待办 | — |
| npm `description` 等于仓库文案 | 待办 | — |
| GitHub Release body 等于 CHANGELOG 块 | 待办 | — |
| 发现页 / 已安装卡片文案一致 | 待办 | — |

## 移交 / 遗留

| 编号 | 一句话内容 | 原因/去向 |
|---|---|---|
| M1 | 上游 PR 的提交与评审 | 用户手工操作；AI 只出稿 |
| M2 | tag 推送与发布放行 | 需用户明确指令，AI 不自行执行 |
| M3 | 市场索引可能滞后于上游合并 | 上游两级 workflow 时序，非本仓可控 |

## 施工提醒

1. 发版前文案必须定稿：一旦发布，description 无法修改，只能再发一版。
2. `docs/release.md` 与 `release` skill 已加入 description 核对项，本阶段必须逐条走。
3. CHANGELOG 正式块只按 tag 版本提取，不按文件第一块提取。
4. 本地 8 处 `2.2.0` / `2.1.0` 字样多为 e2e 基线版本，改动前先确认是断言还是注释。
5. 发布前确认 `-local` 块已清空，正式块已聚合。

## plan 回写候选

1. `feature_listing_description_sync.md` §五：REQ-01 / REQ-02 / REQ-03 验收结果回填。
2. 同上 §〇：补充「上游目录由 `data/plugins/*.yml` 驱动、需两级 workflow」这一事实。
3. 同上头部状态：`实施中` → `待验收` → `待归档`。

## 执行日志 + 踩坑

- 2026-11-19：checklist 创建，状态 `待批准`。此前已在 `ee4751d` 完成 description 补全 4 家订阅。

```text
踩坑 1 · 市场文案与 package.json 不是同一来源（2026-11-19 [已定位]）：
- 现象：    改完 package.json 后，市场「发现」页文案无变化。
- 根因：    发现页读上游 data/plugins/*.yml → README → build-site，与 npm manifest 无关。
- 修复：    需分别改：本仓 package.json（发版生效）+ 上游 YAML PR（重建生效）。
- 验证锚点： 上游 PR 合并并跑完 sync-readme + build-site 后，发现页显示 4 家订阅。
- 沉淀：    plan §〇 已记录该数据链；checklist 交付事实表同步。
```

```text
踩坑 2 · description 初版把订阅范围写窄（2026-11-19 [已修复]）：
- 现象：    初版文案写「GLM / Kimi Coding」，与小节事实不符。
- 根因：    照抄了过时的上游目录文案，未回代码核对。
- 修复：    src/quota-sources.js 实跑枚举确认 4 家后改写为 A 方案。
- 验证锚点： package.json description 含 OpenCode Go 与 Command Code。
- 沉淀：    文案类改动一律先回代码/配置枚举事实，不抄现成描述。
```
