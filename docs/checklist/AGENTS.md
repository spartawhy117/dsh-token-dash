# Checklist 目录规则

- 本仓 checklist 统一在 `docs/checklist/`；单项目仓，`active/` 使用单层（不再建 `active/dsh/`），与 `docs/plan/AGENTS.md` 口径一致。
- `archived/` 同为单层，不建项目域子目录（`archived/dsh/` 已撤除，历史文档上移一层）；归档时同名移入即可，不改名。
- 施工稿命名遵循 `<topic>-<阶段>-checklist.md`；操作前加载全局 `checklist` skill。
- 第三方参考项目**不写进 checklist**：现状描述放 `docs/reference/<repo>.md`（不带 `-checklist` 后缀），只写「定位 / 规模 / 现状 / 特点 / 已知取舍」，不写我方改造结论。
- 参考类清单**只定能力与形态，不写实现步骤**，且**不构成施工授权**；实施步骤、验收项、测试用例一律写 `docs/plan/active/feature_*.md`，按 plan-workflow 批准后执行。
- 回写 plan 时走 `docs/plan/`，并先加载全局 `plan-workflow` skill。
- 当前 active：无（`dsh-0.2.2-upgrade-compat-checklist.md` 已压缩归档至 `archived/`，结论为兼容且已实机验证）。
- **本文件不维护归档清单**：归档文档只放 `docs/checklist/archived/`，按需检索目录或文件头，避免 AGENTS 越写越长。
- 参考档案命名 `docs/reference/<owner>-<repo>.md`，与 `docs/reference/images/<owner>-<repo>--<名称>.png` 同规则；当前参考项目见 `docs/reference/` 目录，不在本文件逐个列清单。
