# P1 底栏右移与 P2 余额右对齐

> 状态：已实施（2.0.0 候选，未正式发布）<br>
> 完成时间：2026-11-05<br>
> 关联逻辑根：`dsh-token-dash`（`client.js`）<br>
> 关联资料：[GitHub issue #1](https://github.com/spartawhy117/dsh-token-dash/issues/1)、[`ui-design.md`](../../ui-design.md) v3.7、看板 plan [`feature_board_cards_redesign.md`](feature_board_cards_redesign.md)

## 一、最终需求与范围

| ID | 处置 | 需求 | 结论 |
|---|---|---|---|
| REQ-01 | 完成 | P1 从底栏左侧移到右侧 | 保留 `composer.dock`，Pill 根节点 `order:10`，排到 ContextMeter 之后 |
| REQ-02 | 完成 | 与 `shy3130/dsh-quota` 位置一致 | 输入框底栏最右，P1 右缘距 dock 右缘 ≤24px |
| REQ-03 | 完成 | 删除新会话 hero 槽位占用 | 删除 `conversation.hero.agentPreset` 注入，官方模式恢复 |
| REQ-04 | 完成 | 不重复挂载 | 不新增 `input.right` / `input.dock`；只保留 `composer.dock` |
| REQ-05 | 完成 | 代码改动最小 | 注册项 `order:10` + Pill 根节点 `order:10`；不改 P2/P3/VM |
| REQ-06 | 完成 | 文档、预览、测试同步 | UI / README / design / CHANGELOG / page-p1 / e2e / 静态测试 |
| REQ-07 | 完成 | P2 真实余额右对齐 | 跨第 3–4 列，贴面板右缘；前三组位置不变 |
| BND-01 | 保持 | 不改官方模式选择器实现 | 不复制、不包裹、不替换 |
| BND-02 | 保持 | 不改 `main` / `sidebar.panellist` | P3 / 侧栏入口不动 |
| BND-03 | 保持 | 不改 `/summary`、`/usage`、`/prefs`、VM、provider | 纯客户端槽位/布局修复 |
| RSK-01 | 已验证 | 只改注册项 order 不能越过 ContextMeter | Pill 根节点 `order:10` 后 e2e 右缘通过 |
| RSK-02 | 已验证 | 空白页无 `composer.dock` | 空白页无 P1，e2e 单独断言 |
| RSK-03 | 已验证 | 右侧 Pill 过宽 | e2e/截图量宽通过 |
| RSK-04 | 已验证 | 面板右侧溢出 | 既有 `measurePanel` 左移逻辑通过 |
| RSK-05 | 已验证 | 余额右对齐挤压已用/预算 | 仅余额跨 3–4 列，前两组不动 |

## 二、最终实现

### 改动总览

| 范围 | 改动 |
|---|---|
| `client.js` · hero | 删除 `slots.inject('conversation.hero.agentPreset', …)` 整段 |
| `client.js` · composer.dock | 注册项 `order: -1` → `10` |
| `client.js` · `styles.pillWrap` | 新增 `order: 10`，保留 `marginLeft: 8` |
| `client.js` · `P2Summary` | 余额 `gridColumn:'3 / 5'`、`justifySelf:'end'`、`alignItems:'flex-end'`、`textAlign:'right'` |
| `test/fixtures/e2e-session.jsonl` | 脱敏会话 fixture，e2e/shots 复用 |
| `scripts/e2e.mjs` | 空白页无 P1 + 官方模式；fixture 会话 P1 右缘；余额右缘 |
| `test/unit/client-slots.test.mjs` | 静态断言无 hero / composer order / Pill order / 无 input.right |
| `docs/ui-design.md` | v3.7：底栏右移 + 余额右对齐 |
| `docs/design.md` | P1 槽位说明；看板 plan 链接 |
| `README.md` / `README.en.md` | P1 底栏右侧、测试数 80 |
| `tools/preview/templates/page-p1.html` | 标题/说明 |
| `tools/preview/templates/page-p2.html` | 余额右对齐预览 |
| `tools/mock/shots.mjs` | 种 fixture、打开会话后截图 |
| `CHANGELOG.md` | 2.0.0 补 P1 右移 + P2 余额右对齐 |

### 结构

```text
slots.inject 保留：
  conversation.composer.dock → P1 Pill（order 10；Pill 根节点 order 10）
  main                       → P3 BoardPage
  sidebar.panellist          → BoardEntry

删除：
  conversation.hero.agentPreset → 官方模式按钮归还宿主
不再使用：
  conversation.input.right / conversation.input.dock
```

### 关键决策

| 项 | 结论 |
|---|---|
| 槽位 | P1 只挂 `composer.dock`；hero 释放 |
| 右侧 | 注册项与 Pill 根节点都要 `order:10`；`marginLeft` 保持 8 |
| 空白页 | `composer.dock` 不渲染，无 P1；不补 DOM |
| 测试 | 空白页断言 + 脱敏 fixture 会话；不依赖真实 `~/.dsh` |
| 余额 | 第 3–4 列合并，右对齐面板右缘 |

## 三、不改动 / 边界

- 不改官方模式选择器、P2/P3 数据与接口。
- 不新增 `input.right` / `input.dock` 槽位，不重复挂载 P1。
- 空白页无 `composer.dock` 时不强行显示 P1。
- 不 tag、不 npm publish。

## 四、验收

| 项 | 结果 |
|---|---|
| 官方「标准模式」按钮 | 恢复 |
| P1 槽位 | `composer.dock`，无 hero / input.right |
| P1 右缘 | 距 dock 右缘 ≤24px |
| P2 余额 | 距面板右缘 ≤18px |
| 空白页 P1 | 0 |
| 单测 | 80 通过 / 0 失败 |
| e2e | UI assertions passed |
| 截图 | `npm run shots` 重出 6 张 |
| 安装 | desktop 2.0.0 候选 |

## 五、计划—实际偏差

```text
最初以为换 input.right → 实际应在 composer.dock
最初只改注册项 order → 实际必须给 Pill 根节点加 order
最初 e2e 依赖空白页 hero P1 → 改为脱敏 fixture 会话
P2 余额最初留空第 4 列 → 改为跨 3–4 列右对齐
```

## 六、关联资料

- GitHub issue #1：<https://github.com/spartawhy117/dsh-token-dash/issues/1>
- UI 设计：`docs/ui-design.md` v3.7
- 看板 plan：`docs/plan/archived/feature_board_cards_redesign.md`
- 测试 fixture：`test/fixtures/e2e-session.jsonl`
