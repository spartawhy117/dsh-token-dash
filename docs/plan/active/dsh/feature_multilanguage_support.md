# 多语言准备：硬编码清理与英文回退提示

> 状态：待验收（2.0.0 候选）<br>
> 创建时间：2026-11-05<br>
> 更新时间：2026-11-05（按 plan 骨架重排 + 明确施工顺序）<br>
> 关联逻辑根：`dsh-token-dash`（`client.js`）<br>
> 关联资料：[`ui-design.md`](../../../ui-design.md) v3.9 §5.7 / §8、[PR #2](https://github.com/spartawhy117/dsh-token-dash/pull/2)（不合并）、[`feature_p3_settings_title.md`](feature_p3_settings_title.md)

## 〇、前置依赖 / 代码探查事实（已确认）

| 事实 | 结果 |
|---|---|
| DSH 可用语言 | `zh / en / ja / es / fr / de / ru / pt`；额外语言 fallback 均为 `en` |
| 插件当前词典 | `MESSAGES = { zh: ZH, en: EN }`；EN 139 条 |
| 插件语言入口 | 仅 `ctx.locale.register('token-dash', MESSAGES)` + `ctx.locale.bind('token-dash')` |
| 插件是否主动设语言 | 否；无 `setLocale`、无 `locale.preference`、无语言开关 |
| 非 zh/en 当前表现 | 英文回退 |
| 词典外中文 UI | **0**；未走 `tr` 的中文只剩注释 |
| 硬编码技术词 | `Tokens`、`API`、`provider.id`、`model.id`、`5h`、`--`、分隔符 |
| P3 设置区位置 | `BoardPage` 的 `boardSection`；标题为 `token-dash-settings-title` |
| 预览现状 | `tools/preview/templates/page-p3.html` 已有一条合并提示，代码尚未接入 |

## 一、需求

| ID | 优先级 | 需求 / 边界 / 风险 | 成功信号 |
|---|---|---|---|
| REQ-01 | P0 | 扫描硬编码 UI 文案 | 词典外中文 0；`title` / `aria-label` 均走 `tr` |
| REQ-02 | P0 | 只保留协议/技术标识 | `Tokens`、`provider.id`、`model.id` 等明确标记 `doNotTranslate`；审计完成，无漏项 |
| REQ-03 | P0 | P3 设置标题右侧显示语言提示 | 已实现；一条 11px 文案，e2e 验证 |
| REQ-04 | P0 | 文档说明英文回退 | README / UI 文档已补 |
| REQ-05 | P0 | provider / 模型命名一致 | 已完成：`Zhipu AI` / `Qwen` 英文 label；ID 永不翻译 |
| BND-01 | 边界 | 不新增 6 语言词典 | `ja/es/fr/de/ru/pt` 不进入本轮 |
| BND-02 | 边界 | 不做逐语言预渲染矩阵 | 不生成 8 语言截图/验收矩阵 |
| BND-03 | 边界 | 不引入语言选择器 | 不写 `setLocale` / `locale.preference` |
| BND-04 | 边界 | 不改 P1/P2/P3 布局、VM、模型映射 | 只改 P3 标题区、文案入口和 provider 显示 label |
| BND-05 | 边界 | 不合并 PR #2 | 拆分注册缺少 `zh`/`en` 基线，已回复不合并 |
| RSK-01 | 风险 | 提示文案过长导致 P3 标题区换行/溢出 | 允许换行；窄屏不横向滚动；标题不被挤压 |
| RSK-02 | 风险 | 把英文 fallback 误写成“已支持 8 语言” | 文案必须含“当前仅中文/English，其他语言回退英文” |

## 二、设计方案

### 2.1 结构（现状 → 改动）

```text
DSH active locale
  └─ ctx.locale.bind('token-dash')
       ├─ zh → ZH（139）
       ├─ en → EN（139）
       └─ ja/es/fr/de/ru/pt → fallback en（现状）

P3 BoardPage
  └─ section.boardSection
       └─ div.boardSectionHead
            ├─ b[data-testid=token-dash-settings-title]「设置与数据管理」  ← 现状
            └─ （新增）span[data-testid=token-dash-settings-locale-hint]
                  「语言跟随DSH设置；当前仅中文/English，其他语言回退英文」
       └─ settings capsule（不动）
```

只改标题区的容器和一条文案；语言选择仍由 DSH 控制。

### 2.2 文案与命名契约

| 项 | 规则 |
|---|---|
| 语言 ID | BCP 47：`zh/en/ja/es/fr/de/ru/pt`；不用 `cn/jp` |
| 回退 | 未注册语言统一回退 `en`；不伪造本地化 |
| provider.name | 统一英文 canonical；不按语言翻译 |
| provider.id / model.id | 永不翻译；接口、账本、日志保持英文 |
| UI 标签 | 走 `tr`；紧凑位置才允许本地简写 |
| 本轮新增 key | `语言跟随DSH设置；当前仅中文/English，其他语言回退英文` |
| EN value | `Language follows DSH settings; Chinese/English only; other languages fall back to English` |
| 不使用 | `setLocale`、`locale.preference`、第二行提示、tooltip |

### 2.3 数据与不翻译范围

**不翻译（doNotTranslate）范围：**

| 类别 | 例子 | 规则 |
|---|---|---|
| 协议 ID | `provider.id`、`model.id` | 永不翻译；接口、账本、日志保持原值 |
| 品牌名 | DeepSeek / GLM / Kimi / OpenRouter / Qwen / OpenCode Go / Command Code | 统一英文 canonical；不做逐语言翻译 |
| 模型显示名 | `deepseek-chat`、`deepseek-reasoner` | 统一英文；不生成中文模型 ID |
| 技术术语 | `Tokens`、`API`、`GitHub` | 保持英文，与 DSH 术语一致 |
| 窗口标识 | `5h` | 技术标识；`周`/`月` 仍走 `tr` |
| 数字/单位 | `k` / `M` / `B`、`--`、`—`、`·` | 格式化符号，不做语言翻译 |
| 可选别名 | `displayNameZh = '深度求索'` | 仅 UI 展示；不得进入接口/日志/账本，不得替代英文 canonical |

其它数据约束：

- 不新增 `JA/ES/FR/DE/PT` 词典；
- 只同步 `zhipu` / `qwen` 的展示 label 到英文；ID、币种、模型映射、VM、`/summary`、`/usage` 不动；
- 预览 HTML 里的硬编码不属于运行时文案，不搬进 `client.js`；
- 当前运行时没有 `doNotTranslate` 白名单常量；该表是**文档约束 + 静态检查依据**，不新增运行时过滤层。

### 2.4 关键陷阱

| 陷阱 | 规避 |
|---|---|
| `boardSectionHead` 有 `space-between`，直接加 `span` 会把提示推到最右 | 增加内层 `settingsHead`，用 `flex + gap` 让标题和提示相邻 |
| 长文案撑破设置卡 | `settingsHead` 允许 `flex-wrap`；`settingsHint` 加 `min-width:0` / `overflow-wrap:anywhere` |
| 把提示做成按钮/tooltip | 纯 `span`，无交互、无 `title` 浮层 |
| 误以为额外语言已支持 | 文案明确“仅中文/English，其他回退英文” |
| 把 provider/model 用中文别名替换 | 只允许可选 `displayName`，ID/日志永远英文 |

## 三、实现要点

### 3.0 开发改动总览（计划）

**修改顺序（严格按此执行）：**

```text
1. CHG-01  client.js：加文案 + 标题容器 + 样式
2. CHG-02  provider label：zhipu / qwen 统一英文，更新单测与 mock
3. CHG-03  page-p3：重渲染预览，确认换行与位置
4. CHG-04  UI / README：补英文回退说明
5. CHG-05  e2e：断言提示存在、在标题区、不是按钮
6. CHG-06  全量测试 + pack，不做正式发布
```

| ID | 类型 | 文件 | 开发改动说明 | 状态 |
|---|---|---|---|---|
| CHG-01 | 修改 | `client.js` | EN 增加一条文案；BoardPage 设置标题加 `settingsHead` + `settingsHint` | 已完成 |
| CHG-02 | 修改 | `src/providers.js`、`test/unit/providers*.test.mjs`、`test/unit/core.test.mjs`、`tools/mock/fixtures.mjs`、`README.md` | zhipu `智谱 AI` → `Zhipu AI`；qwen `通义千问` → `Qwen`；同步断言/mock | 已完成 |
| CHG-03 | 预览 | `tools/preview/templates/page-p3.html` | 一条合并提示；已重渲染 | 已完成 |
| CHG-04 | 文档 | `docs/ui-design.md`、`README.md`、`README.en.md`、`CHANGELOG.md` | 记录提示位置与 zh/en + EN 回退边界 | 已完成 |
| CHG-05 | 测试 | `scripts/e2e.mjs` | P3 设置区断言提示文案、位置、非按钮 | 已完成 |
| CHG-06 | 验证 | `build/` | `npm test` + `npm run e2e` + `npm run pack`；不 tag、不发布 | 已完成 |

### 3.1 改动清单（待实施）

#### CHG-01 · `client.js`

- `EN`：在 `'设置与数据管理'` 附近新增一条 key / value。
- `BoardPage`：设置标题外层加 `settingsHead`，标题右侧加 `settingsHint`。
- `styles`：新增 `settingsHead` / `settingsHint`，不动 `boardSection` 其它区块。

```diff
- h('div', { style: styles.boardSectionHead },
-   h('b', {
-     'data-testid': 'token-dash-settings-title',
-     style: styles.sectionTitle,
-   }, tr('设置与数据管理'))),
+ h('div', { style: styles.boardSectionHead },
+   h('div', { style: styles.settingsHead },
+     h('b', {
+       'data-testid': 'token-dash-settings-title',
+       style: styles.sectionTitle,
+     }, tr('设置与数据管理')),
+     h('span', {
+       'data-testid': 'token-dash-settings-locale-hint',
+       style: styles.settingsHint,
+     }, tr('语言跟随DSH设置；当前仅中文/English，其他语言回退英文')))),
```

```diff
+ settingsHead: { display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, minWidth: 0 },
+ settingsHint: { color: T.muted, fontSize: 11, lineHeight: '16px', minWidth: 0, overflowWrap: 'anywhere' },
```

```diff
+ '语言跟随DSH设置；当前仅中文/English，其他语言回退英文': 'Language follows DSH settings; Chinese/English only; other languages fall back to English',
```

#### CHG-02 · `src/providers.js`

- `providers.zhipu.label`：`智谱 AI` → `Zhipu AI`
- `providers.qwen.label`：`通义千问` → `Qwen`
- ID、币种、模型映射、subscription 名称（`GLM Coding` / `Kimi Coding`）不变
- 同步 `test/unit/providers.test.mjs`、`providers-vm.test.mjs`、`core.test.mjs`、`tools/mock/fixtures.mjs`、README 的中文名称

```diff
- label: '智谱 AI',
+ label: 'Zhipu AI',
```

```diff
- label: '通义千问',
+ label: 'Qwen',
```

#### CHG-03 · `tools/preview/templates/page-p3.html`

已落地一条合并提示；不新增第二行。重渲染后检查：

- 提示紧邻标题右侧；
- 窄屏换行到标题下方；
- 不撑宽设置胶囊；
- 文案与 CHG-01 完全一致。

#### CHG-04 · 文档

| 文件 | 章节 / 键 | 改动 |
|---|---|---|
| `docs/ui-design.md` | §5.7 设置标题行 | 补 `settingsHint` 位置、11px、允许换行、无交互 |
| `docs/ui-design.md` | §8 语言 | 明确当前仅 zh/en，其他 DSH 语言回退 en |
| `README.md` / `README.en.md` | 兼容与限制 | 增加一段回退说明，不写“支持 8 语言” |
| `CHANGELOG.md` | 下一个 patch | 只写“P3 语言提示 + README 回退说明”，不发版 |

#### CHG-05 · `scripts/e2e.mjs`

在 P3 设置区断言：

- `token-dash-settings-locale-hint` 数量 1；
- 文本等于最终文案；
- 位于设置标题右侧（同行或标题下方，不游离）；
- 不是 `button`，无 tooltip；
- 设置胶囊内三行功能不变。

#### CHG-06 · 验证与产物

```text
npm test       目标 80 通过
npm run e2e    目标 UI assertions passed
npm run pack   生成 2.0.0 候选包
```

不改 tag、不 npm publish、不触发 Release。

## 四、不改动 / 边界（已确认）

- `BND-01`：不新增 6 语言词典。
- `BND-02`：不做 8 语言预渲染矩阵。
- `BND-03`：不引入语言选择器或 `setLocale`。
- `BND-04`：不改 P1/P2/P3 布局、VM、模型映射、日志；只同步 provider 显示 label。
- `BND-05`：不合并 PR #2。

## 五、验收要点（待验证）

| 项 | 来源 | 验证方式 | 结果 |
|---|---|---|---|
| 词典外中文 UI 为 0 | REQ-01 | 静态扫描 + 人工抽查 | 通过 |
| 技术词仍保留英文 | REQ-02 | 检查 `Tokens` / `provider.id` / `model.id` | 通过 |
| P3 提示准确 | REQ-03 / RSK-02 | e2e 文案 + 预览截图 | 通过 |
| 提示不溢出 | REQ-03 / RSK-01 | 320/768/1000 px 预览 + `scrollWidth` | 通过 |
| README / UI 文档说明回退 | REQ-04 | 人工检查 | 通过 |
| provider / 模型命名统一英文 | REQ-05 | 单测断言 provider label；检查表格模型名 | 通过 |
| 全量测试通过 | 全局质量门槛 | `npm test` + `npm run e2e` | 通过 |

## 九、自测反馈台

- 2026-11-05：确认 DSH 8 语言；插件仅 zh/en，额外语言回退英文；
- 硬编码扫描：词典外中文 0，技术词 `Tokens` 等保留；
- 决定不做 8 语言完整支持，仅清理硬编码 + 增加回退提示；
- 品牌/型号：provider / model ID 永不翻译；显示名统一英文；中文别名只能是可选 `displayName`；
- 当前只有 P3 一条提示，不做第二行/按钮/tooltip；
- 2026-11-05：`client.js` 已加 `settingsHead` / `settingsHint` 与词条；`page-p3` / UI / README / CHANGELOG 已同步；
- provider 显示名已统一英文：`Zhipu AI`、`Qwen`；ID/币种/模型映射不变；
- `npm test` 80 通过；`npm run e2e` UI assertions passed（含提示文案、位置、非按钮）；
- `npm run pack` 已生成 `build/dsh-token-dash-2.0.0.tgz`（约 71.2 KB）；不 tag、不发布。
