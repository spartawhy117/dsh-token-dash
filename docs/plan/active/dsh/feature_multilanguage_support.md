# 多语言准备：硬编码清理与英文回退提示

> 状态：已对齐（待实施）<br>
> 创建时间：2026-11-05<br>
> 更新时间：2026-11-05（范围收窄：不做 8 语言支持）<br>
> 关联逻辑根：`dsh-token-dash`（`client.js`）<br>
> 关联资料：[`ui-design.md`](../../../ui-design.md) v3.8 §5.7 / §8、[PR #2](https://github.com/spartawhy117/dsh-token-dash/pull/2)（不合并）、[`feature_p3_settings_title.md`](feature_p3_settings_title.md)

## 一、最终需求与范围

| ID | 处置 | 需求 | 结论 |
|---|---|---|---|
| REQ-01 | 完成调查 | 扫描硬编码 UI 文案 | `client.js` 无词典外中文可见文案；技术词保留 |
| REQ-02 | 待实施 | 清理漏走 `tr` 的文案 | 仅保留 `Tokens`、`provider.id`、`model.id` 等技术标识；品牌/型号统一英文 |
| REQ-07 | 待实施 | provider / 模型命名一致 | 不做逐语言翻译；ID 永不翻译，显示名统一英文品牌 |
| REQ-03 | 待实施 | P3 语言跟随说明 | 设置标题右侧仅一条 11px：`插件语言跟随DSH本体设置显示` |
| REQ-04 | 待实施 | 英文回退说明 | 放 README / UI 文档，不在 P3 增加第二行 |
| REQ-05 | 不做 | 新增 6 语言词典 | 暂不实现 `ja/es/fr/de/ru/pt` |
| REQ-06 | 不做 | 每语言全量预渲染 | 成本过高；不进入本次范围 |
| BND-01 | 保持 | 不引入语言开关 | 跟随 DSH，无 `setLocale` |
| BND-02 | 保持 | 不合并 PR #2 | 其拆注册缺少 `zh/en` 基线，已回复不合并 |
| BND-03 | 保持 | 不改 P1/P2/P3 布局、VM、provider | 只做文案入口与提示 |

## 二、当前行为（已确认）

`client.js`：

```js
const MESSAGES = { zh: ZH, en: EN }
ctx.effect?.(() => ctx.locale.register('token-dash', MESSAGES), 'locale:dictionaries')
activeTranslate = ctx.locale.bind('token-dash')
```

DSH 额外语言的 fallback 都是 `en`：

| DSH 当前语言 | 插件显示 |
|---|---|
| `zh` | 中文 |
| `en` | 英文 |
| `ja/es/fr/de/ru/pt` | **英文回退** |

说明：

- 插件没有 `setLocale`、没有 `locale.preference`、没有语言开关；
- `bind` 使用宿主当前语言与 fallback 链；
- 只有宿主没有 locale 服务时，初始 `activeTranslate` 才使用中文兜底；当前 DSH 0.2.2 不会走这条路径。

## 三、硬编码扫描结果

扫描范围：`client.js` 中词典之外的用户可见文本、`title`、`aria-label`、按钮/表格/空态。

### 结论

| 类型 | 结果 |
|---|---|
| 词典外中文 UI 文案 | **0**；未走 `tr` 的中文仅注释 |
| `title` / `aria-label` 未走 `tr` | 未发现；均通过 `tr` |
| 硬编码技术词 | `Tokens`、`API`、`provider.id`、`model.id`、`5h`、`--`、分隔符 |
| 硬编码中文预览 | 仅在 `tools/preview/templates/*.html`，不影响运行时 |
| 现有 EN 覆盖 | 139 / 139；RU 0 / 139 |

### 需要标记为 `doNotTranslate`

| 文本 | 原因 |
|---|---|
| `Tokens` | 与 DSH 术语一致，翻译反而增加歧义 |
| `API` / `GitHub` | 品牌/技术缩写 |
| `provider.id` | 协议键，必须与接口/日志一致 |
| `model.id` | 协议键，必须与接口/日志一致 |
| `provider.name` / 模型显示名 | 统一英文品牌名；不做逐语言翻译 |
| `5h` | 窗口技术标识；周/月仍走 `tr` |
| `--` / `—` / `·` | 占位与分隔符 |

### 3.1 品牌与型号命名（已确认）

这里的“全中文 / 全英文”需要拆开：

| 方案 | 可行性 | 说明 |
|---|---|---|
| **统一英文品牌 + 本地化 UI 文案** | **推荐** | provider / 模型名保持英文 canonical；按钮、标签、提示按 DSH 语言显示 |
| 全中文 UI | 部分可行 | 只有 DeepSeek / GLM / Kimi / Qwen 有常用中文品牌名；OpenRouter、OpenCode Go、Command Code 没有统一中文名 |
| 全英文 UI | 可行 | 所有展示英文，zh 用户也看英文标签；体验较差 |
| 逐语言翻译 provider / 模型 ID | **不可行** | ID 是协议键，翻译会破坏接口、账本匹配和日志排障 |

推荐统一为：

```text
DeepSeek
GLM
Kimi
OpenRouter
Qwen
OpenCode Go
Command Code

模型显示名 / 模型 ID 保持英文，例如 deepseek-chat
```

如果未来要加中文品牌别名，只允许作为 **displayName 映射**：

```text
provider.name = "DeepSeek"          // canonical，始终英文
provider.displayNameZh = "深度求索" // 可选别名，不参与接口/日志
```

不允许：

- 把 `deepseek-chat` 改成中文 ID；
- 根据语言拼接 provider 名；
- 在日志、导出、账本里使用本地化名称；
- 让中文别名替代英文品牌导致同一 provider 两种写法。

### 不本轮处理

- 不新增 `JA/ES/FR/DE/PT` 词典；
- 不把 `Tokens` 改成各语言译名；
- 不做 8 语言布局矩阵；
- 不把 P3 预览里的中文硬编码搬进运行时（预览本身不是产品）。

## 四、改动总览

| 范围 | 改动 |
|---|---|
| `client.js` · P3 设置区标题 | 保留「设置与数据管理」+ 11px 内联语言提示 |
| `client.js` · 设置区提示 | 仅一条：`插件语言跟随DSH本体设置显示`；不加第二行 |
| `client.js` · 文案 | 新增一条中文键 + 一条 EN 翻译；其他语言走 EN 回退 |
| `docs/ui-design.md` §5.7 / §8 | 记录提示位置与 zh/en + EN 回退边界 |
| `README.md` / `README.en.md` | 兼容说明：当前 UI 仅 zh/en，其他 DSH 语言显示英文 |
| `CHANGELOG.md` | 归入下一个 patch/minor，不单独发版 |
| `scripts/e2e.mjs` | 断言一条提示可见、不可点击、无 tooltip |
| `tools/preview/templates/page-p3.html` | 已有第一条提示；补第二条小字后再截图 |

### 结构

```text
设置与数据管理  插件语言跟随DSH本体设置显示
┌────────────────────────────────────────────┐
│ 刷新间隔 / 账户余额                         │
│ 日志 / 数据                                 │
│ 版本 / 检查更新                             │
└────────────────────────────────────────────┘
```

- P3 只放一条 11px 纯文本，位于标题右侧；
- 不做按钮、不做 hover、不做 tooltip；
- 允许换行；不把设置胶囊撑宽；
- 英文回退说明只放 README / UI 文档，不放进 P3，避免长期占位；
- 不新增语言选择器。

### 不改动

- 不引入 6 语言词典和词表；
- 不改 P1/P2/P3 布局、VM、provider、日志；
- 不合并 PR #2；
- 不使用 `setLocale` / `locale.preference`。

### 验收

- `client.js` 中用户可见文案仍全部走 `tr`；
- `Tokens` 等仅作为 `doNotTranslate` 保留；
- provider / 模型 ID 不翻译，显示名统一英文；中文别名只能作为可选 displayName。
- P3 设置区只显示「插件语言跟随DSH本体设置显示」，无按钮/tooltip；
- README 明确「当前 UI 仅 zh/en，其他 DSH 语言回退英文」；
- `npm test` 80 通过；`npm run e2e` 通过；
- 不新增语言包、不做 8 语言截图矩阵。

## 五、关联资料

- DSH 语言清单与 fallback：本机 `0.2.2-rc.1` asar
- PR #2：<https://github.com/spartawhy117/dsh-token-dash/pull/2>（不合并）
- P3 标题 plan：[`feature_p3_settings_title.md`](feature_p3_settings_title.md)
- UI §5.7 / §8：`docs/ui-design.md`

## 九、自测反馈台

- 2026-11-05：确认 DSH 8 语言；插件仅 zh/en，额外语言回退英文；
- 硬编码扫描：词典外中文 0，技术词 `Tokens` 等保留；
- 决定不做 8 语言完整支持，仅清理硬编码 + 增加回退提示；
- 品牌/型号命名：provider / model ID 永不翻译；显示名统一英文；中文别名只能是可选 displayName；
- 待实施，版本归入下一个 patch/minor。
