---
name: dsh-token-dash-release
description: 管理 dsh-token-dash 的本地构建草稿（CHANGELOG local 块）、CHANGELOG 正式版本历史、正式发布、npm/GitHub Release 核验与 Release notes 修复。仅当前工作区是 dsh-token-dash，且任务涉及本地打包、整理 changelog、发版、发布、打 tag、补 Release notes 时使用；离开本仓不触发。
---

# DSH Token Dash 发布

## 仓库检查

开始前确认当前工作区是 dsh-token-dash，并核对：

- `AGENTS.md`、`package.json`、`CHANGELOG.md`、`docs/release.md`
- `.github/workflows/release.yml`、`.github/workflows/publish.yml`
- `scripts/release-notes.mjs`、`scripts/e2e.mjs`、`test/unit/`
- `references/official-release-version.md`

## 动作

| 动作 | 触发词 | 结果 |
| --- | --- | --- |
| 本地打包 | `本地打包`、`本地版本`、`候选包` | 版本改为 `X.Y.Z-local.N`；在 CHANGELOG 顶部新增/更新 local 草稿块；测试、打包、可选本地安装；不 tag、不发布 |
| 整理 CHANGELOG | `整理 changelog`、`优化 changelog` | 维护“完整正式历史 + 顶部 local 草稿”；正式目标先把 local 块合并进正式块并删除，输出预览 |
| 正式发布 | `发版`、`发布版本`、`正式发布` | 合并并删除 local 块，生成正式块；测试、提交、tag、双 workflow、核验 npm/Release |
| 补 Release notes | `release notes 不对`、`Release 为空` | 按 tag 版本从 CHANGELOG 生成 body，`gh release edit` 后复查 |

## 版本与历史模型

1. `CHANGELOG.md` 是唯一的修改历史文件，同时承载“未发布 local 草稿”和“正式版本历史”。
2. 本地构建用 `X.Y.Z-local.N`，在 CHANGELOG 顶部写 local 块，例如 `## [1.0.6-local.1] - 2026-11-02`；每个本地包都记录一次它的修改。
3. local 块是中间产物记录：不打 tag、不发布、不进入 Release body；正式发布时被消费。
4. 正式发布时，读取自上次正式版以来的全部 local 块，按时间聚合进新的 `## [X.Y.Z]` 正式块，然后**删除这些 local 块**。
5. 正式块聚合自上次正式发布以来的全部用户可见变更；最终 CHANGELOG 只保留完整正式历史，不出现 `-local` 版本号。
6. 唯一版本基准是 `references/official-release-version.md` 的「最新已发布版本」，local 版本不更新基准、不参与计算。
7. 发布前核验：`npm view dsh-token-dash dist-tags --json` 的 `latest` 与 `gh release view v<version>` 的 tag 必须与记录一致。
8. 版本号由用户确认；纯修复升 PATCH，新增功能升 MINOR，破坏性变更升 MAJOR。
9. local 版本禁止打 tag、禁止触发 `release`/`publish` workflow；未推 tag 前不得声称已上线。

## CHANGELOG 写法

- 正式块：`## [X.Y.Z] - YYYY-MM-DD`；每个版本先 `### 中文`（`#### 新增` / `#### 修改`），再 `### English`（`#### Added` / `#### Changes`），中英各自成块。
- 不逐条配对翻译：中文整段在前，英文整段在后；Release body 与 CHANGELOG 保持同样结构。
- local 块：`## [X.Y.Z-local.N] - YYYY-MM-DD`，标题下加 `> 本地构建，未发布`，同样使用中英分块。
- local 块只写当前未发布修改；正式发布时合并进正式块并删除，不在最终历史中保留。
- 每条写用户可感知的“对象 + 结果”；不写实现细节、测试环境、内部模块名和提交信息。
- 正式块的 Release body 必须与该块逐段一致；按 tag 版本提取，不按“文件第一块”提取。
- 禁止使用 GitHub 自动生成的空 body 或只有 Full Changelog 的 body。

## 本地打包（不发布）

> **硬门槛：只有用户在当前轮显式说出“本地打包 / 本地版本 / 候选包”才执行。** 完成 issue、修复、测试或提交后不得自动本地打包、改 `package.json` 版本或写 CHANGELOG local 块；不得以“顺手验证”为由绕过。

1. 执行版本基准核验；确认目标 base 与下一个 `-local.N`（同 base 取 CHANGELOG local 块最大值 +1）。
2. 更新 `package.json` 为 `X.Y.Z-local.N`；同步 `scripts/e2e.mjs` 两处版本 fixture（`baseSummary.version`、update mock 的 `current`）。
3. 在 `CHANGELOG.md` 顶部新增或更新该 local 块，记录本次修改（这是中间产物记录，不是正式历史）。
4. 运行 `npm test` 与 `npm run e2e`；全绿后 `npm run pack`，确认 `build/dsh-token-dash-X.Y.Z-local.N.tgz`。
5. 可选本地安装：`dsh plugin --profile desktop add build/dsh-token-dash-X.Y.Z-local.N.tgz`。
6. 停止：不创建 tag、不推送发布 tag、不触发 release/publish；是否提交由用户决定。

## 整理 CHANGELOG

1. local 目标：只整理顶部 local 块，不触碰正式历史，不生成正式版本。
2. 正式目标：确认版本号后，把自上次正式版以来的全部 local 块合并进新的 `## [X.Y.Z]` 正式块，删除 local 块，输出完整预览并停在审阅点。
3. 未确认预览不继续；用户要求调整时重新整理并再次预览。

## 正式发布

1. 确认工作区只有本次发布相关改动（`.tmp/`、`build/` 不入库）。
2. 确认 CHANGELOG 顶部已无 `-local` 块，正式块已聚合全部变更。
3. 运行 `npm test` 与 `npm run e2e`；全绿后 `npm run pack`，确认 `build/dsh-token-dash-<version>.tgz`。
4. 提交：`git add -A && git commit -m "chore: release <version>"`，推送 `main`。
5. 创建并推送 tag：`git tag -a v<version> -m "<version>" && git push origin v<version>`。
6. 等待两个 workflow 成功：`gh run watch <id> --exit-status`（`release` 与 `publish`）。
7. 核验 npm：`npm view dsh-token-dash dist-tags --json` 的 `latest` 必须是 <version>；npm 处理可能延迟数分钟，轮询而非立即判定失败。
8. 核验 GitHub Release：`gh release view v<version> --json body,assets`。body 必须等于 CHANGELOG 对应正式块；assets 必须含 `dsh-token-dash-<version>.tgz`。
9. body 为空、缺失或与 CHANGELOG 不一致时立即修复：

```bash
node scripts/release-notes.mjs <version> --out build/release-notes-<version>.md
gh release edit v<version> --notes-file build/release-notes-<version>.md
gh release view v<version> --json body
```

10. 发布成功后更新 `references/official-release-version.md`（版本、tag、日期、Release URL），单独提交并推送。

## 阻断条件

- 版本基准与 npm latest / GitHub latest Release / tag 不一致。
- 正式发布时 CHANGELOG 仍残留 `-local` 块，或正式块未聚合全部变更。
- 试图给 `-local` 版本打 tag 或发布。
- `npm test` 或 `npm run e2e` 失败。
- 工作区混入无关文件、`.tmp/`、`build/` 或真实凭证。
- Release body 为空、只有 Full Changelog、不是对应正式块，或与 CHANGELOG 不一致。
- npm latest 未指向目标版本（等待超过 10 分钟仍不生效）。

## 结果回报

本地打包：local 版本、CHANGELOG local 块、测试、tarball、安装/提交状态。

正式发布：版本、合并的 local 块数量、正式 CHANGELOG 预览、测试、提交 SHA、tag、两个 workflow 结论、npm latest、Release URL / body 校验、版本记录提交 SHA。
