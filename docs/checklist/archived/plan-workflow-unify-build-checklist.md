# Plan/Checklist 目录与全局 skill 单一化施工 checklist

> 依据：2026-11-01 决策——CE `skills/plan-workflow` + `skills/checklist` 为唯一 skill 源，所有仓库统一 `docs/`<br>
> 状态：已完成并归档（2026-11-01；文档迁移、CE skill 通用化、全局 junction 完成）<br>
> 工程根：`dsh-token-dash`；提交：代码仓 `3dc715b`、CE `d13530f`

## 决策

| # | 定案 |
|---|---|
| Q1 | 唯一 skill 源：CE `skills/plan-workflow` + `skills/checklist`，不再维护简化全局版 |
| Q2 | 文档根统一 `docs/`；`doc/`、根 `plan/` 迁移后删除 |
| Q3 | plan 路径 `docs/plan/active/dsh/feature_<topic>.md`（已废止：现为 `docs/plan/active/feature_<topic>.md`） |
| Q4 | checklist 路径 `docs/checklist/{active,archived}/dsh/`（已废止：现为单层 `docs/checklist/{active,archived}/`） |
| Q5 | 全局 skill 用目录 junction 指向 CE，不手工复制/修改 |
| Q6 | CE skill 去掉 CE 限定，补 `dsh` 域，路径保持 workspace-relative |
| Q7 | checklist 文件名维持 `<topic>-<阶段>-checklist.md`，不改前缀 |
| Q8 | 代码仓与 CE 分别提交/推送，推送前用户确认 |
| Q9 | 阶段 0-6 全过（尤其 README Gate）后才允许业务开发 |

## 阶段

| 阶段 | 一句话 | 状态 |
|---|---|---|
| 0 契约与基线 | 命名、唯一 skill 源、目标树、现状基线 | ✅ |
| 1 文档迁移 | `doc/` + 根 `plan/` 并入 `docs/` | ✅ |
| 2 引用更新 | AGENTS / README / package / 文档互链 | ✅ |
| 3 README Gate | 目录变更后只读核对链接、图片、包清单 | ✅ |
| 4 CE skill 通用化 | 去 CE 限定、补 `dsh` 域、修可移植引用 | ✅ |
| 5 全局 skill 切换 | junction 指向 CE，验证 harness 加载 | ✅ |
| 6 全量验证与提交 | 测试、链接、pack、分别 commit/push | ✅ |

## 关键迁移

| 原 | 新 |
|---|---|
| `plan/active/token-dash/plan.md` | `docs/plan/active/dsh/feature_token_dash.md`（后续再上移为 `docs/plan/archived/feature_token_dash.md`） |
| `doc/checklist/archived/*.md` | `docs/checklist/archived/*.md` |
| `doc/design.md` / `doc/release.md` / `doc/pic/*.png` | `docs/design.md` / `docs/release.md` / `docs/pic/*.png` |
| 全局简化版 skills | `~/.agents/skills/{plan-workflow,checklist}` junction → CE |

全部移动用 `git mv` 保留历史；`docs/` 与 `doc/` 合并而非整目录改名；历史 CHANGELOG 旧路径不改写。

## 验证

| 用例 | 结果 | 证据 |
|---|---|---|
| 代码仓 L1 | ✅ | `npm test` 37/37 |
| Markdown 链接 | ✅ | 14 个 md，0 缺失 |
| 包清单 | ✅ | `npm pack --dry-run` 含 `docs/pic`、22 files |
| 旧路径清零 | ✅ | 仅 CHANGELOG 历史条目保留 |
| 目录树 | ✅ | `doc/`、`plan/` 删除，目标树就位 |
| 全局 skill | ✅ | CE `plan-workflow` 2.28（含 `dsh` 域）、`checklist` 1.3；junction 生效 |
| 提交 | ✅ | 代码仓 `3dc715b`、CE `d13530f`，均已推送 |

## 移交 / 风险

| 编号 | 内容 | 处理 |
|---|---|---|
| M01 | junction 是本机配置 | 其它机器需重复阶段 5 或用同步脚本 |
| M02 | CE 私有仓路径依赖 | 仓库移动后重建 junction |
| M03 | DSH skill 缓存 | 切换后重启/重载再验证 |
| M04 | 两个 AGENTS 只做最小入口 | 不复制 CE 全文，后续按需补 |
| M05 | 公开仓文档暴露 | 迁移后 `docs/` 入公开仓，敏感内容先审 |

## 施工约束（沉淀）

- 不对 `doc/` 做整目录改名；必须把内容并入已有 `docs/`。
- 全部移动用 `git mv`；不用复制 + 删除。
- 改全局 skill 前先备份；junction 建好后只改 CE 源。
- 阶段 3 是只读 Gate，失败不得进入阶段 4。
- 两个仓分别提交/推送；推送前给用户看范围。

## 回写

AGENTS 文档位置/Git 边界、CE CHANGELOG 2.28、plan 文档位置说明均已回写；本 checklist 测试与提交号已归档。

