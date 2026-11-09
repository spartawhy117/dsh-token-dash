# DSH Token 看板：多供应商预算、订阅配额与本地计价

> 状态：已实施<br>
> 完成时间：2026-11-02<br>
> 关联逻辑根：`dsh-token-dash`<br>
> 关联资料：[UI checklist（已归档）](../../checklist/archived/token-dash-ui-build-checklist.md)、[治理 checklist（已归档）](../../checklist/archived/github-governance-build-checklist.md)、[Provider 边界（已归档）](feature_provider_boundary.md)、[UI 设计](../../ui-design.md)、[下一轮 UI 迭代](feature_ui_refresh.md)

## 一、最终需求与范围

| ID | 最终处置 | 需求 / 边界 / 风险 | 最终结论或迁移去向 |
|---|---|---|---|
| REQ-01 | 完成 | P1 跟随当前 provider；API 显示预算 %、今日、余额 | 两槽位 Pill；未知默认 API；桌面验收 |
| REQ-02 | 完成 | 订阅 provider 显示账户级 5h / 周百分比 | GLM / Kimi 窗口来自官方配额 |
| REQ-03 | 完成 | 判定不了时默认 API；P1 不显示对话 Token | 文案 `[API] --` |
| REQ-04 | 完成 | P2 每 API provider 独立预算 + 进度条 | 无预算满格中性色、无百分比 |
| REQ-05 | 完成 | P2 每订阅 provider 一张卡；统一“重新检测” | 5h/周/月窗口 + 重置时间 |
| REQ-06 | 完成 | API 费用表只统计 API；CNY/USD 分组；订阅只进用量表 | 无跨币种合计 |
| REQ-07 | 完成 | P3 只做设置：API 预算、订阅模式、显示、日志、价格、更新 | 无单价编辑 |
| REQ-08 | 完成 | VM 拆 `providers / balances / plans / apiTotals` | 单 `balance` 已移除 |
| REQ-09 | 完成 | 自动侦测 DeepSeek / Kimi / GLM / OpenRouter / Qwen | 其他 provider 不显示 |
| REQ-10 | 完成 | GLM 配额严格参考社区实现 | 401 / 空窗口降级 |
| REQ-11 | 完成 | Kimi 配额严格参考社区实现 | legacy / current 两代；普通 Key 只查余额 |
| REQ-12 | 完成 | OpenRouter credits + `/models` 价格 | 不请求订阅接口 |
| REQ-13 | 完成 | `catalog.json` + 社区价格 + family-latest 回退 | 近似价标 `≈`；跨代未定价 |
| REQ-14 | 完成 | 只读本地；不抓网页、不读凭证文件、不上传 | 停用即停订阅 / 定时器 |
| REQ-15 | 完成 | Qwen 仅 API：百炼 / DashScope，CNY 或 USD | 无 quota；不显示订阅百分比 |
| REQ-16 | 完成 | P2/P3 只渲染已配置 / 已检测 provider | 不预置固定卡片数 |
| REQ-17 | 完成 | P3 只保留“查看日志”：打开固定目录 + 导出 | 无级别 / 清空；不自动上传 |
| BND-01 | 保持 | 只支持五家；Qwen 仅 API | 不出现未知中转 |
| BND-02 | 保持 | 订阅百分比是账户级 | 文案带“账户套餐” |
| BND-03 | 保持 | 不做价格编辑、汇率换算、自定义币种 | P3 无单价输入 |
| BND-04 | 保持 | 不做 OS 悬浮窗、多用户、云同步 | 仅 DSH 窗口内 |
| BND-05 | 保持 | 日志不含 Key、prompt、完整响应；不自动上传 | 导出前二次脱敏 |
| RSK-01 | 已验证 | 社区价格表滞后 / 失真 | bundled 回退 + `updatedAt` + 近似价 |
| RSK-02 | 已验证 | 订阅接口字段漂移 | fixture 契约测试；失败显示“套餐查询失败” |
| RSK-03 | 已验证 | 槽位 / DOM 变化导致 P1 不显示 | 失败不白屏，设置入口保留 |
| RSK-04 | 已验证 | 多币种被错误合并 | 按币种分组；禁止跨币种合计 |
| RSK-05 | 已验证 | 日志泄露或过大 | 脱敏 + 轮转 + 大小上限 |

## 二、最终实现

### 3.0 最终改动总览

| ID | 类型 | 文件 | 开发改动说明 |
|---|---|---|---|
| CHG-01 | 新增 | `catalog.json` | DeepSeek / GLM / Kimi 模型、family、alias、四类价格；version / updatedAt / source |
| CHG-02 | 新增 | `src/pricing.js` | 社区源加载 / 校验 / 缓存；exact / alias / family 匹配；近似价标记 |
| CHG-03 | 新增 | `src/providers.js` | 五家识别、adapter 路由、currency；Qwen 固定 API |
| CHG-04 | 修改 | `src/collect.js` | `message.source` 归属、session 维度、usage 分桶 |
| CHG-05 | 修改 | `src/core.js` | `SummaryVM`、provider/model 分桶、预算、币种分组 |
| CHG-06 | 修改 | `src/store.js` | `budgets[providerId]`、catalog 版本 / 缓存、旧 prefs 迁移 |
| CHG-07 | 修改 | `index.js` | 装配 pricing / providers、quota / credits、summary 路由 |
| CHG-08 | 修改 | `client.js` | P1 两态；P2 API 卡 / 订阅卡 / 币种表；P3 简化设置 |
| CHG-09 | 修改 | `scripts/e2e.mjs` | fixture server、P1/P2/P3 断言、五家 mock |
| CHG-10 | 新增 | `test/unit/*.test.mjs` | pricing、VM、adapter parser、currency、预算 |
| CHG-11 | 新增 | `src/diagnostics.js` | JSONL 日志、轮转、脱敏、导出 header / 错误摘要 |
| CHG-12 | 修改 | `client.js` | P3 仅“查看日志”：`/open-in-app/open` + 导出 |
| CHG-13 | 修改 | `src/pricing.js` | `normalizeEntry` 峰谷 null 归一化，二次归一化不清空单价 |
| CHG-14 | 修改 | `src/core.js` | `addRecord` 缺价按未定价；`buildSummary` 已有真实行不再补默认行 |
| CHG-15 | 修改 | `src/store.js` / `src/core.js` / `index.js` | 历史恢复：并回 `.pre-v2` 备份后按日 token 重算 |
| CHG-16 | 修改 | `scripts/e2e.mjs` / `test/unit/*` | E2E-45/46/47、迁移 / 定价 / 补行用例；宿主与 Chromium 路径自适应 |
| CHG-17 | 修改 | `src/store.js` | 月度账本 `months/YYYY-MM.json` 写入 / 读回；daily 缺失兜底 |
| CHG-18 | 修改 | `src/catalog.json` / `src/pricing.js` / `index.js` | 官方价对齐、工作日 / 周末与 `dailySlots` 峰谷、重算前等价格表；`costVersion 3` |

### 2.1 最终结构

```text
[DSH sessions] → collect.ingest（三层归属）→ daily.json + months/*.json
                                            │
[adapters：五家 balance / quota / credits] → ProviderSnapshot
                                            │
                    [buildSummary + providerRegistry] → SummaryVM
                                            │
                     [client：P1 Pill / P2 看板 / P3 设置]
```

### 2.2 关键契约

| 层 | 名称 | 最终契约 |
|---|---|---|
| VM | `SummaryVM` | `providers / breakdown / today / month / cost / apiTotals / currentProviderId / pricingLinks / version / refreshMs` |
| VM | `ProviderVM` | `id / name / kind / currency / usage / budget? / balance? / windows?` |
| VM | `QuotaWindow` | `key: 5h / week / month`；`usedPercent` 仅官方 ratio；`resetAt`；`source: official` |
| adapter | `toSnapshot` | `windows / error / quotaError / status / fetchedAt`；不泄漏 `_error` / `plans` |
| store | 月度账本 | `$DSH_HOME/dsh-token-dash/months/YYYY-MM.json`；daily 缺失读回 |

### 2.3 关键决策

| # | 定案 |
|---|---|
| D-01 | P1 两态（API / 订阅）；未知默认 API；不显示对话 Token |
| D-02 | 订阅百分比账户级，不拆单对话 |
| D-03 | 每 API provider 独立预算；无预算满格不显示百分比 |
| D-04 | CNY / USD 分组，不换算、不合并 |
| D-05 | 价格源：`catalog.json` + 社区表；24h 缓存 + bundled 回退 |
| D-06 | 新模型 exact → alias → family-latest；跨代未定价 |
| D-07 | 订阅 adapter 严格参考三个社区仓库 |
| D-08 | P3 只做预算与模式；不做价格编辑 |
| D-09 | 无订阅 Key，L5 不覆盖；不购买测试 Key |
| D-10 | Qwen 仅 API；国内 CNY、国际 USD；无 quota |
| D-11 | P2/P3 只渲染已配置 / 已检测 provider |
| D-12 | P3 日志只保留打开目录 + 导出；固定 info；脱敏 |
| D-13 | 检查更新：确认后由 host 执行安装，完成提示重启（后由 #25/#26 修正版本与升级判定） |
| D-14 | “本月 Token”开关删除；prefs 字段保留兼容 |
| D-15 | P3 不处理 Esc；关闭走按钮 / 外部点击 |
| D-16 | 订阅卡标题：GLM Coding / Kimi Coding |

### 2.4 关键陷阱

| 项 | 约束 |
|---|---|
| 订阅百分比 | 账户级，不能拆“本对话已用” |
| 余额与预算 | 余额是账户余额；预算剩余只进进度条，不互换 |
| OpenRouter credits | 不是订阅窗口 |
| 跨 provider / family 套价 | 禁止；跨代价格为空 |
| 社区价格表 | 可能滞后 / 失真；必须 bundled 回退 + `updatedAt` |
| relay / 未知 host | 不请求官方 quota |
| Qwen | 无订阅 quota；国际站 USD 未收录则“未定价” |
| P1 槽位 | 失败不白屏；设置入口保留 |

## 三、不改动 / 边界

- 不修改 DSH 本体、原生 composer、ContextMeter。
- 不读取 `.credentials.yaml`，不把 Key 发给非官方 host。
- 不做价格编辑、模型展开、汇率换算、自定义币种。
- 不做 OS 悬浮窗、账号登录、多用户 / 云同步。
- 日志不自动上传、不含 Key / prompt / 完整响应。

## 四、最终验收

| 项 | 来源 | 环境与方式 | 结果 |
|---|---|---|---|
| P1 API / 订阅两态 | REQ-01/02 | L3 mock + 桌面走查 | ✅ |
| P2 多 provider / 独立进度条 | REQ-04/16 | L3 mock；无预算满格 | ✅ |
| 币种分组与费用表 | REQ-06 | L2 VM + L3 | ✅ |
| 五家侦测 / adapter | REQ-09..12/15 | L1 + L4 fixture | ✅ |
| 社区价格回退 / 近似价 | REQ-13 | L1 + L2 | ✅ |
| 日志导出 / 脱敏 / 轮转 | REQ-17/BND-05 | L1 + L3 | ✅ |
| 历史恢复 / 月度账本 | REQ-14 | L1 + E2E-46 | ✅ |
| 成本对齐官方价 | REQ-01/06 | L1 + 同源对照 | ✅ |
| 更新链路（1.0.6 → 1.0.7） | REQ-07 | 实测 local.2 → 1.0.7；日志 from/to | ✅ |
| L5 真实订阅 | — | 无订阅 Key，不购买测试 Key | [不覆盖] |

发布：1.0.0（2026-11-01）→ 1.0.7（2026-11-02，最新）；L1 55/55 + E2E pass（1.0.7）。

## 五、计划—实际重大偏差

- 计划 1.0.0 收口 #1-#18 → 实际到 1.0.7 累计 #1-#26（新增月度账本、历史恢复、成本对齐、更新链路修复）。
- 计划无月度账本 → 实际 1.0.5 增加 `months/YYYY-MM.json`，daily 缺失可读回。
- 计划 L5 覆盖真实订阅 → 实际不覆盖（D-09：无订阅 Key，不购买测试 Key）。

## 六、诊断锚点

- LogCategory：`TokenDash`
- 前缀：`[TD:<module>]`（`boot` / `provider` / `adapter.*` / `pricing` / `collect` / `vm` / `slot` / `ui` / `route` / `diag` / `update`）
- 高价值日志：`[TD:vm] build providers=N api=N subscription=N`；`[TD:adapter.glm] quota.ok windows=N`；`[TD:update] install.ok from=… to=…`；`[TD:route] GET /summary 200 <ms>`
