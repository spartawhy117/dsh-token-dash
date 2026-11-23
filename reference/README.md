# 第三方参考

仅用于本地研究 provider / 用量 / 计价实现，不参与构建，不提交源码。

| 目录 | 仓库 | 重点 | 现状档案 |
|---|---|---|---|
| `third-party/dsh-spend` | `nonewind/dsh-spend` | `lib/knowledge.js`：provider / model 知识库与别名 | — |
| `third-party/dsh-stats-panel` | `zhang-jiazhi/dsh-stats-panel` | `src/index.ts`：从 settings / profile patch 扫描 providers | — |
| `third-party/dsh-ui-usage-billing` | `kenz1117/dsh-ui-usage-billing` | `src/aggregate.ts`：`message.source` 归属；`src/client/pricing.ts`：多供应商目录 | — |
| `third-party/dsh-cost-dashboard` | `mike-lee0120/dsh-cost-dashboard` | 费用看板与多模型价格表 | — |
| `third-party/dsh-token-usage-lao` | `LaoYueHanNi/dsh-token-usage` | `src/provider-label.ts`：provider 展示名与 route key 分离；`src/pricing.ts`：云价格表 + 历史价 | — |
| `third-party/dsh-token-usage-leeman` | `LeemanCheung/dsh-token-usage` | 持久化用量记录与 provider 归属 | — |
| `third-party/dsh-cockpit` | `Lxiayu/DshCockpit` | `src/cost.js` / `src/token-stats.js`：成本与用量看板 | — |
| `third-party/dsh-quota-dashboard` | `InvisibleSirius/dsh-quota-dashboard` | `client.js`：pill 状态点 + 浮层开合动画与状态聚合；`index.js`：`PROVIDERS` 声明式注册表、balance/usage 两形状结果契约、错误文本脱敏 | `docs/reference/invisiblesirius-dsh-quota-dashboard.md` |
| `third-party/dsh-quota` | `shy3130/dsh-quota` | `index.js`：源级缓存（成功 55s / 失败 10s）+ 在途合并、错误枚举、路由登录门；`client.js`：`visibilitychange` 轮询节律、`useProjection('modelSelection')` 跟随模型、≤520px 紧凑布局 | `docs/reference/shy3130-dsh-quota.md` |
| `third-party/dsh-armory` | `2026heshao/dsh-armory` | **全局面板机制**：`main` + `sidebar.panellist` 同 key 注册 → 中栏整页；三入口并存；入口可见性三值枚举；CSS 别名层、零自选配色 | `docs/reference/2026heshao-dsh-armory.md` |

- 「现状档案」列指向 `docs/reference/` 下的仓库现状描述（只写对方实现，不写我方改造）。
- 可采纳项拆两份：`docs/checklist/active/ui-reference-checklist.md`（UI 形态与全量状态）、`docs/checklist/active/backend-capability-checklist.md`（宿主输出契约）。
- 跨仓库专题调研：`docs/reference/multi-account-subscriptions.md`（多账号 / 多订阅展示，结论不采纳）。

## 截图索引（本地）

`shy3130/dsh-quota` 的 README 自带 12 张实拍截图，随 clone 落在 `third-party/dsh-quota/docs/images/`，并已复制一份到 **`docs/reference/images/`**（已 gitignore，文件名统一为 `owner-repo--<名称>.png`，即 `shy3130-dsh-quota--`；下表的原名对应该副本去掉前缀后的部分）。`InvisibleSirius/dsh-quota-dashboard` 无任何截图，故目录内暂无 `invisiblesirius-dsh-quota-dashboard--` 文件：

| 文件 | 展示内容 | 看点 |
|---|---|---|
| `hero.png` | 头图：GLM / OpenCode Go / DeepSeek 三面板并排 | 整体气质、面板圆角与暗色层次 |
| `glm-pill.png` | 桌面状态栏徽标（GLM） | 徽标字重、进度条位置、与输入框的距离 |
| `deepseek-pill.png` | 桌面徽标（余额 + 今日消耗） | 金额与标签的排布 |
| `opencode-go-pill.png` | 桌面徽标（5h/周/月三窗） | 多窗口并排时的分隔符写法 |
| `glm-panel.png` | GLM 明细面板 | 窗口行结构、绝对量 `696/4000`、工具额度分项、状态行左右分置 |
| `deepseek-panel.png` | DeepSeek 面板（余额 + 估算费用） | 余额拆项、范围 segmented、状态行位置 |
| `opencode-go-panel.png` | OpenCode Go 面板 | 三窗长列表的纵向节奏 |
| `glm-ring.png` | 环状指示器 | 环尺寸与数字的关系 |
| `opencode-go-ring.png` | 环状指示器（多窗） | 多环并排的间距 |
| `mobile-pill.png` | 手机端徽标 | 与宿主统计同行的紧凑写法、短单位标签 |
| `mobile-glm.png` | 手机端 GLM 面板 | 窄屏面板宽度与字号 |
| `mobile-deepseek.png` | 手机端 DeepSeek 面板 | 窄屏下分段控件与数字折行 |

`2026heshao/dsh-armory` 的 7 张 README 实拍图同样已复制到 `docs/reference/images/`，前缀 `2026heshao-dsh-armory--`（`mcp-overview` 是最能说明"整页面板"的一张）。

- `InvisibleSirius/dsh-quota-dashboard` 的 README **没有任何截图**（仓库内也无 `docs/images/`），只能读代码与会话截图自行还原。
- 截图来自上游仓库，仅本地参考，不随本仓入库。

源码目录已加入 `.gitignore`，需要重新拉取时：

```powershell
git clone --depth 1 <repo> reference/third-party/<name>
```
