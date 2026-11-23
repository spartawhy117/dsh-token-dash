# Plan 目录规则

- 本仓单产品，`active/`、`archived/` 均为单层，不建项目域子目录。
- active：`docs/plan/active/feature_<topic>.md`（性能类用 `perf_<topic>.md`）；archived：`docs/plan/archived/`。
- 归档时同名移入 `archived/`，不改名；`active/` 与 `archived/` 不得存在两份同名文档。
- 当前 active：`docs/plan/active/feature_subrow_align.md`（订阅行排版对齐：P1 字号收敛为方案 A 全 12px + 基线统一、P2/P3 零回归；已对齐，承接已放弃的 Issue #7 / #8）。最近归档：`docs/plan/archived/feature_probe_optimize.md`（Provider 探测去阻塞 / 宿主超时 / 失败降级 / 选卡三级回退与归一化 / SubWindow 公共控件；Issue #1~#9 全部处置——#1~#6 已修复，#7~#9 已放弃并转出；本地包 `2.5.0-local.8`，2026-11-23 归档）；`docs/plan/archived/feature_subscription_estimated_cost.md`（订阅用量的估算 API 价格：凭据名兼容、5h 窗口、订阅卡宽度、费用标记统一、总费用含估算、成本柱双轴、日志治理；Issue #1~#11 全部修复，随 `2.4.0` 发布）；`docs/plan/archived/feature_backend_provider_coverage.md`（后端 Provider 覆盖与取数可靠性；2026-11-20 重开处理 Issue #2 / #3 / #4 / #5 后归档，本地包 `2.3.1-local.2`）；`docs/plan/archived/feature_2.3.1_visual_and_listing.md`（趋势图纵坐标恢复 + 插件描述与市场能力对齐，两份 active plan 合并压缩，随 `2.3.1` 发布，2026-11-19 归档）；`docs/plan/archived/feature_p3_usage_trend.md`（P3 四格摘要带与用量趋势柱；`2.2.0` 首发后于 2026-11-16 重开，处理 Issue #3 / #5 / #6 / #7 / #9 / #10 / #11 / #12，随 `2.3.0` 发布）；`docs/plan/archived/feature_ollama_subscription.md`（Ollama Cloud 余额与用量接入 + 币种不匹配计价，已实施并随 `2.1.0` 发布；真实 Key 手测由用户自行验证）；`docs/plan/archived/feature_third_party_provider_pricing.md`（第三方 provider 自适应计价，随 `2.1.0` 一并交付）。
- 操作前加载全局 `plan-workflow` skill；命名、状态、压缩、归档以该 skill 为准。
- **本文件不维护归档清单**：归档文档只放 `docs/plan/archived/`，按需检索目录或文件头，避免 AGENTS 越写越长。
