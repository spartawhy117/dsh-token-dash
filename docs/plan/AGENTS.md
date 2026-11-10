# Plan 目录规则

- 本仓单产品，`active/`、`archived/` 均为单层，不建项目域子目录。
- active：`docs/plan/active/feature_<topic>.md`（性能类用 `perf_<topic>.md`）；archived：`docs/plan/archived/`。
- 归档时同名移入 `archived/`，不改名；`active/` 与 `archived/` 不得存在两份同名文档。
- 当前 active：`docs/plan/active/feature_ollama_subscription.md`（Ollama Cloud 余额与用量接入，已对齐待实施；Mistral 已在文档 §四 记录否决理由）。最近归档：`docs/plan/archived/feature_third_party_provider_pricing.md`（第三方 provider 自适应计价，已实施并随 `2.1.0-local.4` 交付）。
- 操作前加载全局 `plan-workflow` skill；命名、状态、压缩、归档以该 skill 为准。
- **本文件不维护归档清单**：归档文档只放 `docs/plan/archived/`，按需检索目录或文件头，避免 AGENTS 越写越长。
