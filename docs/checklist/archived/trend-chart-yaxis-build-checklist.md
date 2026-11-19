# 趋势图 Y 轴恢复施工稿（S1–S6）

> 状态：已归档（S1–S6 全部落地，测试通过；用户 2026-11-19 指令压缩归档）<br>
> 上游方案：[`feature_trend_yaxis.md`](../../plan/active/feature_trend_yaxis.md)<br>
> 关联契约：[`ui-design.md`](../../ui-design.md) §5.5（v3.18）<br>
> 目标版本：`2.3.1-local.2`（本地构建，不 tag、不发布）<br>
> P4 CL：`547b700`（首版 Y 轴）/ `b6cc2a9`（移出绘图区 + 表格分区）

## 一、阶段与改动映射

| 阶段 | 内容 | 完成判据 | 结果 |
|---|---|---|---|
| S1 | 事实勘察 | 定位删渲染的提交，确认属实现回退而非设计变更 | 完成（`c41b9eb`） |
| S2 | 方案定稿 | 三档 / 恢复网格 / 轴宽自适应三项拍板 | 完成 |
| S3 | 代码实施 | 网格 + 三档刻度恢复，`ui-design.md` 同步 | 完成 |
| S4 | 测试 | L1 + E2E 覆盖刻度档位与位置 | 完成 |
| S5 | 本地打包 | `2.3.1-local.1` pack + 装入 desktop | 完成 |
| S6 | 追加修正 | 轴移出绘图区、命中率口径、表格分区标题 | 完成（`2.3.1-local.2`） |

## 二、测试与交付

| 层 | 命令 | 覆盖 | 结果 |
|---|---|---|---|
| L1 | `npm test` | `trendAxisTicks` 档位、全零、离散 0%、轴列结构、下限忽略离群 | 139 通过 / 1 跳过（local 跳过 Release notes） |
| L2+L3 | `npm run e2e` | 真实宿主 + Playwright：刻度存在、`axis.right <= plot.left`、命中率刻度带 `%`、明细表标题 | 全绿 |
| 目检 | `npm run shots` | `settings.png` 三条网格线、刻度不压柱、分区标题清晰 | 已确认 |
| 打包 | `npm run pack` | `dsh-token-dash-2.3.1-local.2.tgz`（23 files） | 完成并装入 desktop |

## 三、根因与处置

```text
9907212  首次实现 → 2 档 Y 轴 + 3 条网格线
c41b9eb  「悬停虚线」改造 → 删掉这 5 行渲染
         ✗ 样式 trendAxis / trendGrid 未删（一直躺在 styles 里）
         ✗ ui-design.md §5.5 未改（仍要求画）
         → 34px 轴留白从此空置
```

| 轮次 | 现象 | 根因 | 处置 |
|---|---|---|---|
| 首轮 | 趋势图无纵坐标，左侧空一块留白 | `c41b9eb` 误删渲染，样式与文档未同步 | 恢复三条网格 + 三档刻度；修正 `trendAxis` 原 `left:0` 会压柱的定位缺陷 |
| 追加 | 刻度压在柱体区域内 | 刻度绝对定位在 `trendPlot` 内；CC Switch 的 `<YAxis>` 在绘图区外单独占列 | `trendPlot` 改两列网格，轴列 + 绘图区列分离 |
| 追加 | 命中率显示 `99.6% / 49.8%` | 顶档取数据最大值；下限被单个 0% 日拽回 0 | 顶档固定 100%；`hitRateFloor` 忽略离群 0% |
| 追加 | 图表与表格仅 1px 分隔 | 明细表无区块标题 | 新增「模型明细」标题行 + 范围说明 |

## 四、关键结论

- 坐标系与绘图区**两列网格**分离是本次的结构性改动：此前所有依赖 `calc(34px + ...)` 的定位（柱区 `paddingLeft`、日期刻度、悬停虚线 / 圆点 / 浮层、空态文案）都改由绘图区列自己承担，魔法数被移除。
- 命中率轴的两处口径（顶档 100%、忽略离群 0%）属于**可复用的刻度规则**，已写入 `ui-design.md` §5.5。
- 本项目不引入图表库（BND-03），因此参照 CC Switch 的 recharts 布局时只能手绘同构结构。

## 五、遗留

| 项 | 说明 |
|---|---|
| P2 浮层无趋势图 | 已核实 `client.js` 中趋势图仅 1 处渲染点，第二张截图属 CC Switch 参照图，无需处理 |
| 正式发布 | `2.3.1` 正式发布流程（含 description 口径修正）另行推进，见 `listing-description-release-build-checklist.md` |

## 六、踩坑沉淀

| 编号 | 现象 | 根因 | 沉淀 |
|---|---|---|---|
| 1 | 趋势图左侧长期空出 34px 留白 | 删渲染点时未删样式、未改设计文档 | 删除渲染点须同步清理样式，或以注释标明「暂时隐藏」 |
| 2 | `dsh plugin add` 报 `command not found` | CLI 在 `resources/runtime/cli/bin`，未写进 PATH | 本机安装 / 卸载插件一律走绝对路径 |
| 3 | `npm run e2e` 连续失败，报 `data.published` undefined | npm registry 对本机 IP 返回 `429` 限流（`curl` 可复现） | e2e 失败先用 `curl` 探 registry 状态再判代码问题 |
| 4 | 编辑 `client.js` 后 diff 显示 4783 行变动 | 编辑工具把整份文件转成了 CRLF | 提交前用 `grep -qU $'\r'` 复核换行符 |

## 七、归档

2026-11-19 用户确认无问题后压缩归档；详细施工过程见 git 历史（`547b700`、`b6cc2a9`）与 plan `feature_trend_yaxis.md`。
