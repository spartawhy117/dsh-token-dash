# 多语言准备：硬编码清理与英文回退提示

> 状态：已实施（2.0.1）<br>
> 完成时间：2026-11-05<br>
> 关联逻辑根：`dsh-token-dash`（`client.js`）<br>
> 关联资料：[`ui-design.md`](../../ui-design.md) v3.9 §5.7 / §8、[PR #2](https://github.com/spartawhy117/dsh-token-dash/pull/2)（不合并）、归档 plan [`feature_p3_settings_title.md`](../archived/feature_p3_settings_title.md)

## 一、最终需求与范围

| ID | 最终处置 | 需求 / 边界 / 风险 | 最终结论或迁移去向 |
|---|---|---|---|
| REQ-01 | 完成 | 扫描硬编码 UI 文案 | 词典外中文 0；`title` / `aria-label` 均走 `tr` |
| REQ-02 | 完成 | 只保留协议 / 技术标识 | `Tokens`、`provider.id`、`model.id` 等保持英文，审计无漏项 |
| REQ-03 | 完成 | P3 设置标题右侧显示语言提示 | 一条 11px 文案，e2e 验证 |
| REQ-04 | 完成 | 文档说明英文回退 | README / README.en / UI 文档已补 |
| REQ-05 | 完成 | provider / 模型命名一致 | `Zhipu AI` / `Qwen` 英文 label；ID 永不翻译 |
| BND-01 | 保持 | 不新增 6 语言词典 | `ja/es/fr/de/ru/pt` 未进入本轮 |
| BND-02 | 保持 | 不做逐语言预渲染矩阵 | 未生成 8 语言截图 / 验收矩阵 |
| BND-03 | 保持 | 不引入语言选择器 | 未写 `setLocale` / `locale.preference` |
| BND-04 | 保持 | 不改 P1/P2/P3 布局、VM、模型映射 | 只改 P3 标题区、文案入口和 provider 显示 label |
| BND-05 | 保持 | 不合并 PR #2 | 拆分注册缺少 `zh`/`en` 基线，已回复不合并 |
| RSK-01 | 已验证 | 提示文案过长导致标题区换行 / 溢出 | 允许换行；窄屏不横向滚动；标题未被挤压 |
| RSK-02 | 已验证 | 把英文 fallback 误写成「已支持 8 语言」 | 文案明确「当前仅中文/English，其他语言回退英文」 |

## 二、最终实现

### 3.0 最终改动总览

| ID | 类型 | 文件 | 开发改动说明 |
|---|---|---|---|
| CHG-01 | 修改 | `client.js` · `EN` / `BoardPage` / `styles` | EN 词典新增回退提示词条；`boardSectionHead` 内加 `settingsHead` 容器包住标题 + `span[token-dash-settings-locale-hint]`；新增 `settingsHead`（flex + gap 8 + wrap）与 `settingsHint`（11px / muted / `minWidth:0` / `overflowWrap:anywhere`） |
| CHG-02 | 修改 | `src/providers.js` · `PROVIDERS.zhipu.label` / `PROVIDERS.qwen.label` | `智谱 AI` → `Zhipu AI`；`通义千问` → `Qwen`；ID、币种、模型映射、subscription 名称不变 |
| CHG-03 | 预览 | `tools/preview/templates/page-p3.html` | 一条合并提示，位置与换行同实现；未新增第二行 |
| CHG-04 | 文档 | `docs/ui-design.md` §5.7 / §8、`README.md`、`README.en.md` | 补 `settingsHint` 位置与 11px、允许换行、无交互；明确当前仅 zh/en，其他 DSH 语言回退 en |
| CHG-05 | 测试 | `scripts/e2e.mjs` | 断言提示数量 1、文案相符、位于标题区、非 `button`、无 tooltip |
| CHG-06 | 测试 | `test/unit/providers*.test.mjs`、`test/unit/core.test.mjs`、`tools/mock/fixtures.mjs` | 同步 `Zhipu AI` / `Qwen` 断言与 mock 数据 |
| CHG-07 | 配置 | `CHANGELOG.md` | 2.0.1 块记录语言提示、provider 英文名与 README 回退说明 |

### 2.1 最终结构

```text
DSH active locale
  └─ ctx.locale.bind('token-dash')
       ├─ zh → ZH
       ├─ en → EN
       └─ ja/es/fr/de/ru/pt → fallback en

P3 BoardPage
  └─ section.boardSection
       └─ div.boardSectionHead（space-between，不能直接塞 span）
            └─ div.settingsHead（flex + gap 8 + wrap）
                 ├─ b[token-dash-settings-title]「设置与数据管理」
                 └─ span[token-dash-settings-locale-hint]「语言跟随DSH设置；当前仅中文/English，其他语言回退英文」
       └─ settings capsule（不动，仍三行）
```

语言选择仍由 DSH 控制，插件不设 `setLocale`。

### 2.2 关键代码骨架

```js
h('div', { style: styles.boardSectionHead },
  h('div', { style: styles.settingsHead },
    h('b', { 'data-testid': 'token-dash-settings-title', style: styles.sectionTitle }, tr('设置与数据管理')),
    h('span', {
      'data-testid': 'token-dash-settings-locale-hint',
      style: styles.settingsHint,
    }, tr('语言跟随DSH设置；当前仅中文/English，其他语言回退英文'))))
```

```js
settingsHead: { display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, minWidth: 0 },
settingsHint: { color: T.muted, fontSize: 11, lineHeight: '16px', minWidth: 0, overflowWrap: 'anywhere' },
```

### 2.3 关键陷阱

| 项 | 约束 |
|---|---|
| `boardSectionHead` 是 `space-between` | 直接加 `span` 会把提示推到最右；必须套 `settingsHead` 内层用 flex + gap |
| 长文案撑破设置卡 | `settingsHead` 允许 `flex-wrap`；`settingsHint` 加 `minWidth:0` / `overflowWrap:anywhere` |
| 把提示做成按钮 / tooltip | 只用纯 `span`，无交互、无 `title` 浮层 |
| 误以为额外语言已支持 | 文案必须含「仅中文/English，其他回退英文」 |
| 用中文别名替换 provider / model | 只允许可选 `displayName`；ID / 日志永远英文 |

### 2.4 不翻译（doNotTranslate）范围

| 类别 | 例子 | 规则 |
|---|---|---|
| 协议 ID | `provider.id`、`model.id` | 永不翻译；接口、账本、日志保持原值 |
| 品牌名 | DeepSeek / GLM / Kimi / OpenRouter / Qwen / OpenCode Go / Command Code | 统一英文 canonical |
| 模型显示名 | `deepseek-chat`、`deepseek-reasoner` | 统一英文；不生成中文模型 ID |
| 技术术语 | `Tokens`、`API`、`GitHub` | 保持英文，与 DSH 术语一致 |
| 窗口标识 | `5h` | 技术标识；`周` / `月` 仍走 `tr` |
| 数字 / 单位 | `k` / `M` / `B`、`--`、`—`、`·` | 格式化符号，不翻译 |

该表是**文档约束 + 静态检查依据**，运行时未新增过滤层或白名单常量。

## 三、不改动 / 边界

- 不新增 `JA/ES/FR/DE/PT` 词典；
- 只同步 `zhipu` / `qwen` 展示 label 到英文；ID、币种、模型映射、VM、`/summary`、`/usage` 不动；
- 不做 8 语言预渲染矩阵；不引入语言选择器；
- 预览 HTML 内的硬编码不搬进 `client.js`；
- 不合并 PR #2。

## 四、最终验收

| 项 | 来源 | 环境与方式 | 结果 |
|---|---|---|---|
| 词典外中文 UI 为 0 | REQ-01 | 静态扫描 + 人工抽查 | 通过 |
| 技术词仍保留英文 | REQ-02 | 检查 `Tokens` / `provider.id` / `model.id` | 通过 |
| P3 提示准确，非按钮 | REQ-03 / RSK-02 | e2e 文案 + 预览截图 | 通过 |
| 提示不溢出 | REQ-03 / RSK-01 | 320 / 768 / 1000px 预览 + `scrollWidth` | 通过 |
| README / UI 文档说明回退 | REQ-04 | 人工检查 | 通过 |
| provider / 模型命名统一英文 | REQ-05 | 单测断言 provider label | 通过 |
| 全量测试 | 质量门槛 | `npm test` + `npm run e2e` | 通过：80 通过；UI assertions passed |
| 2.0.1 候选包 / 正式版 | 交付物 | `npm run pack`；`CHANGELOG` 2.0.1 | 已发布 2.0.1 |

## 六、诊断锚点

- DOM 锚点：`[data-testid=token-dash-settings-locale-hint]`（提示）、`[data-testid=token-dash-settings-title]`（标题，二者同属 `settingsHead`）
- 高价值断言：提示节点数量恒为 1、文案精确匹配、`tagName !== 'BUTTON'`
