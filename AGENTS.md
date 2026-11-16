# AGENTS.md

> 本文件只放协作与执行规则，不承担开发总览、目录索引或版本现状；验证命令以 `package.json` 的 scripts 为准，不复述测试规模与版本号。

## 1. 读取入口

| 场景 | 先读 | 再看 |
|---|---|---|
| 改代码 / 架构 | `docs/design.md` | `src/`、`client.js`、`test/unit/`、对应 active plan |
| 需求 / 规划 | `docs/plan/AGENTS.md` | `docs/plan/active/`（先看文件头状态）、`docs/plan/archived/` |
| 施工 / 走查 | `docs/checklist/AGENTS.md` | `docs/checklist/active/`、`docs/checklist/archived/` |
| 发布 / 版本 | `docs/release.md` | `.agents/skills/dsh-token-dash-release/SKILL.md`、`references/official-release-version.md` |
| 用户说明 / 变更历史 | `README.md` / `README.en.md` | `CHANGELOG.md`、`docs/pic/` |
| 组件预览 / 草图 | `tools/preview/README.md` | `tools/preview/spec.mjs`、`tools/preview/templates/` |
| 假数据 / 截图 | `tools/mock/AGENTS.md` | `tools/mock/fixtures.mjs`、`tools/mock/shots.mjs` |
| Skill 维护 | `.agents/skills/`（项目） | `D:\Projects\Context-Engineer\skills\`（全局真源） |

- active plan / checklist 不在此复制，进目录后按文件头状态判断，避免本文件与文档状态漂移。

## 2. 授权边界

- **未获明确授权不得改代码**。用户只要求“更新文档 / 记 issue / 完善设计 / 检查文档”时，仅可改 `docs/`、`AGENTS.md`、`README*`；禁止编辑 `client.js`、`index.js`、`src/`、`test/`、`scripts/`、`tools/`、`package.json`、`locale/`，也不得测试、打包或安装插件。
- 代码实施需明确口令（“开始修改 / 可以改代码 / 执行 / 开始开发”）；文档确认与代码实施分轮进行，不混在同一轮。
- **issue 文档必须先于代码**（强制顺序，无例外）：任何带 issue 编号的改动，顺序固定为「先写 / 更新 issue 文档（现象、根因、期望、影响面、验收方式）→ 再改代码」。禁止先改代码再补 issue，也不允许把 issue 与代码写在同一次编辑里。
- issue 已终态（`[已修复]` / `[已放弃]`）后再次动手，必须先按 plan-workflow 的重开规则恢复非终态，再改代码。
- plan / checklist 记录不等于实施授权；发现文档与代码不一致时先报告，未获授权不得顺手修。

## 3. 代码与架构约束

- 纯 ESM、零构建；宿主入口 `index.js`，客户端 `client.js`；client bundle id 必须等于包名。
- 源码即产物，不提交 `lib/`；npm 包内容由 `package.json#files` 控制。
- Provider 边界：adapter 只输出 `ProviderSnapshot`，VM 只输出 `SummaryVM`，UI 只消费 VM；不做 provider 插件化或 per-provider 拆分（当前五家）。
- 不做无关重构；改动范围以 plan / checklist 声明为准，越界先改文档并确认。
- 日志用 `[TD:<module>]` 语义前缀；错误不吞，关键链路带 `errorKind` / `httpStatus`。

## 4. 流程与工具

### 4.1 规划与施工

- 复杂功能、跨模块修改、架构调整先用 `plan-workflow` skill 维护 `docs/plan/active/`；归档内容只读，重开走受控流程。
- 同一时间只推进一个主 feature；优先恢复已有 plan，不新建重复计划。
- 施工与走查用 `checklist` skill 维护 `docs/checklist/active/`（单层，不建项目域子目录）；回写完成 + 用户明确指令后才归档。
- 每次实现完成、测试通过或发布后，回写 plan 的 §3.0/§5 与 checklist 的阶段 / 测试 / 执行日志，避免状态只留在对话里。
- 固定落地顺序：**issue 文档 → 代码 → 测试 → 回写验收**。issue 段先落定现象 / 根因 / 期望 / 影响面 / 验收方式，代码只实现已写下的结论；实现中发现结论有误，先回改 issue 再继续改代码。

### 4.2 预览与原型

- 四层分离：`tools/preview/templates/`（定稿原型）与 `drafts/`（探索稿）入库；`.tmp/preview/` 只放渲染器产出的 HTML（PNG 仅在 `--png` 时生成）；`docs/pic/` 只放定稿图，仅 `preview:publish` 写入。
- **手写 HTML 不落 `.tmp/`**：探索写 `tools/preview/drafts/<name>.html`，跑 `npm run preview drafts/<name>`；定稿时把数值搬进 `spec.mjs`、改用变量后再移入 `templates/`。
- 默认只生成 `.tmp/preview/<name>.html`，**在 IDE 里直接预览**（比截图更接近真实渲染）；需要静态图才加 `--png`，进 README / 设计文档才 `preview:publish`。
- 尺寸、字号、间距只在 `tools/preview/spec.mjs` 定义一次；预览模板与后续 E2E 尺寸断言共用，禁止各写一份。
- 设计文档引用 `templates/` 的稳定路径或 `npm run preview` 命令，不引用 `.tmp/`；组件形态以原型为准，不维护 ASCII 草图。

### 4.3 Skill 归属

- 项目 skill 只放仓库 `.agents/skills/`，不复制到用户层。
- 全局 skill 真源只放 `D:\Projects\Context-Engineer\skills\`；`~/.agents/skills/<name>` 用 junction 指向 CE，不保留副本。
- 新增或修改全局 skill 在 CE 内完成再建 junction；项目 skill 与全局 skill 不混放。

## 5. 验证、提交与版本

### 5.1 提交前

1. 更新相关文档：plan / checklist / design / README，以改动范围为准。
2. 执行受影响验证：L1 `npm test`；涉及 UI 或宿主链路时加 `npm run e2e`。
3. 仅当用户显式要求本地打包或发布时执行 `npm run pack`，并核对 tarball 内容。
4. 确认无 `.tmp/`、`build/`、真实会话或凭证进入提交。
5. `commit` + `push`；用户说“提交”默认含推送，除非明确“只本地提交”。

- 纯文档更新且不涉及代码、测试脚本、发布资产时可跳过测试与打包，但提交说明必须写明“仅文档更新，未启动测试/打包”。
- 文档互引使用以仓库根为基准的相对路径。

### 5.2 版本号

- 遵循 `MAJOR.MINOR.PATCH`；当前正式版本以 `.agents/skills/dsh-token-dash-release/references/official-release-version.md` 为准，不在此复制。

### 5.3 正式发布

- 唯一来源：`docs/release.md` + `.agents/skills/dsh-token-dash-release/SKILL.md`；GitHub Release 与 npm Trusted Publishing 均由 tag 触发。
- 流程：确认版本 → CHANGELOG 正式块 → L1 + E2E → pack → commit/push → tag → 双 workflow → 核验 npm latest 与 Release body；随后更新 `official-release-version.md`。
- Release body 按 tag 版本从 CHANGELOG 提取，不按“文件第一块”；local 块不得进入 Release body。
- 未获明确授权，不执行 `npm publish`、不推 tag、不声称已上线。

### 5.4 本地构建

- **必须由用户显式指令触发**（“本地打包 / 本地版本 / 候选包”）；完成 issue、修复、测试或提交后，不得自动改版本号、写 local 块、pack 或安装。
- 记录写 `CHANGELOG.md` 顶部 `## [X.Y.Z-local.N]`，标题下加 `> 本地构建，未发布`；不 tag、不发布；正式发布时合并进正式块并删除，最终历史不保留 local 块。
- 打包完成后立即回写当前 active plan 的进度。

## 6. 仓库卫生

- 入库：`src/`、`client.js`、`index.js`、`test/`、`tools/`、`scripts/`、`docs/`、`locale/`、`.agents/`、`.github/`、`README*`、`CHANGELOG.md`、`AGENTS.md`、`package.json`、`pnpm-lock.yaml`、`cordis.patch.yml`。
- 不入库：`node_modules/`、`build/`、`.tmp/`、`artifacts/`、`coverage/`、`playwright-report/`、`test-results/`、`*.tgz`、`*.log`、真实会话 JSONL、凭证与密钥。
- 临时产物、一次性脚本、MCP 输出统一放 `.tmp/`（预览图 `.tmp/preview/`）；不在仓库根或 `src/` 下新建临时文件。
- E2E 测试脚本与合成 fixture 必须入库；截图、日志、报告、trace 一律忽略。
- `pnpm-lock.yaml` 必须提交，保证可复现安装。

## 7. 安全

- 不读取 `~/.dsh/.credentials.yaml`；凭据只经宿主 `ctx.credentials.resolve(...)`。
- 余额查询仅限 DeepSeek / Kimi / GLM / OpenRouter / Qwen 官方接口；第三方显示“第三方不支持”且不请求。
- 密钥、cookie、token 不得出现在源码、日志、fixture 或提交信息中。

## 8. 汇报

- 汇报“改了什么 / 测试改了什么”前，先读对应 commit：`git show --stat`、`git show --name-status`，并核对测试与文档 diff。
- 已提交内容、未提交工作区、运行态结果分开说明，不能用记忆或推测代替 commit 事实。
- 尚未形成 commit 时明确标注“未提交”，不得说成“已完成修改”。
