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
