# P3 设置区块外置标题

> 状态：已实施（2.0.0）<br>
> 完成时间：2026-11-05<br>
> 关联逻辑根：`dsh-token-dash`（`client.js`）<br>
> 关联资料：[`ui-design.md`](../../ui-design.md) v3.8 §5.7、归档 plan [`feature_p1_bottom_right.md`](../archived/feature_p1_bottom_right.md)

## 一、最终需求与范围

| ID | 最终处置 | 需求 / 边界 / 风险 | 最终结论或迁移去向 |
|---|---|---|---|
| REQ-01 | 完成 | P3 设置区增加标题 | **画框外**区块标题「设置与数据管理」，与「范围与明细」同级 |
| REQ-02 | 完成 | 标题不进入设置胶囊 | 胶囊内不加标题行，原有三行保持不变 |
| REQ-03 | 完成 | 标题样式与已有区块一致 | `styles.sectionTitle`：13px / 600，位于 `boardSectionHead` |
| REQ-04 | 完成 | 文档、预览、截图、e2e 同步 | UI §5.7 / page-p3 / settings.png / e2e 均已同步 |
| BND-01 | 保持 | 不改设置三行控件与行为 | 刷新间隔 / 日志 / 版本原样 |
| BND-02 | 保持 | 不改 P1/P2、provider、VM、接口 | 仅 P3 结构 |
| BND-03 | 保持 | 不加折叠、按钮或第二标题 | 纯区块标题 |
| RSK-01 | 已验证 | 标题与页面区块标题重复 | 与「范围与明细」同款，视觉层级一致 |
| RSK-02 | 已验证 | 胶囊间距变化 | 用 `boardSection` 的 12px gap，不额外加卡内高度 |

## 二、最终实现

### 3.0 最终改动总览

| ID | 类型 | 文件 | 开发改动说明 |
|---|---|---|---|
| CHG-01 | 修改 | `client.js` · `BoardPage` | 用 `section.boardSection` 包住设置胶囊，`boardSectionHead` 内加 `b[data-testid=token-dash-settings-title]`（`styles.sectionTitle`） |
| CHG-02 | 修改 | `client.js` · `SettingsRows` | 删除函数内部误加的 `settings-title` 行，三行从「刷新间隔」开始 |
| CHG-03 | 修改 | `client.js` · `styles` | 删除 `settingsTitle`，统一复用 `sectionTitle`（13px / 600） |
| CHG-04 | 文档 | `docs/ui-design.md` §5.7 | 标题改为画框外；胶囊行表恢复 3 行 |
| CHG-05 | 预览 | `tools/preview/templates/page-p3.html` | 标题移到胶囊外，样式同「范围与明细」 |
| CHG-06 | 测试 | `scripts/e2e.mjs` | 断言标题存在、在胶囊外、标题底部早于胶囊顶部 |
| CHG-07 | 截图 | `tools/mock/shots.mjs` | `settings.png` 重出 |
| CHG-08 | 配置 | `CHANGELOG.md` | 2.0.0 块补「设置区块标题」 |

### 2.1 最终结构

```text
section.boardSection
  ├─ boardSectionHead → b[token-dash-settings-title]「设置与数据管理」
  └─ capsule[token-dash-settings-capsule]
       ├─ 刷新间隔 / 账户余额
       ├─ 日志 / 数据
       └─ 版本 / 检查更新
```

标题与胶囊间距由 `boardSection` 的 12px 控制；胶囊底部 32px 留白不变；窄屏不换行、不缩字号。

### 2.2 关键代码骨架

```js
h('section', { style: styles.boardSection },
  h('div', { style: styles.boardSectionHead },
    h('b', { 'data-testid': 'token-dash-settings-title', style: styles.sectionTitle }, tr('设置与数据管理'))),
  h('div', { 'data-testid': 'token-dash-settings-capsule', style: styles.capsule },
    h(SettingsRows, { ... })))
```

### 2.3 关键陷阱

| 项 | 约束 |
|---|---|
| 标题放进 `SettingsRows` 内部 | 错误做法；标题必须在外层 `boardSectionHead`，胶囊内仍只有三行 |
| 新增独立 `settingsTitle` 样式 | 不必要；`sectionTitle` 已是 13px / 600，新增会导致两处维护 |

## 三、不改动 / 边界

- 不改设置三行控件、顺序、按钮样式与回调；
- 不把标题放回胶囊内部；
- 不改 P1/P2、provider、VM、接口。

## 四、最终验收

| 项 | 来源 | 环境与方式 | 结果 |
|---|---|---|---|
| 标题位于胶囊上方、画框外 | REQ-01 | `settings.png` 目检 | 通过：标题在胶囊上方 |
| 标题与「范围与明细」同为 13px / 600 | REQ-03 | 代码走查 `styles.sectionTitle` | 通过 |
| 胶囊内第一行仍是刷新间隔 | REQ-02 / BND-01 | e2e + 截图 | 通过 |
| e2e 断言标题存在、在胶囊外、在其上方 | REQ-04 | `npm run e2e` | 通过：UI assertions passed |
| 单元测试 | 质量门槛 | `npm test` | 通过：80 通过 |
| 2.0.0 候选包 | 交付物 | `npm run pack` | 已产出并安装 |

## 六、诊断锚点

- DOM 锚点：`[data-testid=token-dash-settings-title]`（区块标题）、`[data-testid=token-dash-settings-capsule]`（胶囊）
- 高价值断言：标题节点须为胶囊节点的**前序兄弟**，且 `title.bottom < capsule.top`
