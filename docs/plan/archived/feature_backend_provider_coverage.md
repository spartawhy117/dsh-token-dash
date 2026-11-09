# 后端 Provider 覆盖与取数可靠性

> 状态：已实施（真机 OpenCode Go / Command Code 待验证）<br>
> 完成时间：2026-11-05（`1.3.0-local.9`）<br>
> 关联逻辑根：`dsh-token-dash`（`src/`、`index.js`）<br>
> 关联资料：[`design.md`](../../design.md)（v3.3）、第三方参考 [`shy3130-dsh-quota.md`](../../reference/shy3130-dsh-quota.md) / [`invisiblesirius-dsh-quota-dashboard.md`](../../reference/invisiblesirius-dsh-quota-dashboard.md)、旧能力清单 [`backend-capability-checklist.md`](../../checklist/archived/backend-capability-checklist.md)

## 一、最终需求与范围

| ID | 最终处置 | 需求 / 边界 / 风险 | 最终结论或迁移去向 |
|---|---|---|---|
| REQ-01 | 完成 | 后端覆盖 7 家：现有 5 家 + OpenCode Go + Command Code | registry 与源表均 7 家；无 Key 不伪造数据 |
| REQ-02 | 完成 | 声明式源表 `src/quota-sources.js` | `PROVIDER_SOURCES` 驱动 `readProviders` |
| REQ-03 | 完成 | 凭据两型 `bearer` / `oauth-reuse` | 统一走宿主 `credentials.resolve`，不读环境变量/文件 |
| REQ-04 | 完成 | `preflight` 取 query；失败软返回空串 | Command Code `orgId` |
| REQ-05 | 完成 | 窗口 0–3、key 合法、百分比夹取、缺窗不补 | `normalizeWindows` + 两家 parse |
| REQ-06 | 完成 | 每源成功 60s / 失败 10s + in-flight | adapters 持有 TTL，index 传 Map |
| REQ-07 | 完成 | `unconfigured` 软态；5xx 标 `upstream`；`probe.misses` | 旧行为兼容，日志可诊断 |
| REQ-08 | 完成 | 非回环 `requestRejection` / 回环三重校验 | 回环放行；403 记 `route.forbidden` |
| REQ-09 | 完成 | 错误/响应脱敏 | 错误只返回 reason，不带上游 body / Key |
| REQ-10 | 完成 | OpenCode Go 三窗，404/405 回退 | `opencode.ai/zen/go/v1/usage` → `api/v1/usage` |
| REQ-11 | 完成 | Command Code credits + 两窗 | `command-code` / CNY；preflight `orgId` |
| REQ-12 | 完成 | 7 家解析与缓存测试，不联网 | 单测 78 通过 / 1 跳过 |
| REQ-13 | 完成 | e2e 7 家字段契约 | e2e 通过 |
| REQ-14 | 完成 | 文档同步 | `design.md` §Provider/鉴权/日志、plan §七 |
| REQ-15 | 完成 | 订阅重查覆盖全部订阅源 | GLM / Kimi / OpenCode Go / Command Code；Kimi 不查余额 |
| BND-01 | 保持 | 不改 `/summary` `/usage` `/prefs` 字段 | 前端零改动 |
| BND-02 | 保持 | 不做 Cookie / 本机登录 / 组织用量 / 自定义 URL | 与旧能力清单一致 |
| BND-03 | 保持 | 不引入 provider 插件系统 / DI | 单文件源表 + legacy reader |
| BND-04 | 保持 | 不做 `/repo` / star 计数 | 静态链接 |
| RSK-01 | 已验证 | 新 provider schema 变化 | parse 容错；失败降级 `parse`，不伪造 0 |
| RSK-02 | 已验证 | 源表重构回归 | 前 5 家保留 legacy reader |
| RSK-03 | 已验证 | 7 家并发打上游 | 每源缓存 + in-flight |
| RSK-04 | 已验证 | 安全门误伤 e2e | 回环放行 |

## 二、最终实现

### 3.0 最终改动总览

| ID | 类型 | 文件 | 开发改动说明 |
|---|---|---|---|
| CHG-01 | 新增 | `src/quota-sources.js` | `PROVIDER_SOURCES` 7 行；OpenCode/Command Code 解析、preflight、fallback |
| CHG-02 | 修改 | `src/adapters.js` · `readProviders` / `readSubscriptions` | 按源迭代；缓存 Map；`failures[]`；订阅重查 |
| CHG-03 | 修改 | `src/providers.js` | 注册 `opencode-go` / `command-code` 与别名；pricingLinks 7 家 |
| CHG-04 | 修改 | `index.js` · `providerCache` | Map + 每源 TTL/in-flight；prefs/import/refresh 清缓存 |
| CHG-05 | 修改 | `src/adapters.js` · 错误归一 | 5xx 加 `upstream`；`unconfigured` 软态 |
| CHG-06 | 修改 | `src/adapters.js` · `resolveCredential` | `bearer` / `oauth-reuse` 两型 |
| CHG-07 | 新增 | `src/adapters.js` · `sourceQuery` | preflight 软失败 |
| CHG-08 | 修改 | `index.js` · 路由 | 回环放行；非回环拒绝；`route.forbidden` |
| CHG-09 | 修改 | `index.js` / adapters | 错误只留 reason / 分类，不带 body |
| CHG-10 | 新增 | `src/quota-sources.js` · OpenCode | 三窗容错 + 404/405 回退 |
| CHG-11 | 新增 | `src/quota-sources.js` · Command Code | credits + fiveHour/weekly |
| CHG-12 | 修改 | `tools/mock/fixtures.mjs` | 7 家 fixture 已存在，字段对齐 |
| CHG-13 | 修改 | `test/unit/adapters.test.mjs` 等 | 7 家 registry、解析、缓存、失败映射 |
| CHG-14 | 修改 | `scripts/e2e.mjs` | 7 家 mock 契约保持不变 |
| CHG-15 | 修改 | `docs/design.md` | 7 家源表、缓存、安全、日志模块 |
| CHG-16 | 修改 | `src/diagnostics.js` / adapters / index | `prefix [TD:module]`、`detect.fail`、`route.forbidden`、`cache.state` |

### 2.1 最终结构

```text
quota-sources.js
  PROVIDER_SOURCES = [
    { id, kind, currency, legacy? }                       // 旧 5 家
    { id, kind, currency, credential, quota, preflight? } // OpenCode / Command Code
  ]

adapters.readProviders(ctx, prefs, cache)
  → 旧源 legacy(ctx, prefs)
  → 新源 resolveCredential → preflight? → fetch(url | fallbackUrl)
  → parse → normalizeWindows（0–3、夹取、缺窗不补）
  → toSnapshot → 每源缓存 60s / 10s + in-flight
  → SummaryVM（字段不变）
```

| 节点 | 职责 |
|---|---|
| `PROVIDER_SOURCES` | 端点、凭据引用、preflight、parse |
| `readProviders` | 迭代、隔离失败、`misses[]` / `failures[]` |
| `providerCache` | 每源 `{at, ok, data, promise}`；index 传入 |
| `readSubscriptions` | 绕过缓存，只刷新订阅源 |
| `toSnapshot` | 统一 `ProviderSnapshot` |

### 2.2 关键决策与陷阱

| 项 | 最终结论 |
|---|---|
| 源表形态 | 旧 5 家 `legacy` reader，新 2 家声明式；避免一次重写 DeepSeek 钱包 / Kimi 双路径 |
| Command Code | id `command-code`、币种 CNY，与 UI fixture 一致 |
| OpenCode | USD；404/405 才回落 |
| 缓存位置 | adapters 内按源读写，index 仅持有 Map；整包缓存无法按源失效 |
| Kimi 订阅重查 | 只查 Coding 配额；失败回落 API 时不请求 moonshot 余额 |
| 安全门 | 回环放行；非回环先 `requestRejection`，再三重校验 |
| 日志 | 每行 `prefix [TD:module]`；源级异常 `detect.fail`；新 provider 模块 `adapter.opencode/commandcode` |
| 真机边界 | OpenCode / Command Code 未用真实 Key 验证，解析按已知 schema 容错 |

### 2.3 反馈收口

| Issue | 结论 |
|---|---|
| #1 日志覆盖与前缀分类 | 已补 `prefix`、`failures[] detect.fail`、`route.forbidden`、`cache.state`、模块清单；单测覆盖 |

## 三、不改动 / 边界

- 不改 `/summary` / `/usage` / `/prefs` 契约；前端无需改动。
- 不做 Cookie / 本机登录 / 组织用量 / 自定义 URL / `/repo`。
- 不引入 provider 插件系统或构建链；`client.js` 仍是唯一产物。
- 不改 UI 布局、颜色、间距。

## 四、最终验收

| 项 | 方式 | 结果 |
|---|---|---|
| 7 家 registry / pricingLinks | 单测 | 通过 |
| OpenCode / Command Code 解析 | fixture 单测 | 通过 |
| 缓存复用 / in-flight | 单测调用计数 | 通过 |
| 源级失败日志映射 | 单测 | 通过 |
| 日志前缀 / JSON 完整性 | 单测 + 本机日志 | 通过；local.9 段落 100% 带前缀 |
| e2e 7 家 UI | `npm run e2e` | 通过 |
| 单测 | `npm test` | 78 通过 / 1 跳过 / 0 失败 |
| plan 校验 | `validate_plan.py` | 0 error / 1 warning（Issue 24 行，软目标） |
| 安装 | desktop profile | `1.3.0-local.9` |

## 五、计划—实际偏差

```text
计划 全量声明式源表 → 实际 旧 5 家 legacy + 新 2 家声明式（原因：DeepSeek 钱包 / Kimi 双路径特例）
计划 缓存由 index 整包管理 → 实际 adapters 按源管理、index 传入 Map（原因：整包无法按源失效）
计划 订阅重查只保留 subscription → 实际 GLM/Kimi 保留 API 回落（原因：兼容既有行为）
计划 真机验证 OpenCode/Command Code → 实际仅 fixture 验证（原因：暂无真实 Key；保留待验证）
```

## 六、关联资料

- 设计：[`design.md`](../../design.md) v3.3
- 第三方：[`shy3130-dsh-quota.md`](../../reference/shy3130-dsh-quota.md)、[`invisiblesirius-dsh-quota-dashboard.md`](../../reference/invisiblesirius-dsh-quota-dashboard.md)
- 旧能力清单：[`backend-capability-checklist.md`](../../checklist/archived/backend-capability-checklist.md)
