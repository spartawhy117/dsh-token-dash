# Changelog / 更新日志

本文件记录每个版本的**新增**与**修改**，中英双语。格式参考 [Keep a Changelog](https://keepachangelog.com/)。

This file records the **new features** and **changes** of each release in Chinese and English. Format follows [Keep a Changelog](https://keepachangelog.com/).

## [2.0.2] - 2026-11-06

### 修改 / Changes

- P3「时间范围」由固定 300px 改为按内容自适应，英文 `Last 7 days` / `Last 30 days` 不再换行。
  - EN: The P3 time-range control now sizes to its content instead of a fixed 300px, so `Last 7 days` / `Last 30 days` no longer wrap.
- provider 模式标签由「按量 API / Pay-as-you-go」改为「API 用量 / API usage」，P3 区块标题同步。
  - EN: Provider mode labels changed from “按量 API / Pay-as-you-go” to “API 用量 / API usage”; the P3 section title was updated to match.
- 补齐英文界面缺失的 5 个词条；英文 README 使用英文界面截图。
  - EN: Added five missing English UI strings; README.en now uses English screenshots.

## [2.0.1] - 2026-11-05

### 修改 / Changes

- P3 设置标题右侧新增语言支持说明：语言跟随 DSH，当前仅中文 / English，其他语言回退英文。
  - EN: Added a language note beside the P3 settings title: the language follows DSH; only Chinese / English are available, and other languages fall back to English.
- provider 显示名统一英文：`Zhipu AI`、`Qwen`；provider ID、模型 ID、币种与模型映射不变。
  - EN: Unified provider display names to English: `Zhipu AI` and `Qwen`. Provider IDs, model IDs, currencies, and model mappings are unchanged.
- README / UI 文档补充当前语言覆盖范围与英文回退说明。
  - EN: README and UI documentation now describe the current language coverage and English fallback.

## [2.0.0] - 2026-11-05

### 新增 / Added

- 全量看板升级为 7 家供应商卡片：DeepSeek、GLM、Kimi、OpenRouter、Qwen、OpenCode Go、Command Code；按量与订阅分开展示，订阅窗口支持 5h / 周 / 月。
  - EN: The full dashboard now shows seven provider cards: DeepSeek, GLM, Kimi, OpenRouter, Qwen, OpenCode Go, and Command Code. API usage and subscription cards are separated; subscription windows support 5h / weekly / monthly.
- 接入 OpenCode Go 与 Command Code：订阅配额、余额 / credits 与窗口倒计时；Command Code 支持 `orgId` 预检。
  - EN: Added OpenCode Go and Command Code: subscription quotas, balance / credits, and window countdowns; Command Code supports an `orgId` preflight check.
- 新增「Token 看板」整页：侧栏入口或浮层「全量看板」进入，包含供应商卡片、摘要带、8 列模型明细与设置胶囊。
  - EN: Added the full “Token dashboard” page, reachable from the sidebar or the “Full dashboard” action in the panel; it includes provider cards, a summary strip, an eight-column model table, and a settings capsule.
- 看板页头新增「★ / ⟳」入口；明细模型列追加供应商后缀，模型名过长时省略。
  - EN: Added “★ / ⟳” actions to the dashboard header; model rows now include a provider suffix, and long model names are truncated.
- 日志体系升级：JSONL 每行带 `[TD:<module>]` 前缀，新增供应商失败、路由拒绝与缓存状态事件，日志头动态记录 DSH 版本。
  - EN: Upgraded logging: every JSONL line includes a `[TD:<module>]` prefix; added provider failure, route rejection, and cache status events; the log header now records the DSH version dynamically.

### 修改 / Changes

- P2 固定 380：摘要改为单行三组（环 / 已用·预算 / 真实余额），移除「本月已花」；真实余额右对齐到面板右缘，范围条撑满，订阅窗口固定三槽位（两窗占前两槽），模型列上限 150。
  - EN: P2 stays at 380px: the summary is now one row with three groups (ring / used-budget / real balance), and “Spent this month” was removed. Real balance is right-aligned to the panel edge; the range control fills the row; subscription windows use three fixed slots (two windows use the first two); model names are capped at 150px.
- P3 定稿：页头只留两枚 44×26 蓝色按钮；设置胶囊移除「立即刷新」，刷新间隔左对齐、账户余额右对齐；页面自持滚动，滚动条贴窗口右缘。
  - EN: P3 finalized: the header keeps only two 44×26 blue buttons; the settings capsule no longer has “Refresh now”; the refresh interval is left-aligned and the balance toggle is right-aligned; the page scrolls internally with the scrollbar at the window edge.
- P3 明细模型列上限 240，7 个数值列等宽，字号 13；除模型列外全部右对齐，长模型名不再挤压数字。
  - EN: The P3 model column is capped at 240px; the seven numeric columns share equal width at 13px; all columns except the model column are right-aligned, so long model names no longer squeeze the numbers.
- P2 / P3 间距统一到 4 / 8 / 12 / 16 / 24 / 32：卡片与底框 padding 16、区块间距 24、卡片间距 12、胶囊底部留白 32。
  - EN: P2 / P3 spacing is unified to 4 / 8 / 12 / 16 / 24 / 32: card and frame padding 16, section gap 24, card gap 12, and 32px bottom space below the capsule.
- P1 的预算与订阅窗口改用内联环；浮层不再承载设置项，设置集中到整页底部胶囊。
  - EN: P1 budget and subscription windows now use inline rings; the floating panel no longer contains settings, which are centralized in the capsule at the bottom of the full page.
- 供应商取数改为按源表迭代：每源成功缓存 60s / 失败 10s + 并发合并；订阅重查覆盖 GLM、Kimi、OpenCode Go、Command Code。
  - EN: Provider fetching now iterates the source table: each source caches successes for 60s and failures for 10s, with concurrent request coalescing; subscription refreshes cover GLM, Kimi, OpenCode Go, and Command Code.
- 7 家 provider registry 与价格链接同步；非回环请求走安全门；错误分类补 `upstream` 标记。
  - EN: Synced the registry and pricing links for all seven providers; non-loopback requests go through the security gate; added an `upstream` error classification.
- P1 在输入框底栏内右移（`composer.dock` 的 Pill 根节点 `order:10`），并移除 hero 槽位注入，官方 Agent 模式按钮恢复。
  - EN: Moved P1 to the right of the composer footer (`order:10` on the Pill root in `composer.dock`), removed the hero slot injection, and restored the official Agent mode button.
- P2 摘要「真实余额」跨第 3–4 列并右对齐到面板右缘，前三组位置不变。
  - EN: P2 real balance now spans columns 3–4 and is right-aligned to the panel edge; the positions of the first three groups are unchanged.
- P3 设置区新增画框外「设置与数据管理」区块标题（13px / 600），胶囊内三行功能不变。
  - EN: Added an external “Settings and data” section title above the P3 settings capsule (13px / 600); the three capsule rows are unchanged.

## [1.3.0] - 2026-11-05

### 新增 / Added

- 全量看板升级为 7 家供应商卡片：DeepSeek、GLM、Kimi、OpenRouter、Qwen、OpenCode Go、Command Code；按量与订阅分开展示，订阅窗口支持 5h / 周 / 月。
  - EN: The full dashboard now shows seven provider cards: DeepSeek, GLM, Kimi, OpenRouter, Qwen, OpenCode Go, and Command Code. API usage and subscription cards are separated; subscription windows support 5h / weekly / monthly.
- 接入 OpenCode Go 与 Command Code：订阅配额、余额 / credits 与窗口倒计时；Command Code 支持 `orgId` 预检。
  - EN: Added OpenCode Go and Command Code: subscription quotas, balance / credits, and window countdowns; Command Code supports an `orgId` preflight check.
- 新增「Token 看板」整页：侧栏入口或浮层「全量看板」进入，包含供应商卡片、摘要带、8 列模型明细与设置胶囊。
  - EN: Added the full “Token dashboard” page, reachable from the sidebar or the “Full dashboard” action in the panel; it includes provider cards, a summary strip, an eight-column model table, and a settings capsule.
- 看板页头新增「★ / ⟳」入口；明细模型列追加供应商后缀，模型名过长时省略。
  - EN: Added “★ / ⟳” actions to the dashboard header; model rows now include a provider suffix, and long model names are truncated.
- 日志体系升级：JSONL 每行带 `[TD:<module>]` 前缀，新增供应商失败、路由拒绝与缓存状态事件，日志头动态记录 DSH 版本。
  - EN: Upgraded logging: every JSONL line includes a `[TD:<module>]` prefix; added provider failure, route rejection, and cache status events; the log header now records the DSH version dynamically.

### 修改 / Changes

- P2 固定 380：摘要改单行四组（环 / 已用·预算 / 真实余额 / 本月已花），范围条撑满，订阅窗口固定三槽位（两窗占前两槽），模型列上限 150。
  - EN: P2 stays at 380px: the summary uses one row with four groups (ring / used-budget / real balance / spent this month); the range control fills the row; subscription windows use three fixed slots (two windows use the first two); model names are capped at 150px.
- P3 定稿：页头只留两枚 44×26 蓝色按钮；设置胶囊移除「立即刷新」，刷新间隔左对齐、账户余额右对齐；页面自持滚动，滚动条贴窗口右缘。
  - EN: P3 finalized: the header keeps only two 44×26 blue buttons; the settings capsule no longer has “Refresh now”; the refresh interval is left-aligned and the balance toggle is right-aligned; the page scrolls internally with the scrollbar at the window edge.
- P3 明细模型列上限 240，7 个数值列等宽，字号 13；除模型列外全部右对齐，长模型名不再挤压数字。
  - EN: The P3 model column is capped at 240px; the seven numeric columns share equal width at 13px; all columns except the model column are right-aligned, so long model names no longer squeeze the numbers.
- P2 / P3 间距统一到 4 / 8 / 12 / 16 / 24 / 32：卡片与底框 padding 16、区块间距 24、卡片间距 12、胶囊底部留白 32。
  - EN: P2 / P3 spacing is unified to 4 / 8 / 12 / 16 / 24 / 32: card and frame padding 16, section gap 24, card gap 12, and 32px bottom space below the capsule.
- P1 的预算与订阅窗口改用内联环；浮层不再承载设置项，设置集中到整页底部胶囊。
  - EN: P1 budget and subscription windows now use inline rings; the floating panel no longer contains settings, which are centralized in the capsule at the bottom of the full page.
- 供应商取数改为按源表迭代：每源成功缓存 60s / 失败 10s + 并发合并；订阅重查覆盖 GLM、Kimi、OpenCode Go、Command Code。
  - EN: Provider fetching now iterates the source table: each source caches successes for 60s and failures for 10s, with concurrent request coalescing; subscription refreshes cover GLM, Kimi, OpenCode Go, and Command Code.
- 7 家 provider registry 与价格链接同步；非回环请求走安全门；错误分类补 `upstream` 标记。
  - EN: Synced the registry and pricing links for all seven providers; non-loopback requests go through the security gate; added an `upstream` error classification.

## [1.1.2] - 2026-11-03

### 修改 / Changes

- 用量/设置浮层宽度 320→360 CSS px，M 级 Tokens、请求、命中可在同一行完整显示；窄视口仍按 `100vw - 16px` 收缩
  - EN: Increased the usage/settings panel width from 320 to 360 CSS px so M-level Tokens, requests, and hits fit on one line; narrow viewports still shrink to `100vw - 16px`.

## [1.1.1] - 2026-11-02

### 修改 / Changes

- 用量页预算行改为「名称行四列（名称 / 百分比 / 已用总额 / 余额）+ 满宽迷你条」，数值列跨 provider 左缘对齐
  - EN: The usage page budget row now uses four name-row columns (name / percentage / used total / balance) plus a full-width mini bar; numeric columns align to the left edge across providers.
- 设置页订阅行只保留供应商名与重置时间，去掉「账户套餐」与配额百分比
  - EN: The settings subscription row now keeps only the provider name and reset time; removed “Account plan” and the quota percentage.
- 重置时间抽成统一组件，格式为 `x 分钟后 / 小时后 / 天后 · MM-DD HH:mm 重置`
  - EN: Extracted reset time into a shared component with the format `x min / x h / x d · reset at MM-DD HH:mm`.
- 用量页订阅窗口的 5h 与周按固定宽度成列，右侧迷你条贴分区右边界
  - EN: The 5h and weekly subscription windows now use fixed-width columns; the mini bars align to the right edge of each section.
- 两格卡精简：删除「按币种」、金额改用主题蓝，真实 Tokens 副行只保留三个数字
  - EN: Simplified the two-cell cards: removed “by currency”, changed amounts to the theme blue, and kept only the three numbers in the real Tokens sub-row.
- 去掉四处分区标题里的「（已检测 N）」
  - EN: Removed “(detected N)” from four section titles.

## [1.1.0] - 2026-11-02

### 新增 / Added

- P2 时间范围：当天 / 近7天 / 近30天 / 全部，独立 `/usage` 接口与范围切换
  - EN: Added P2 time ranges: today / last 7 days / last 30 days / all, with a dedicated `/usage` endpoint and range switching.
- P2 固定区（本月预算、订阅套餐）、两格统计卡与按 provider/模型的行卡片明细
  - EN: Added the P2 fixed section (monthly budget, subscription plan), two statistic cards, and per-provider / per-model row cards.
- P2 两格卡取统一聚合：总费用按币种，真实 Tokens 含缓存读写；订阅模型计入 Tokens、不计费用
  - EN: The two P2 cards use unified aggregation: total cost by currency, real Tokens include cache reads/writes; subscription models count toward Tokens but not cost.
- P3「数据与日志」入口：导出设置与当月使用数据为单个 JSON，导入覆盖当月并自动备份
  - EN: Added the P3 “Data & logs” entry: export settings and current-month usage as one JSON file; import replaces the current month and creates a backup automatically.
- P3 预算未填写时默认 100，清空记为未设置
  - EN: The P3 budget defaults to 100 when empty; clearing it records “not set”.
- 范围 tooltip、检查更新、订阅配额局部刷新
  - EN: Added range tooltips, update checks, and partial refresh for subscription quotas.

### 修改 / Changes

- 计费形态固化：配额查询失败不再让同一份历史数据在订阅 / 按量口径间跳动
  - EN: Billing mode is now stable: a failed quota request no longer makes the same historical data jump between subscription and usage-based views.
- 明细 Tokens 括号改为 输入 / 缓存（读+写）/ 输出，三数之和等于总数；近似价补 `≈`
  - EN: The Tokens bracket now shows input / cache (read+write) / output, and the three numbers add up to the total; approximate prices are marked with `≈`.
- 首屏与范围切换不再闪现 `¥0.00`，旧响应不会覆盖新范围
  - EN: The first screen and range switching no longer briefly show `¥0.00`; stale responses cannot overwrite a newer range.
- 供应商探测为空时立即重试；探测失败与未配置分开提示并提供重试
  - EN: Empty provider detection now retries immediately; detection failures and missing configuration show separate messages with retry.
- 设置页配置收敛为预算 / 计费模式 / 刷新间隔 / 余额开关，非法刷新间隔自动回落
  - EN: Settings now cover budget / billing mode / refresh interval / balance toggle; invalid refresh intervals fall back automatically.
- 设置页收敛为五分区：日志与备份恢复合并为「数据与日志」
  - EN: Settings now use five sections; logs and backup/restore are merged into “Data & logs”.
- P2 明细单行展示、只保留一个说明图标；P3 刷新间隔胶囊收窄
  - EN: P2 details use a single row with only one info icon; the P3 refresh-interval capsule is narrower.
- 界面跟随 DSH locale，补齐中英词条
  - EN: The UI follows the DSH locale, with complete Chinese and English strings.

## [1.0.7] - 2026-11-02

### 修改 / Changes

- 预算进度条恢复可见填充，颜色与主题按钮蓝一致
  - EN: Restored the visible fill in the budget progress bar, using the same blue as the theme button.
- provider 展示名 `DeepSeek 官方` 收短为 `DeepSeek`
  - EN: Shortened the provider display name from `DeepSeek 官方` to `DeepSeek`.
- 内置更新改为按目标版本安装并校验实际版本，不再出现“提示已更新但版本未变”
  - EN: Built-in updates now install the target version and verify the actual version, avoiding “updated” messages when the version did not change.
- 更新检查按 SemVer 比较版本，本地预发布包可直接升级到同版本正式版
  - EN: Update checks compare SemVer versions, so a local pre-release can upgrade directly to the same version's stable release.

## [1.0.6] - 2026-11-02

### 修改 / Changes

- 重构 provider / VM / UI 边界：provider 元数据收口到 registry，UI 价格链接统一由 VM 提供，适配器输出统一 `windows` / `error`；界面与计价结果不变。
  - EN: Refactored the provider / VM / UI boundaries: provider metadata is centralized in the registry, pricing links come from the VM, and adapter output is unified as `windows` / `error`; UI and pricing results are unchanged.

## [1.0.5] - 2026-11-02

### 新增 / Added

- 月度账本：`$DSH_HOME/dsh-token-dash/months/YYYY-MM.json` 独立记录每月日级消费/用量；`daily.json` 缺失或被重置时自动读回
  - EN: Added a monthly ledger at `$DSH_HOME/dsh-token-dash/months/YYYY-MM.json` for daily spend/usage per month; it is read back automatically if `daily.json` is missing or reset.
- 迁移备份自动恢复：启动时并回 `daily.json.pre-v2-*.bak`，再按日级 token 重算旧成本
  - EN: Migration backups are restored automatically: on startup, `daily.json.pre-v2-*.bak` files are merged back and historical costs are recalculated from daily tokens.
- 社区价格表 `dailySlots` 映射为峰谷价；周末全天按闲时计价
  - EN: Maps community pricing `dailySlots` to peak/off-peak rates; weekends use off-peak rates all day.
- 回归测试：社区表解析、历史恢复、月度账本、补行判重、成本对齐；E2E 覆盖恢复/账本/非零费用/行数
  - EN: Added regression tests for community pricing parsing, history restoration, the monthly ledger, duplicate-row prevention, and cost alignment; E2E covers restoration / ledger / non-zero cost / row counts.

### 修改 / Changes

- 修复社区价格表二次归一化把单价清空、今日与本月费用恒为 ¥0.00（今日/费用/占比/预算全部恢复）
  - EN: Fixed a second normalization pass on community pricing that cleared unit prices and made today/monthly costs always ¥0.00 (today / cost / share / budget are restored).
- 修复已配置供应商存在真实模型行时仍补默认 0 值行，导致两张明细表出现同名重复行
  - EN: Fixed default zero-value rows being added even when a configured provider had real model rows, which caused duplicate rows in both detail tables.
- 修复旧版迁移清空历史、会话 backfill 取不到数据导致统计“消失”：改为备份并回 + 就地重算，不删聚合
  - EN: Fixed old-version migration clearing history and session backfill returning no data, which made statistics disappear; it now backs up and merges data plus recalculates in place without deleting aggregates.
- 修正 DeepSeek Flash 内置价（闲 1/0.02/4、峰 2/0.04/8），重算前等待社区价格表（≤5s），`costVersion` 升到 3 重算历史
  - EN: Corrected the built-in DeepSeek Flash prices (off-peak 1/0.02/4, peak 2/0.04/8); recalculation waits up to 5s for community pricing; `costVersion` is now 3 and history is recalculated.
- E2E 宿主路径改按 `LOCALAPPDATA` 解析，移除用户目录与 Chromium 修订号硬编码
  - EN: E2E host paths now resolve via `LOCALAPPDATA`; removed hard-coded user paths and Chromium revision numbers.

## [1.0.2] - 2026-11-01

### 新增 / Added

- npm 发布切换 Trusted Publishing（OIDC 直发）：推 tag 全自动上线，免 token、含 provenance 溯源
  - EN: Switched npm publishing to Trusted Publishing (direct OIDC): pushing a tag deploys automatically, without a token and with provenance.

### 修改 / Changes

- 文档：`doc/release.md` 发版流程对齐 Trusted Publishing 实录；双语 README 开发节补发版说明
  - EN: Docs: aligned `doc/release.md` with the Trusted Publishing process; added release notes to the development section of both READMEs.

## [1.0.1] - 2026-11-01

### 新增 / Added

- npm 分发通道：`dsh plugin --profile desktop add dsh-token-dash`（README 安装段三方式）
  - EN: Added npm distribution: `dsh plugin --profile desktop add dsh-token-dash` (three installation methods in README).
- `publish.yml`：tag 触发自动发布 npm（provenance 附源信息）
  - EN: Added `publish.yml`: tags trigger automatic npm publishing with provenance.
- GitHub Issue 治理体系：标签 11 个、双语 Issue 模板（Bug 强制日志附件）、模板合规检查与超时自动关闭两个 Actions
  - EN: Added GitHub Issue governance: 11 labels, bilingual issue templates (bug reports require logs), and two Actions for template compliance checks and auto-closing stale issues.
- 英文版 `README.en.md`（中英互链）
  - EN: Added `README.en.md` with cross-links between Chinese and English.

### 修改 / Changes

- 根目录整理：`catalog.json` 移入 `src/`（与消费者同目录）
  - EN: Cleaned up the root: moved `catalog.json` into `src/` alongside its consumers.
- 新增 `tools/logs.mjs` 日志查看工具（`npm run logs`）、`doc/release.md` 发版 checklist、`doc/design.md` 设计文档
  - EN: Added `tools/logs.mjs` log viewer (`npm run logs`), `doc/release.md` release checklist, and `doc/design.md` design document.

## [1.0.0] - 2026-11-01

首个正式版。

First stable release.

### 新增 / Added

- 底栏 Pill：预算%（状态色）、今日消耗、账户余额；订阅显示 5h/周窗口与重置时间
  - EN: Bottom-bar Pill: budget % (with status color), today's spend, and account balance; subscriptions show 5h/weekly windows and reset times.
- 浮层看板：API 卡（独立预算 + 进度条）、订阅卡、按币种分组费用明细（/ 本月）、模型用量明细（/ 本月）
  - EN: Floating dashboard: API cards (separate budget + progress bar), subscription cards, cost details by currency (/ this month), and model usage details (/ this month).
- 设置：月度预算（按供应商 + 币种）、刷新间隔三档、账户余额开关、日志查看 / 导出、检查更新（确认 → 自动执行 → 重启提示）
  - EN: Settings: monthly budget (by provider + currency), three refresh intervals, balance toggle, log viewing / export, and update checks (confirm → run → restart prompt).
- 自动侦测五家供应商：DeepSeek（DS 账号 / API Key）、GLM Coding、Kimi Coding、OpenRouter、Qwen——配置即可见
  - EN: Auto-detects five providers: DeepSeek (DS account / API Key), GLM Coding, Kimi Coding, OpenRouter, and Qwen; configure and they appear.
- 三层模型归属：`message.source` → `request/header` → 模型名前缀，老数据也能正确归属
  - EN: Three-level model ownership: `message.source` → `request/header` → model-name prefix, so older data is attributed correctly.
- 错误链路日志（`errorKind` / `httpStatus` 分类）与 `npm run logs` 排查工具
  - EN: Error-path logs (`errorKind` / `httpStatus` classification) and the `npm run logs` troubleshooting tool.
- GitHub Release 产物安装（tarball 离线安装）
  - EN: Installed artifacts from GitHub Releases (offline tarball installation).

### 修改 / Changes

- 余额语义修正：显示账户余额而非预算剩余
  - EN: Corrected balance semantics: show account balance instead of remaining budget.
- P2 费用 / 用量明细严格本月口径；空表保留表格结构（数值 0）
  - EN: P2 cost / usage details strictly use the current month; empty tables retain their structure with zero values.
- 模型行跟随供应商配置：无消耗时补默认模型行（OpenRouter 显示 `-` 占位）
  - EN: Model rows follow provider configuration: add a default model row when there is no usage (OpenRouter shows `-`).
- P3 删除计费模式下拉（自动侦测）与“本月 Token”开关
  - EN: Removed the billing-mode dropdown (auto-detected) and the “this month's Tokens” toggle from P3.
- 浮层锚定 Pill 正上方弹出，支持点击浮层外收起；Pill 精简为 `[API] 预算% · 今日 · 余额`
  - EN: The panel opens directly above the Pill and closes on outside click; the Pill is simplified to `[API] budget% · today · balance`.
- 日志模块 `adapter.*` / `slot` 落地；损坏数据文件与写盘失败不再静默
  - EN: Added `adapter.*` / `slot` log modules; corrupted data files and write failures are no longer silent.
