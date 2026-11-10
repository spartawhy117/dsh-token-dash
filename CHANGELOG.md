# Changelog / 更新日志

本文件记录每个版本的**新增**与**修改**，中英双语。格式参考 [Keep a Changelog](https://keepachangelog.com/)。

This file records the **new features** and **changes** of each release in Chinese and English. Format follows [Keep a Changelog](https://keepachangelog.com/).

## [2.1.0] - 2026-11-10

### 中文

#### 新增

- 新增 Ollama 供应商：卡片显示套餐剩余与购买余额的合计、套餐已用进度、额度周期结束时间与渠道 30 天用量；余额接口限流时保留上次数值并标注「限流中」。
- 纯模型名计价：任意供应商（含第三方部署的 DeepSeek，如 `tencent`）都能按社区价目表出价，未命中时显示「未定价」并可补算。
- 费用列四态：`≈` 近似价、精确价、「未定价」（带原因提示）、零消耗 `—`。
- 未声明币种的第三方供应商在卡片标注「按社区表 CNY」；可用 `prefs.json` 的 `providerCurrency` 声明 CNY / USD。
- `prefs.json` 新增 `priceOverrides` / `providerCurrency`（仅认文件，无设置界面）；新增排障接口 `POST /token-dash/api/pricing/reprice`，启动时自动补算未定价行。

#### 修改

- 计价改为「价目币种必须与供应商一致」：价目表为人民币而供应商按美元结算时，该模型显示「未定价」并说明原因，不再把人民币数值当成美元金额；OpenRouter 与 Qwen 国际站同步修正，历史成本按新规则重算一次（订阅与零消耗记录保持原样）。
- 计价匹配改为四级短路（精确 → 别名 → 表内正则 → 结构化模糊），不再按供应商白名单丢弃行；订阅类供应商不再套模型价。
- 展开 Pill 面板时立即刷新（2 秒内去重）；面板可见期间轮询 10 秒，关闭后恢复设置值，整页看板同样按 10 秒跟进，并同时刷新费用与模型明细。
- 供应商探测日志改为「清单变化才记」：启动首轮与配置 Key / 掉线导致清单变动时输出一次（含已探测家数与未配置清单），不再每轮重复。
- 启动日志修正：价格表已就绪时不再误报降级，配置日志每次启动只记一条；`/summary`、`/usage` 日志新增供应商探测耗时与整次请求耗时。
- 设置区结构不变，仍为三行。

### English

#### Added

- New Ollama provider: the card shows total remaining credits (plan + purchased), plan usage progress, cycle end, and 30-day channel usage; when the balance endpoint is rate limited the last values stay visible with a "Rate limited" note.
- Model-name-only pricing: any provider (including third-party DeepSeek deployments such as `tencent`) is priced from the community catalog; misses show as "Unpriced" and can be backfilled.
- Four cost-cell states: `≈` approximate, exact, "Unpriced" with a reason tooltip, and `—` for zero-token rows.
- Providers without a declared currency show "Community table (CNY)" on the card; declare `prefs.json` `providerCurrency` to switch between CNY / USD.
- `prefs.json` gains `priceOverrides` / `providerCurrency` (file-only, no settings UI) plus a troubleshooting route `POST /token-dash/api/pricing/reprice`; unpriced rows are backfilled at startup.

#### Changes

- Pricing now requires the price-table currency to match the provider currency: when a CNY table meets a USD provider the model is shown as unpriced with a reason instead of rendering CNY numbers as USD. OpenRouter and Qwen international keys are corrected the same way, and historical costs are recalculated once (subscription and zero-usage rows stay untouched).
- Matching now short-circuits through exact → alias → table regex → structured fuzzy and no longer drops rows by provider whitelist; subscription providers are no longer priced per token.
- Expanding the Pill panel refreshes immediately (deduped within 2s); while the panel is open the poll interval drops to 10s and returns to the configured value when closed. The full dashboard polls at 10s too and refreshes both cost and model details.
- Provider probing now logs once when the probe list changes (first run after start, after adding a key, or after a provider drops out) with configured and unconfigured lists, instead of every refresh.
- Startup logs: no more false degraded-catalog warning when the catalog is already loaded, the pricing config is logged once per startup, and `/summary` / `/usage` logs carry provider-probe and total request durations.
- The settings area is unchanged (still three rows).

## [2.0.2] - 2026-11-06

### 中文

#### 修改

- P3「时间范围」由固定 300px 改为按内容自适应，英文 `Last 7 days` / `Last 30 days` 不再换行。
- provider 模式标签由「按量 API / Pay-as-you-go」改为「API 用量 / API usage」，P3 区块标题同步。
- 补齐英文界面缺失的 5 个词条；英文 README 使用英文界面截图。

### English

#### Changes

- The P3 time-range control now sizes to its content instead of a fixed 300px, so `Last 7 days` / `Last 30 days` no longer wrap.
- Provider mode labels are now “API 用量 / API usage” instead of “按量 API / Pay-as-you-go”; the P3 section title was updated to match.
- Added five missing English UI strings; README.en now uses English screenshots.

## [2.0.1] - 2026-11-05

### 中文

#### 修改

- P3 设置标题右侧新增语言支持说明：语言跟随 DSH，当前仅中文 / English，其他语言回退英文。
- provider 显示名统一英文：`Zhipu AI`、`Qwen`；provider ID、模型 ID、币种与模型映射不变。
- README / UI 文档补充当前语言覆盖范围与英文回退说明。

### English

#### Changes

- Added a language note beside the P3 settings title: the language follows DSH; only Chinese / English are available, and other languages fall back to English.
- Unified provider display names to English: `Zhipu AI` and `Qwen`. Provider IDs, model IDs, currencies, and model mappings are unchanged.
- README and UI documentation now describe the current language coverage and English fallback.

## [2.0.0] - 2026-11-05

### 中文

#### 新增

- 全量看板升级为 7 家供应商卡片：DeepSeek、GLM、Kimi、OpenRouter、Qwen、OpenCode Go、Command Code；按量与订阅分开展示，订阅窗口支持 5h / 周 / 月。
- 接入 OpenCode Go 与 Command Code：订阅配额、余额 / credits 与窗口倒计时；Command Code 支持 `orgId` 预检。
- 新增「Token 看板」整页：侧栏入口或浮层「全量看板」进入，包含供应商卡片、摘要带、8 列模型明细与设置胶囊。
- 看板页头新增「★ / ⟳」入口；明细模型列追加供应商后缀，模型名过长时省略。
- 日志体系升级：JSONL 每行带 `[TD:<module>]` 前缀，新增供应商失败、路由拒绝与缓存状态事件，日志头动态记录 DSH 版本。

#### 修改

- P2 固定 380：摘要改为单行三组（环 / 已用·预算 / 真实余额），移除「本月已花」；真实余额右对齐到面板右缘，范围条撑满，订阅窗口固定三槽位（两窗占前两槽），模型列上限 150。
- P3 定稿：页头只留两枚 44×26 蓝色按钮；设置胶囊移除「立即刷新」，刷新间隔左对齐、账户余额右对齐；页面自持滚动，滚动条贴窗口右缘。
- P3 明细模型列上限 240，7 个数值列等宽，字号 13；除模型列外全部右对齐，长模型名不再挤压数字。
- P2 / P3 间距统一到 4 / 8 / 12 / 16 / 24 / 32：卡片与底框 padding 16、区块间距 24、卡片间距 12、胶囊底部留白 32。
- P1 的预算与订阅窗口改用内联环；浮层不再承载设置项，设置集中到整页底部胶囊。
- 供应商取数改为按源表迭代：每源成功缓存 60s / 失败 10s + 并发合并；订阅重查覆盖 GLM、Kimi、OpenCode Go、Command Code。
- 7 家 provider registry 与价格链接同步；非回环请求走安全门；错误分类补 `upstream` 标记。
- P1 在输入框底栏内右移（`composer.dock` 的 Pill 根节点 `order:10`），并移除 hero 槽位注入，官方 Agent 模式按钮恢复。
- P2 摘要「真实余额」跨第 3–4 列并右对齐到面板右缘，前三组位置不变。
- P3 设置区新增画框外「设置与数据管理」区块标题（13px / 600），胶囊内三行功能不变。

### English

#### Added

- The full dashboard now shows seven provider cards: DeepSeek, GLM, Kimi, OpenRouter, Qwen, OpenCode Go, and Command Code. API usage and subscription cards are separated; subscription windows support 5h / weekly / monthly.
- Added OpenCode Go and Command Code: subscription quotas, balance / credits, and window countdowns; Command Code supports an `orgId` preflight check.
- Added the full “Token dashboard” page, reachable from the sidebar or the “Full dashboard” action in the panel; it includes provider cards, a summary strip, an eight-column model table, and a settings capsule.
- Added “★ / ⟳” actions to the dashboard header; model rows now include a provider suffix, and long model names are truncated.
- Upgraded logging: every JSONL line includes a `[TD:<module>]` prefix; added provider failure, route rejection, and cache status events; the log header now records the DSH version dynamically.

#### Changes

- P2 remains fixed at 380px: the summary is now one row with three groups (ring / used-budget / real balance), and “Spent this month” was removed. Real balance is right-aligned to the panel edge; the range control fills the row; subscription windows use three fixed slots (two windows use the first two); model names are capped at 150px.
- P3 finalized: the header keeps only two 44×26 blue buttons; the settings capsule no longer has “Refresh now”; the refresh interval is left-aligned and the balance toggle is right-aligned; the page scrolls internally with the scrollbar at the window edge.
- The P3 model column is capped at 240px; the seven numeric columns share equal width at 13px; all columns except the model column are right-aligned, so long model names no longer squeeze the numbers.
- P2 / P3 spacing is unified to 4 / 8 / 12 / 16 / 24 / 32: card and frame padding 16, section gap 24, card gap 12, and 32px bottom space below the capsule.
- P1 budget and subscription windows now use inline rings; the floating panel no longer contains settings, which are centralized in the capsule at the bottom of the full page.
- Provider fetching now iterates over the source table: each source caches successes for 60s and failures for 10s, with concurrent request coalescing; subscription refreshes cover GLM, Kimi, OpenCode Go, and Command Code.
- Synced the registry and pricing links for all seven providers; non-loopback requests go through the security gate; added an `upstream` error classification.
- Moved P1 to the right of the composer footer (`order:10` on the Pill root in `composer.dock`), removed the hero slot injection, and restored the official Agent mode button.
- P2 real balance now spans columns 3–4 and is right-aligned to the panel edge; the positions of the first three groups are unchanged.
- Added an external “Settings and data” section title above the P3 settings capsule (13px / 600); the three capsule rows are unchanged.

## [1.3.0] - 2026-11-05

### 中文

#### 新增

- 全量看板升级为 7 家供应商卡片：DeepSeek、GLM、Kimi、OpenRouter、Qwen、OpenCode Go、Command Code；按量与订阅分开展示，订阅窗口支持 5h / 周 / 月。
- 接入 OpenCode Go 与 Command Code：订阅配额、余额 / credits 与窗口倒计时；Command Code 支持 `orgId` 预检。
- 新增「Token 看板」整页：侧栏入口或浮层「全量看板」进入，包含供应商卡片、摘要带、8 列模型明细与设置胶囊。
- 看板页头新增「★ / ⟳」入口；明细模型列追加供应商后缀，模型名过长时省略。
- 日志体系升级：JSONL 每行带 `[TD:<module>]` 前缀，新增供应商失败、路由拒绝与缓存状态事件，日志头动态记录 DSH 版本。

#### 修改

- P2 固定 380：摘要改单行四组（环 / 已用·预算 / 真实余额 / 本月已花），范围条撑满，订阅窗口固定三槽位（两窗占前两槽），模型列上限 150。
- P3 定稿：页头只留两枚 44×26 蓝色按钮；设置胶囊移除「立即刷新」，刷新间隔左对齐、账户余额右对齐；页面自持滚动，滚动条贴窗口右缘。
- P3 明细模型列上限 240，7 个数值列等宽，字号 13；除模型列外全部右对齐，长模型名不再挤压数字。
- P2 / P3 间距统一到 4 / 8 / 12 / 16 / 24 / 32：卡片与底框 padding 16、区块间距 24、卡片间距 12、胶囊底部留白 32。
- P1 的预算与订阅窗口改用内联环；浮层不再承载设置项，设置集中到整页底部胶囊。
- 供应商取数改为按源表迭代：每源成功缓存 60s / 失败 10s + 并发合并；订阅重查覆盖 GLM、Kimi、OpenCode Go、Command Code。
- 7 家 provider registry 与价格链接同步；非回环请求走安全门；错误分类补 `upstream` 标记。

### English

#### Added

- The full dashboard now shows seven provider cards: DeepSeek, GLM, Kimi, OpenRouter, Qwen, OpenCode Go, and Command Code. API usage and subscription cards are separated; subscription windows support 5h / weekly / monthly.
- Added OpenCode Go and Command Code: subscription quotas, balance / credits, and window countdowns; Command Code supports an `orgId` preflight check.
- Added the full “Token dashboard” page, reachable from the sidebar or the “Full dashboard” action in the panel; it includes provider cards, a summary strip, an eight-column model table, and a settings capsule.
- Added “★ / ⟳” actions to the dashboard header; model rows now include a provider suffix, and long model names are truncated.
- Upgraded logging: every JSONL line includes a `[TD:<module>]` prefix; added provider failure, route rejection, and cache status events; the log header now records the DSH version dynamically.

#### Changes

- P2 remains fixed at 380px: the summary uses one row with four groups (ring / used-budget / real balance / spent this month); the range control fills the row; subscription windows use three fixed slots (two windows use the first two); model names are capped at 150px.
- P3 finalized: the header keeps only two 44×26 blue buttons; the settings capsule no longer has “Refresh now”; the refresh interval is left-aligned and the balance toggle is right-aligned; the page scrolls internally with the scrollbar at the window edge.
- The P3 model column is capped at 240px; the seven numeric columns share equal width at 13px; all columns except the model column are right-aligned, so long model names no longer squeeze the numbers.
- P2 / P3 spacing is unified to 4 / 8 / 12 / 16 / 24 / 32: card and frame padding 16, section gap 24, card gap 12, and 32px bottom space below the capsule.
- P1 budget and subscription windows now use inline rings; the floating panel no longer contains settings, which are centralized in the capsule at the bottom of the full page.
- Provider fetching now iterates over the source table: each source caches successes for 60s and failures for 10s, with concurrent request coalescing; subscription refreshes cover GLM, Kimi, OpenCode Go, and Command Code.
- Synced the registry and pricing links for all seven providers; non-loopback requests go through the security gate; added an `upstream` error classification.

## [1.1.2] - 2026-11-03

### 中文

#### 修改

- 用量/设置浮层宽度 320→360 CSS px，M 级 Tokens、请求、命中可在同一行完整显示；窄视口仍按 `100vw - 16px` 收缩

### English

#### Changes

- Increased the usage/settings panel width from 320 to 360 CSS px so M-level Tokens, requests, and hits fit on one line; narrow viewports still shrink to `100vw - 16px`.

## [1.1.1] - 2026-11-02

### 中文

#### 修改

- 用量页预算行改为「名称行四列（名称 / 百分比 / 已用总额 / 余额）+ 满宽迷你条」，数值列跨 provider 左缘对齐
- 设置页订阅行只保留供应商名与重置时间，去掉「账户套餐」与配额百分比
- 重置时间抽成统一组件，格式为 `x 分钟后 / 小时后 / 天后 · MM-DD HH:mm 重置`
- 用量页订阅窗口的 5h 与周按固定宽度成列，右侧迷你条贴分区右边界
- 两格卡精简：删除「按币种」、金额改用主题蓝，真实 Tokens 副行只保留三个数字
- 去掉四处分区标题里的「（已检测 N）」

### English

#### Changes

- The usage page budget row now has four columns in its name row (name / percentage / used total / balance) plus a full-width mini bar; numeric columns align to the left edge across providers.
- The settings subscription row now keeps only the provider name and reset time; removed “Account plan” and the quota percentage.
- Reset time is now a shared component, formatted as `x min / x h / x d · reset at MM-DD HH:mm`.
- The 5h and weekly subscription windows now use fixed-width columns; the mini bars align to the right edge of each section.
- Simplified the two-cell cards: removed “by currency”, changed amounts to the theme blue, and kept only the three numbers in the real Tokens sub-row.
- Removed “(detected N)” from four section titles.

## [1.1.0] - 2026-11-02

### 中文

#### 新增

- P2 时间范围：当天 / 近7天 / 近30天 / 全部，独立 `/usage` 接口与范围切换
- P2 固定区（本月预算、订阅套餐）、两格统计卡与按 provider/模型的行卡片明细
- P2 两格卡取统一聚合：总费用按币种，真实 Tokens 含缓存读写；订阅模型计入 Tokens、不计费用
- P3「数据与日志」入口：导出设置与当月使用数据为单个 JSON，导入覆盖当月并自动备份
- P3 预算未填写时默认 100，清空记为未设置
- 范围 tooltip、检查更新、订阅配额局部刷新

#### 修改

- 计费形态固化：配额查询失败不再让同一份历史数据在订阅 / 按量口径间跳动
- 明细 Tokens 括号改为 输入 / 缓存（读+写）/ 输出，三数之和等于总数；近似价补 `≈`
- 首屏与范围切换不再闪现 `¥0.00`，旧响应不会覆盖新范围
- 供应商探测为空时立即重试；探测失败与未配置分开提示并提供重试
- 设置页配置收敛为预算 / 计费模式 / 刷新间隔 / 余额开关，非法刷新间隔自动回落
- 设置页收敛为五分区：日志与备份恢复合并为「数据与日志」
- P2 明细单行展示、只保留一个说明图标；P3 刷新间隔胶囊收窄
- 界面跟随 DSH locale，补齐中英词条

### English

#### Added

- Added P2 time ranges: today / last 7 days / last 30 days / all, with a dedicated `/usage` endpoint and range switching.
- Added the P2 fixed section (monthly budget, subscription plan), two statistic cards, and per-provider / per-model row cards.
- The two P2 cards use unified aggregation: total cost by currency, real Tokens include cache reads/writes; subscription models count toward Tokens but not cost.
- Added the P3 “Data & logs” entry: export settings and current-month usage as one JSON file; import replaces the current month and creates a backup automatically.
- The P3 budget defaults to 100 when empty; clearing it records “not set”.
- Added range tooltips, update checks, and partial refresh for subscription quotas.

#### Changes

- Billing mode is now stable: a failed quota query no longer makes the same historical data jump between subscription and usage-based views.
- The Tokens bracket now shows input / cache (read+write) / output, and the three numbers add up to the total; approximate prices are marked with `≈`.
- The first screen and range switching no longer briefly show `¥0.00`; stale responses cannot overwrite a newer range.
- When no providers are detected, the plugin retries immediately; detection failures and missing configuration show separate messages with retry.
- Settings now cover budget / billing mode / refresh interval / balance toggle; invalid refresh intervals fall back automatically.
- Settings now use five sections; logs and backup/restore are merged into “Data & logs”.
- P2 details use a single row with only one info icon; the P3 refresh-interval capsule is narrower.
- The UI follows the DSH locale, with complete Chinese and English strings.

## [1.0.7] - 2026-11-02

### 中文

#### 修改

- 预算进度条恢复可见填充，颜色与主题按钮蓝一致
- provider 展示名 `DeepSeek 官方` 收短为 `DeepSeek`
- 内置更新改为按目标版本安装并校验实际版本，不再出现“提示已更新但版本未变”
- 更新检查按 SemVer 比较版本，本地预发布包可直接升级到同版本正式版

### English

#### Changes

- Restored the visible fill in the budget progress bar, using the same blue as the theme button.
- Shortened the provider display name from `DeepSeek 官方` to `DeepSeek`.
- Built-in updates now install the target version and verify the actual version, avoiding “updated” messages when the version did not change.
- Update checks compare SemVer versions, so a local pre-release can upgrade directly to the same version's stable release.

## [1.0.6] - 2026-11-02

### 中文

#### 修改

- 重构 provider / VM / UI 边界：provider 元数据收口到 registry，UI 价格链接统一由 VM 提供，适配器输出统一 `windows` / `error`；界面与计价结果不变。

### English

#### Changes

- Refactored the provider / VM / UI boundaries: provider metadata is centralized in the registry, pricing links come from the VM, and adapter output is unified as `windows` / `error`; UI and pricing results are unchanged.

## [1.0.5] - 2026-11-02

### 中文

#### 新增

- 月度账本：`$DSH_HOME/dsh-token-dash/months/YYYY-MM.json` 独立记录每月日级消费/用量；`daily.json` 缺失或被重置时自动读回
- 迁移备份自动恢复：启动时并回 `daily.json.pre-v2-*.bak`，再按日级 token 重算旧成本
- 社区价格表 `dailySlots` 映射为峰谷价；周末全天按闲时计价
- 回归测试：社区表解析、历史恢复、月度账本、补行判重、成本对齐；E2E 覆盖恢复/账本/非零费用/行数

#### 修改

- 修复社区价格表二次归一化把单价清空、今日与本月费用恒为 ¥0.00（今日/费用/占比/预算全部恢复）
- 修复已配置供应商存在真实模型行时仍补默认 0 值行，导致两张明细表出现同名重复行
- 修复旧版迁移清空历史、会话 backfill 取不到数据导致统计“消失”：改为备份并回 + 就地重算，不删聚合
- 修正 DeepSeek Flash 内置价（闲 1/0.02/4、峰 2/0.04/8），重算前等待社区价格表（≤5s），`costVersion` 升到 3 重算历史
- E2E 宿主路径改按 `LOCALAPPDATA` 解析，移除用户目录与 Chromium 修订号硬编码

### English

#### Added

- Added a monthly ledger at `$DSH_HOME/dsh-token-dash/months/YYYY-MM.json` for daily spend/usage per month; it is read back automatically if `daily.json` is missing or reset.
- Migration backups are restored automatically: on startup, `daily.json.pre-v2-*.bak` files are merged back and historical costs are recalculated from daily tokens.
- Maps community pricing `dailySlots` to peak/off-peak rates; weekends use off-peak rates all day.
- Added regression tests for community pricing parsing, history restoration, the monthly ledger, duplicate-row prevention, and cost alignment; E2E covers restoration / ledger / non-zero cost / row counts.

#### Changes

- Fixed a second normalization pass on community pricing that cleared unit prices and made today/monthly costs always ¥0.00 (today / cost / share / budget are restored).
- Fixed default zero-value rows being added even when a configured provider had real model rows, which caused duplicate rows in both detail tables.
- Fixed old-version migration clearing history and session backfill returning no data, which made statistics disappear; it now backs up and merges data plus recalculates in place without deleting aggregates.
- Corrected the built-in DeepSeek Flash prices (off-peak 1/0.02/4, peak 2/0.04/8); recalculation waits up to 5s for community pricing; `costVersion` is now 3 and history is recalculated.
- E2E host paths now resolve via `LOCALAPPDATA`; removed hard-coded user paths and Chromium revision numbers.

## [1.0.2] - 2026-11-01

### 中文

#### 新增

- npm 发布切换 Trusted Publishing（OIDC 直发）：推 tag 全自动上线，免 token、含 provenance 溯源

#### 修改

- 文档：`doc/release.md` 发版流程对齐 Trusted Publishing 实录；双语 README 开发节补发版说明

### English

#### Added

- Switched npm publishing to Trusted Publishing (direct OIDC): pushing a tag publishes automatically, without a token and with provenance.

#### Changes

- Docs: aligned `doc/release.md` with the Trusted Publishing process; added release notes to the development section of both READMEs.

## [1.0.1] - 2026-11-01

### 中文

#### 新增

- npm 分发通道：`dsh plugin --profile desktop add dsh-token-dash`（README 安装段三方式）
- `publish.yml`：tag 触发自动发布 npm（provenance 附源信息）
- GitHub Issue 治理体系：标签 11 个、双语 Issue 模板（Bug 强制日志附件）、模板合规检查与超时自动关闭两个 Actions
- 英文版 `README.en.md`（中英互链）

#### 修改

- 根目录整理：`catalog.json` 移入 `src/`（与消费者同目录）
- 新增 `tools/logs.mjs` 日志查看工具（`npm run logs`）、`doc/release.md` 发版 checklist、`doc/design.md` 设计文档

### English

#### Added

- Added npm distribution: `dsh plugin --profile desktop add dsh-token-dash` (three installation methods in README).
- Added `publish.yml`: tags trigger automatic npm publishing with provenance.
- Added GitHub Issue governance: 11 labels, bilingual issue templates (bug reports require logs), and two Actions for template compliance checks and auto-closing stale issues.
- Added `README.en.md` with cross-links between Chinese and English.

#### Changes

- Cleaned up the root: moved `catalog.json` into `src/` alongside its consumers.
- Added `tools/logs.mjs` log viewer (`npm run logs`), `doc/release.md` release checklist, and `doc/design.md` design document.

## [1.0.0] - 2026-11-01

### 中文

首个正式版。

#### 新增

- 底栏 Pill：预算%（状态色）、今日消耗、账户余额；订阅显示 5h/周窗口与重置时间
- 浮层看板：API 卡（独立预算 + 进度条）、订阅卡、按币种分组费用明细（/ 本月）、模型用量明细（/ 本月）
- 设置：月度预算（按供应商 + 币种）、刷新间隔三档、账户余额开关、日志查看 / 导出、检查更新（确认 → 自动执行 → 重启提示）
- 自动侦测五家供应商：DeepSeek（DS 账号 / API Key）、GLM Coding、Kimi Coding、OpenRouter、Qwen——配置即可见
- 三层模型归属：`message.source` → `request/header` → 模型名前缀，老数据也能正确归属
- 错误链路日志（`errorKind` / `httpStatus` 分类）与 `npm run logs` 排查工具
- GitHub Release 产物安装（tarball 离线安装）

#### 修改

- 余额语义修正：显示账户余额而非预算剩余
- P2 费用 / 用量明细严格本月口径；空表保留表格结构（数值 0）
- 模型行跟随供应商配置：无消耗时补默认模型行（OpenRouter 显示 `-` 占位）
- P3 删除计费模式下拉（自动侦测）与“本月 Token”开关
- 浮层锚定 Pill 正上方弹出，支持点击浮层外收起；Pill 精简为 `[API] 预算% · 今日 · 余额`
- 日志模块 `adapter.*` / `slot` 落地；损坏数据文件与写盘失败不再静默

### English

First stable release.

#### Added

- Bottom-bar Pill: budget % (with status color), today's spend, and account balance; subscriptions show 5h/weekly windows and reset times.
- Floating dashboard: API cards (separate budget + progress bar), subscription cards, cost details by currency (/ this month), and model usage details (/ this month).
- Settings: monthly budget (by provider + currency), three refresh intervals, balance toggle, log viewing / export, and update checks (confirm → run → restart prompt).
- Auto-detects five providers: DeepSeek (DS account / API Key), GLM Coding, Kimi Coding, OpenRouter, and Qwen; configure and they appear.
- Three-level model ownership: `message.source` → `request/header` → model-name prefix, so older data is attributed correctly.
- Error-path logs (`errorKind` / `httpStatus` classification) and the `npm run logs` troubleshooting tool.
- GitHub Release artifact installation (offline tarball installation).

#### Changes

- Corrected balance semantics: show account balance instead of remaining budget.
- P2 cost / usage details strictly use the current month; empty tables retain their structure with zero values.
- Model rows follow provider configuration: add a default model row when there is no usage (OpenRouter shows `-`).
- Removed the billing-mode dropdown (auto-detected) and the “this month's Tokens” toggle from P3.
- The panel opens directly above the Pill and closes on outside click; the Pill is simplified to `[API] budget% · today · balance`.
- Added `adapter.*` / `slot` log modules; corrupted data files and write failures are no longer silent.
