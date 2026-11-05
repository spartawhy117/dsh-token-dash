import test from 'node:test'
import assert from 'node:assert/strict'
import { addRecord, buildSummary, emptyState } from '../../src/core.js'

const now = new Date(2026, 9, 31, 12, 0, 0).getTime()

test('providers and apiTotals are separated by billing mode and currency', () => {
  const state = emptyState()
  addRecord(state, { ts: now, provider: 'deepseek-account', model: 'deepseek-flash', input: 1_000_000, output: 1_000_000 })
  addRecord(state, { ts: now, provider: 'openrouter', model: 'deepseek-flash', input: 1_000_000, output: 1_000_000 })
  addRecord(state, { ts: now, provider: 'zhipu', model: 'glm-5.3', input: 1_000_000, output: 1_000_000 })
  const providers = [
    { id: 'deepseek-official', kind: 'api', currency: 'CNY', balance: { amount: 10, status: 'ok', currency: 'CNY' } },
    { id: 'openrouter', kind: 'api', currency: 'USD' },
    { id: 'zhipu', kind: 'subscription', currency: 'CNY', windows: [{ key: '5h', usedPercent: 42.5 }] },
  ]
  const summary = buildSummary(state, {
    budgets: { 'deepseek-official': { amount: 100, currency: 'CNY' }, openrouter: { amount: 50, currency: 'USD' } },
    showBalance: true,
  }, now, providers)
  assert.equal(summary.providers.length, 3)
  assert.equal(summary.providers.find((item) => item.id === 'zhipu').kind, 'subscription')
  assert.equal(summary.providers.find((item) => item.id === 'zhipu').budget, undefined)
  assert.equal(summary.apiTotals.CNY.budget, 100)
  assert.equal(summary.apiTotals.USD.budget, 50)
  assert.ok(summary.breakdown.models.filter((item) => item.kind === 'subscription').length >= 0)
  assert.equal(summary.breakdown.models.some((item) => item.providerId === 'zhipu' && item.share === 0), true)
  assert.equal(summary.pricingLinks.length, 7)
  assert.deepEqual(summary.pricingLinks.map((item) => item.label), ['DeepSeek', 'Zhipu AI', 'Kimi', 'OpenRouter', 'Qwen', 'OpenCode Go', 'Command Code'])
})

test('no providers yields an empty VM', () => {
  const summary = buildSummary(emptyState(), { budgets: {} }, now, [])
  assert.deepEqual(summary.providers, [])
  assert.deepEqual(summary.breakdown.models, [])
  assert.equal(summary.currentProviderId, null)
})

test('旧 plans 输入只作为兼容读取，VM 输出不保留 plans', () => {
  const summary = buildSummary(emptyState(), {}, now, [
    { id: 'zhipu', kind: 'subscription', currency: 'CNY', plans: [{ key: '5h', usedPercent: 10 }] },
  ])
  const provider = summary.providers.find((item) => item.id === 'zhipu')
  assert.equal(provider.kind, 'subscription')
  assert.deepEqual(provider.windows, [{ key: '5h', usedPercent: 10 }])
  assert.equal('plans' in provider, false)
})

test('快照 mode 不进入 VM；unknown 时沿用 providerKinds', () => {
  const state = emptyState()
  state.providerKinds = { zhipu: 'subscription' }
  const summary = buildSummary(state, {}, now, [
    { id: 'zhipu', kind: 'api', mode: 'unknown', currency: 'CNY' },
    { id: 'deepseek-official', kind: 'api', mode: 'api', currency: 'CNY' },
  ])
  const zhipu = summary.providers.find((item) => item.id === 'zhipu')
  assert.equal(zhipu.kind, 'subscription')
  assert.equal('mode' in zhipu, false)
})
