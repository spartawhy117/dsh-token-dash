# 发版流程

一页 checklist。发布动作以 `.agents/skills/dsh-token-dash-release/SKILL.md` 为准，本页只列操作顺序与易错点。

## 本地打包（不发布）

> 仅当用户显式要求“本地打包 / 本地版本 / 候选包”时执行；完成 issue 或修复后不得自动打包。

1. 读 `.agents/skills/dsh-token-dash-release/references/official-release-version.md` 确认正式版基准，并确定目标 `X.Y.Z-local.N`（同 base 取历史最大值 +1）。
2. 改 `package.json` 为 `X.Y.Z-local.N`；同步 `scripts/e2e.mjs` 两处版本字符串（`baseSummary.version`、update mock 的 `current`）。
3. 在 `CHANGELOG.md` 顶部新增/更新 `## [X.Y.Z-local.N] - YYYY-MM-DD`，标题下加 `> 本地构建，未发布`；这个 local 块就是中间产物记录。
4. `npm test` + `npm run e2e` 全绿；`npm run pack` 生成 `build/dsh-token-dash-X.Y.Z-local.N.tgz`。
5. 可选本地安装：`dsh plugin --profile desktop add build/dsh-token-dash-X.Y.Z-local.N.tgz`。
6. 禁止：打 tag、触发 release/publish、声称已发布。

## 正式发布

1. **版本基准**：读 `.agents/skills/dsh-token-dash-release/references/official-release-version.md`，用 `npm view dsh-token-dash dist-tags --json` 与 `gh release view vX.Y.Z` 核验；不一致时停止。版本号由用户确认。
2. **合并 local 块**：把自上次正式版以来的全部 `-local` 块按时间聚合进新的 `## [X.Y.Z]` 正式块，然后删除这些 local 块；CHANGELOG 最终只保留完整正式历史，不出现 `-local` 或“本地构建”条目。
3. **版本号**：`package.json` 改为 `X.Y.Z`；`index.js` 的 `CURRENT_VERSION` 自动生效；同步 `scripts/e2e.mjs` 两处 fixture。
3b. **description 核对**：`package.json#description` 必须是当前版本能力的准确描述（新增能力后最容易漏改；市场「已安装」卡片读取的正是这个字段，不读市场索引）。发版后用 `npm view dsh-token-dash description` 与本地已装包 `node_modules/dsh-token-dash/package.json` 两处对读，必须与仓库一致。
4. **CHANGELOG 预览**：输出正式块完整 `新增 / 修改` 预览，等用户确认后再继续。
5. **测试**：`npm test`（L1）+ `npm run e2e` 全绿。
6. **提交**：`git add -A && git commit -m "chore: release X.Y.Z" && git push`；确认无 `.tmp/`、`build/`、凭证。
7. **打 tag**：`git tag -a vX.Y.Z -m "X.Y.Z" && git push origin vX.Y.Z`。自动触发：
   - `release.yml`：pack → 从 CHANGELOG 按版本生成 notes → 建 Release + tarball
   - `publish.yml`：校验 tag/版本 → L1 → `npm publish --provenance`（OIDC）
   - 易错点：tag 必须与 `package.json` 一致；`-local` 版本禁止打 tag。
8. **核验**：
   - `npm view dsh-token-dash dist-tags --json` 的 `latest` 必须是 X.Y.Z；npm 处理可能延迟数分钟，轮询。
   - `gh release view vX.Y.Z --json body,assets`：body 必须等于正式块，assets 含 `dsh-token-dash-X.Y.Z.tgz`。
   - body 为空/只有 Full Changelog 时：
     `node scripts/release-notes.mjs X.Y.Z --out build/release-notes-X.Y.Z.md`
     `gh release edit vX.Y.Z --notes-file build/release-notes-X.Y.Z.md`
9. **发布记录**：更新 `references/official-release-version.md`（版本、tag、日期、Release URL），单独提交并推送。

## CHANGELOG 规则

- 完整正式历史永久保留，按时间倒序；不删除旧正式版本。
- 本地构建用 `X.Y.Z-local.N`，在 CHANGELOG 顶部写 local 块（中间产物记录），不 tag、不发布。
- 正式发布时把 local 块聚合进正式块并从 CHANGELOG 删除；最终只保留正式块。
- 每个版本先写 `### 中文`（`#### 新增` / `#### 修改`），再写 `### English`（`#### Added` / `#### Changes`），中英各自成块。
- Release body 按 tag 版本提取，不按文件第一块提取。

## 产物归位

- tarball 在 `build/`（gitignore，不入库）。
- Release 页产物 = 自动 pack 的 tarball（离线安装源）。
- npm 安装：`dsh plugin --profile desktop add dsh-token-dash@X.Y.Z`。

## 发布后统计

- `npm run stats`（即 `node scripts/npm-stats.mjs`）只读 npm registry 与 api.npmjs.org，输出**近期 3 个版本的 7 日安装量、发布后 24h 与 48h 下载**，另附总量、每日曲线与启发式装机估算；`--versions N` 改近期版本数（1–20）、`--days N` 改窗口、`--out <file>` 指定文件、`--stdout` 只打印、`--json` 输出原始数据。
- 默认落盘到仓库根的 `npm-reports/<pkg>-YYYY-MM-DD.md`；该目录已加入 `.gitignore`，报告属本地产物不入库。
- 口径：下载按 UTC 日统计、当日未结算；下载次数 ≠ 用户数（镜像 / 扫描 / 重复安装都会计入），估算只作趋势参考。
- 按版本的拆分接口只提供最近 7 天的合计、没有按天拆分，所以「发布日下载（24h）」取发布当天的全包日下载：该日只发一个版本时等于单版本 24h 量，同时发多个版本会标 ⚠。
- 发布不满 7 天的版本，7 日安装量会被截断，报告里的「7 日窗口覆盖」给出可用天数占比，跨版本比较前先看它。
- 需要历史版本分布时每次发版后跑一次并归档。
