# 多语言支持完善

> 状态：已对齐（待实施）<br>
> 创建时间：2026-11-05<br>
> 更新时间：2026-11-05（第三轮复核：DSH 语言清单 + 跟随机制确认）<br>
> 关联逻辑根：`dsh-token-dash`（`client.js`）<br>
> 关联资料：[`ui-design.md`](../../../ui-design.md) v3.8 §8、[PR #2](https://github.com/spartawhy117/dsh-token-dash/pull/2)（不合并，仅取 RU 词典）、[`feature_p3_settings_title.md`](feature_p3_settings_title.md)

## 一、最终需求与范围

| ID | 处置 | 需求 | 结论 |
|---|---|---|---|
| REQ-01 | 待实施 | 覆盖 DSH 已有语言 | 跟随宿主语言目录：`zh / en / ja / es / fr / de / ru / pt` |
| REQ-02 | 待实施 | 不破坏宿主语言切换 | 所有词典一次注册，包含 `zh` / `en` 基线；不拆成缺基线的部分注册 |
| REQ-03 | 待实施 | RU 词典可用 | 以 PR #2 的 139 条 RU 为参考，修复注册方式后纳入 |
| REQ-04 | 待实施 | 其余 5 语言补齐 | `ja / es / fr / de / pt` 各 139 条，占位符与 EN 完全一致 |
| REQ-05 | 待实施 | 覆盖率可回归 | 单测检查每语言键数、缺失键、占位符、残留中文 |
| REQ-06 | 待实施 | 文档同步 | UI §8 / README 支持语言 / CHANGELOG 2.1.0 |
| REQ-07 | 已确认 | 语言显示跟随 DSH 设置 | 不主动设置语言；只 `register` 词典 + `bind`，由宿主切换 |
| REQ-08 | 待实施 | P3 设置标题旁说明语言来源 | 「设置与数据管理」右侧 11px 内联小字，不做图标 / 浮动提示 |
| BND-01 | 保持 | 不引入 P3 语言切换器 | 无插件语言偏好、无 `setLocale` |
| BND-02 | 保持 | 不改 P1/P2/P3 布局、VM、provider | 纯文案层 |
| BND-03 | 保持 | 不合并 PR #2 | PR 的拆分注册有基线错误；只复用 RU 词条 |
| RSK-01 | 待验证 | DSH `locale.register` 要求 `zh` + `en` | 一次注册全量 `MESSAGES`，外部包占用时 catch 后绑定 |
| RSK-02 | 待验证 | 机器翻译质量 | 至少人工校对术语：预算 / 余额 / 订阅 / 缓存 / 命中 |
| RSK-03 | 待验证 | 占位符漏译 | 单测逐键比较 `{name}` / `{value}` / `{n}` / `{reason}` |
| RSK-04 | 待验证 | 外部语言包抢占 namespace | 注册失败不阻断翻译绑定；需要时再谈外部包优先级 |
| RSK-05 | 待验证 | 德语 / 俄语 / 葡语文本膨胀 | 标题旁说明可换行；设置行 40px 标签需放开或省略 |

## 二、DSH 宿主语言清单

从本机 DSH `0.2.2-rc.1` 的 asar 读取：

| id | 宿主标签 | 基线/额外 | 插件当前 |
|---|---|---|---|
| `zh` | 中文 | 基线 | **139 / 139** |
| `en` | English | 基线 | **139 / 139** |
| `ja` | 日本語 | 额外 | **0 / 139** |
| `es` | Español | 额外 | **0 / 139** |
| `fr` | Français | 额外 | **0 / 139** |
| `de` | Deutsch | 额外 | **0 / 139** |
| `ru` | Русский | 额外 | **0 / 139**（PR #2 有 139 条，但未注册成功） |
| `pt` | Português | 额外 | **0 / 139** |

宿主已经 `addLanguage` 这些 id，并带 `fallback: en`；插件不需要再注册语言定义，只需注册词典。

## 三、当前实现与问题

`client.js`：

```js
const EN = { ... } // 139 keys
const ZH = Object.fromEntries(Object.keys(EN).map((key) => [key, key]))
const MESSAGES = { zh: ZH, en: EN }

ctx.effect?.(() => ctx.locale.register('token-dash', MESSAGES), 'locale:dictionaries')
```

现状：

- 只有中文 / 英文；
- 词条总数 139；
- DSH 额外支持的 6 种语言全部回退到英文；
- PR #2 的 RU 词典本身完整（139/139、占位符 0 mismatch、无残留中文），但 `register({ ru: RU })` 缺少 `zh`/`en` 基线，且异常被吞，俄语不会生效。

DSH 文档明确：

> `ctx.locale.register(ns, { zh, en, ja })` 必须同时包含 `zh` 和 `en` 两个基线语言，其他语言可选。

所以不能按 locale 拆成多次部分注册；必须一次提交完整词典。

### 3.1 语言选择边界（已确认）

插件**不主动设置语言**，显示完全跟随 DSH 当前设置：

| 检查 | 结果 |
|---|---|
| `client.js` 是否调用 `setLocale` | 无 |
| 是否读写 `locale.preference` | 无 |
| 是否注册自己的语言定义 | 无；`zh/en/ja/es/fr/de/ru/pt` 都由宿主 `addLanguage` |
| 是否有 P3 语言开关 | 无 |
| 翻译入口 | 仅 `ctx.locale.register('token-dash', MESSAGES)` + `ctx.locale.bind('token-dash')` |

宿主 `bind(ns)` 返回的函数每次翻译都会读取当前 `snapshot.active`；因此 DSH 切换语言后，P1/P2/P3 文案跟随更新，插件不需要重启或保存语言偏好。

测试也遵循这个边界：

- 不在 e2e 里调用插件语言设置；
- 切换 DSH 语言必须走宿主设置，再断言文案；
- 单测只校验词典完整性和占位符，不修改宿主 locale。

### 3.2 P3 设置标题旁的语言说明（已确认）

设置区标题右侧增加一行小字，直接说明语言来源：

```text
设置与数据管理  插件语言跟随DSH本体设置显示
┌────────────────────────────────────────────┐
│ 刷新间隔 / 账户余额                         │
│ 日志 / 数据                                 │
│ 版本 / 检查更新                             │
└────────────────────────────────────────────┘
```

- 文案：**插件语言跟随DSH本体设置显示**；
- 位置：「设置与数据管理」标题右侧，与标题同一行；
- 字号 11px，颜色 `muted`，无背景、无边框；
- **不做按钮、不做 hover、不做浮动 tooltip**；
- 窄屏允许换行到标题下方，不截断；
- 纯说明文字，不参与设置、不可点击。

### 3.3 翻译长度与超框风险（需要按语言验收）

不同语言长度差异明显：

```text
zh  设置与数据管理  插件语言跟随DSH本体设置显示
en  Settings and data  Plugin language follows the DSH setting
de  Einstellungen und Daten  Die Plugin-Sprache folgt der DSH-Einstellung
ru  Настройки и данные  Язык плагина соответствует настройкам DSH
```

风险点：

| 位置 | 风险 | 处理 |
|---|---|---|
| P3 设置标题旁说明 | 俄语 / 德语可能超过一行 | 已有 `flex-wrap: wrap`，允许换到标题下方，不设固定高度 |
| P3 设置行标签 `40px` | `Protokolle` / `Version` 等英文、德文可能被截 | 改为 `minmax(40px, max-content)` 或允许省略 + `title` |
| P2 摘要标签 / 值 | 固定 380 + `nowrap`，长语言可能挤压 | 保留 `min-width:0`，标签允许换行或使用短译名 |
| P1 Pill | 文案变长会撑宽 Pill | 不设固定宽，必要时对内部文本省略 |
| 图标按钮 | 44×26 / 22×22 无文字 | 无风险 |

验收时至少用 **德语、俄语** 各跑一遍 P3 设置区和 P2 摘要，检查：

- `scrollWidth <= clientWidth + 1`；
- 标题旁说明不被截断；
- 设置行标签不压到右侧控件；
- 不出现横向滚动条。

不做“为中文固定 40px”的假设；所有固定文字宽度都按最长语言复核。

实现落点：

| 范围 | 改动 |
|---|---|
| `client.js` · `BoardPage` 设置区块头 | `sectionTitle` 后加 `span`，`data-testid='token-dash-settings-locale-hint'` |
| `client.js` · `styles` | 新增 `settingsHint`（11px / muted / line-height 16） |
| `client.js` · 文案 | 新增中文词条；EN 用 `Plugin language follows the DSH setting` |
| `tools/preview/templates/page-p3.html` | 已加 `.settings-heading` + `.settings-hint` |
| `scripts/e2e.mjs` | 断言提示存在、位于标题右侧、不是按钮 |
| `docs/ui-design.md` §5.7 | 补标题旁说明规则 |

## 四、改动总览

| 范围 | 改动 |
|---|---|
| `client.js` · 词典 | 新增 `JA / ES / FR / DE / PT`，纳入现有 `RU`，每个 139 条 |
| `client.js` · 注册 | `MESSAGES = { zh, en, ja, es, fr, de, ru, pt }`；一次 `locale.register` |
| `client.js` · 异常 | 保留 try/catch：外部语言包占用 namespace 时不阻断 `bind` |
| `client.js` · 布局 | `settingsHint` 加 `min-width:0` / `overflow-wrap:anywhere`；`settingsRow` 标签宽度按最长语言复核 |
| `test/unit/i18n.test.mjs` | 新增词典覆盖、占位符、残留中文断言 |
| `scripts/e2e.mjs` | 可选：切到 `ru` / `de` 断言文案；检查 P3 设置区 / P2 摘要无横向溢出 |
| `docs/ui-design.md` §8 / §5.7 | 语言从 `zh/en` 改为 8 语言；设置标题旁说明 |
| `tools/preview/templates/page-p3.html` | 已加标题旁 `settings-hint`，不做浮动提示 |
| `README.md` / `README.en.md` | 支持语言列表与截图说明 |
| `CHANGELOG.md` | 2.1.0：多语言支持 |

### 结构

```text
EN (139 keys, canonical)
  ├─ ZH = key map（baseline）
  ├─ JA (139)
  ├─ ES (139)
  ├─ FR (139)
  ├─ DE (139)
  ├─ RU (139, 参考 PR #2)
  └─ PT (139)

MESSAGES = { zh, en, ja, es, fr, de, ru, pt }
  → ctx.locale.register('token-dash', MESSAGES)
  → ctx.locale.bind('token-dash')
```

### 不改动

- 不新增 P3 语言开关，不接管 DSH 语言选择器，不写 `locale.preference`；
- 不改 P1/P2/P3 布局、VM、provider、日志；
- 不合并 PR #2，不引入它的拆分注册逻辑；
- 不为缺失词条做运行时中文兜底，统一回退 `en`。

### 验收

- 8 语言键数均为 139，无缺失 / 多余；
- 每语言占位符集合与 EN 完全一致；
- RU 无中文残留；其余语言术语人工抽检；
- 单测 / e2e 全绿；
- README 语言列表与 DSH 实际语言一致；
- 2.1.0 候选包可安装，**从 DSH 设置切换语言后** P1/P2/P3 文案跟随；
- 插件自身没有语言开关，也没有语言偏好文件；
- P3「设置与数据管理」右侧显示「插件语言跟随DSH本体设置显示」，不是按钮 / tooltip。

## 五、实施顺序

1. 从 PR #2 取 RU 词典（保留作者贡献说明），修正注册方式；
2. 补 `ja / es / fr / de / pt`，先保证键与占位符，再做术语校对；
3. 拍照/截图只保留中文与英文，避免 README 图片语言膨胀；
4. 单测 + e2e；通过后按 2.1.0 MINOR 发版。

## 六、关联资料

- DSH 语言 API 文档（asar 内置）：`addLanguage` / `register` / fallback 链
- PR #2：<https://github.com/spartawhy117/dsh-token-dash/pull/2>（不合并）
- UI 设计：`docs/ui-design.md` §8
- 当前语言表：`client.js` · `EN` / `ZH` / `MESSAGES`

## 九、自测反馈台

- 2026-11-05：确认 DSH 支持 `zh/en/ja/es/fr/de/ru/pt` 8 种语言；
- 插件只有 `zh/en` 139 条；其余 6 种 0 覆盖；
- PR #2 RU 词典完整但注册方式不满足基线要求，决定不合并；
- 第三轮复核：代码无 `setLocale` / `locale.preference` / 语言开关，只有 `register` + `bind`；语言显示跟随 DSH 设置；
- 第三轮补充：P3 设置标题右侧内联提示「插件语言跟随DSH本体设置显示」，preview 已确认，不做浮层；
- 待实施，目标版本 **2.1.0**。
