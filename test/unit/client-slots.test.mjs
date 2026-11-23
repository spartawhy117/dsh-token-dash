import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('../../client.js', import.meta.url), 'utf8')

test('P1 取当前 provider：投影读 next（= pending ?? lastUsed）', () => {
  // 宿主 modelSelection 投影对客户端输出 { lastUsed, next }，next = pending ?? lastUsed。
  // 客户端不存在 pending 字段，读它必然落空、退回旧值。
  assert.ok(source.includes("projection?.next ?? projection?.lastUsed"))
  assert.ok(!source.includes('projection?.pending'))
  assert.ok(source.includes("useProjection('modelSelection')"))
})

test('P1 切换供应商后立即取数，不只依赖轮询', () => {
  // active 变化应触发一次即时 load，否则收起态要等满轮询周期才更新。
  assert.ok(source.includes('}, [active, load])'))
  // 轮询回调必须读 ref，避免闭包停留在旧 active
  assert.ok(source.includes('summaryPath(activeRef.current)'))
})

test('P1/P2 选卡以 active 优先、记账口径兜底', () => {
  // active 与 currentProviderId 各出现一次作为两级依据（Pill / Panel 两处）
  const hits = source.match(/providers\.find\(\(provider\) => provider\.id === active\)/g) ?? []
  assert.equal(hits.length, 2)
  const fallback = source.match(/providers\.find\(\(provider\) => provider\.id === summary\?\.currentProviderId\)/g) ?? []
  assert.equal(fallback.length, 2)
})

test('P1 stays in composer.dock, right aligned, without touching host agentPreset', () => {
  assert.ok(source.includes("slots.inject('conversation.composer.dock'"))
  assert.ok(source.includes("name: 'conversation.composer.dock'"))
  assert.ok(source.includes("id: 'token-dash-input', order: 10"))
  assert.ok(source.includes("order: 10, marginLeft: 8"))
  assert.ok(!source.includes('conversation.hero.agentPreset'))
  assert.ok(!source.includes('conversation.input.right'))
  assert.ok(!source.includes('conversation.input.dock'))
})

test('P1 字号收敛：pill 显式声明 12px，不再继承宿主 16px', () => {
  // styles.pill 必须同时声明字号与行高：缺任一项都会被宿主底栏的 16px/normal 接管，
  // 后果是前缀与数值比标签大出一档，同一行出现多条文字基线。
  assert.ok(source.includes("fontSize: 12, lineHeight: '16px'"))
  assert.ok(source.includes("height: 24, padding: '0 8px'"))
})

test('P1 标签使用独立的 pillLabel，P2 共用的 summaryLabel 保持 11px', () => {
  // summaryLabel 同时被 P2 主区使用（ui-design.md §4.3 要求 P2 标签 11px），
  // 因此 P1 不能就地改它，必须走独立样式。
  assert.ok(source.includes("pillLabel: { color: T.muted, fontSize: 12, lineHeight: '16px' }"))
  assert.ok(source.includes('summaryLabel: { color: T.muted, fontSize: 11 }'))
  const pillLabels = source.match(/{ 'data-td-label': true, style: styles\.pillLabel }/g) ?? []
  assert.equal(pillLabels.length, 3)
})

test('InlineRing / PercentValue 允许调用方覆盖字号与行高，缺省保持旧行为', () => {
  // P1 需要环内数字与其余文字共用 16px 行盒且不带 2px 补偿；
  // 不传时必须保留原行为，否则 P2 / P3 会被顺带改掉。
  assert.ok(source.includes("...(fontSize === undefined ? { paddingBottom: 2 } : { fontSize })"))
  // React 把 lineHeight 当无单位属性：传数字 16 会算成 16 × fontSize（实测 192px），
  // 因此入口必须归一化成带单位字符串。
  assert.ok(source.includes("typeof lineHeight === 'number' ?"))
  assert.ok(source.includes("lineHeightCss === undefined ? { lineHeight: 1, paddingBottom: 2 }"))
})

test('SubWindow 的 labelFontSize 是 P1 专用分支，未传时保持 P2 旧补偿', () => {
  assert.ok(source.includes('labelFontSize'))
  assert.ok(source.includes("height: ringSize, position: 'relative', top: -0.5"))
  assert.ok(source.includes("fontSize: labelFontSize, lineHeight: '16px' }"))
  assert.ok(source.includes('labelFontSize: 12, ringTestId'))
})

test('P1 环下移 0.75px：环心对齐文字墨迹中心（Issue #1）', () => {
  // 文字基线一致后，环墨迹中心仍比文字中心低 0.74px，视觉上数字显得沉下去。
  // 移环而非移文字：环是 SVG，平移不涉及字体度量，换字体后依然成立。
  assert.ok(source.includes('ringShift'))
  assert.ok(source.includes('ringShift: 0.75'))
  assert.ok(source.includes('top: ringShift'))
})

test('订阅段用独立 gap 容器，分隔符不含两侧空格（Issue #1）', () => {
  // 直接子节点直挂 pill 时，每个窗口与分隔符各吃一份 pill 的 gap: 6，
  // 无法把订阅段单独收紧到 4（改 pill gap 会连带 API 段）。
  assert.ok(source.includes("pillGroup: { display: 'inline-flex', alignItems: 'center', gap: 4 }"))
  assert.ok(source.includes("key: 'subgroup'"))
  // 只校验实际渲染语句（注释中保留旧写法说明是允许的）
  assert.ok(source.includes("style: { color: T.weak } }, '・')"))
  assert.ok(!source.includes("style: { color: T.weak } }, ' ・ '"))
})

test('P2 主区三栏：左贴左 / 中居中 / 右贴右（Issue #2）', () => {
  assert.ok(source.includes("minmax(0,1fr) minmax(0,1.5fr) minmax(0,1fr)"))
  assert.ok(source.includes("...styles.summaryCell, alignItems: 'flex-start'"))
  assert.ok(source.includes("...styles.summaryCell, alignItems: 'center' }"))
  assert.ok(source.includes("alignItems: 'flex-end'"))
})

test('用量表头分隔线由跨列行承载（Issue #3）', () => {
  // 逐 cell 画边框会被 columnGap 切成多段，表头线与数据线不等长
  assert.ok(source.includes("gridColumn: '1 / -1'"))
  assert.ok(!source.includes("paddingBottom: 6, borderBottom"))
})

test('P2 失败态重试入口唯一，禁用旧数据（Issue #4）', () => {
  assert.ok(source.includes("'data-testid': 'token-dash-retry'"))
  assert.ok(source.includes('failed: error || usageError'))
  assert.ok(source.includes('retryChip'))
  // 失败即清空，避免陈旧数据被当成当前值
  assert.ok(source.includes('setUsageError(true)') && source.includes('setUsage(null)'))
})

test('P2 订阅窗口与 P1 同为单字号（Issue #6）', () => {
  // WindowRow 传 labelFontSize 才会走单字号分支，去掉 height:环径 + top:-0.5 的老补偿
  assert.ok(source.includes('labelFontSize: 12 })'))
})
