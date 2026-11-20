import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMonthlySeries, buildUsage, eachDayKey } from '../../src/core.js'
import { resetPricingForTests, setCatalogForTests } from '../../src/pricing.js'

const now = new Date(2026, 10, 2, 12, 0, 0).getTime()
const providers = [
  { id: 'deepseek-official', name: 'DeepSeek', kind: 'api', currency: 'CNY' },
  { id: 'zhipu', name: 'GLM Coding', kind: 'subscription', currency: 'CNY' },
]
const row = (input, output, cost, requests = 1) => ({
  input, cacheRead: 0, cacheWrite: 0, output, requests, cost, priced: true,
})
const state = {
  days: {
    '2026-11-02': {
      providers: {
        'deepseek-official': { models: { 'deepseek-flash': row(1000, 100, 3) } },
        zhipu: { models: { 'glm-5.3': row(200, 20, 0) } },
      },
    },
    '2026-11-01': {
      providers: {
        'deepseek-official': { models: { 'deepseek-flash': row(2000, 200, 5) } },
      },
    },
    '2026-10-20': {
      providers: {
        'deepseek-official': { models: { 'deepseek-flash': row(4000, 400, 7) } },
      },
    },
  },
}

test('buildUsage: today only and no default rows', () => {
  const usage = buildUsage(state, { billingModes: {} }, 'today', now, providers)
  assert.equal(usage.range, 'today')
  assert.equal(usage.models.length, 2)
  assert.equal(usage.models.find((item) => item.providerId === 'deepseek-official').cost, 3)
  assert.equal(usage.models.find((item) => item.providerId === 'zhipu').cost, 0)
  assert.equal(usage.totals.CNY.cost, 3)
  assert.equal(usage.totals.CNY.requests, 1)
})

test('buildUsage: 7d is local calendar window and excludes old days', () => {
  const usage = buildUsage(state, { billingModes: {} }, '7d', now, providers)
  assert.equal(usage.startKey, '2026-10-27')
  assert.equal(usage.models.length, 2)
  assert.equal(usage.totals.CNY.cost, 8)
  assert.equal(usage.totals.CNY.requests, 2)
})

test('buildUsage: all starts at earliest day', () => {
  const usage = buildUsage(state, { billingModes: {} }, 'all', now, providers)
  assert.equal(usage.startKey, '2026-10-20')
  assert.equal(usage.totals.CNY.cost, 15)
  assert.equal(usage.totals.CNY.requests, 3)
})

test('buildUsage: 订阅行 cost 为 0，估算走独立字段', () => {
  const usage = buildUsage(state, { billingModes: {} }, 'today', now, providers)
  const subscription = usage.models.find((item) => item.providerId === 'zhipu')
  assert.equal(subscription.kind, 'subscription')
  assert.equal(usage.totals.CNY.cost, 3)
})

test('buildUsage: hidden providers are excluded but keep a zero bucket', () => {
  const usage = buildUsage(state, { billingModes: { 'deepseek-official': 'hide' } }, 'all', now, providers)
  assert.equal(usage.models.some((item) => item.providerId === 'deepseek-official'), false)
  // 0 桶是两格卡渲染前提：没有它总费用 tile 会空白
  assert.equal(usage.totals.CNY.cost, 0)
  assert.equal(usage.totals.CNY.requests, 0)
})

test('buildUsage: invalid range falls back to today', () => {
  const usage = buildUsage(state, { billingModes: {} }, 'bad', now, providers)
  assert.equal(usage.range, 'today')
})
test('eachDayKey: 含两端、跨月跨年、逆序返回空', () => {
  assert.deepEqual(eachDayKey('2026-11-01', '2026-11-03'), ['2026-11-01', '2026-11-02', '2026-11-03'])
  assert.deepEqual(eachDayKey('2026-10-30', '2026-11-02'), ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
  assert.deepEqual(eachDayKey('2026-12-30', '2027-01-02'), ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'])
  assert.deepEqual(eachDayKey('2026-11-03', '2026-11-01'), [])
  assert.deepEqual(eachDayKey('2026-11-02', '2026-11-02'), ['2026-11-02'])
})

test('buildUsage: series 连续等距且窗口内每个日键都有点', () => {
  const usage = buildUsage(state, { billingModes: {} }, 'all', now, providers)
  assert.equal(usage.startKey, '2026-10-20')
  assert.equal(usage.endKey, '2026-11-02')
  assert.equal(usage.grain, 'day')
  assert.equal(usage.series.length, 14)
  assert.deepEqual(usage.series.map((point) => point.dayKey), eachDayKey('2026-10-20', '2026-11-02'))
  // 中间没有数据的天补零值点，柱数不减
  const gap = usage.series.find((point) => point.dayKey === '2026-10-25')
  assert.equal(gap.tokens, 0)
  assert.equal(gap.requests, 0)
  assert.equal(gap.hitRate, null)
})

test('buildUsage: 日序列与 total / totals 同口径闭合', () => {
  const usage = buildUsage(state, { billingModes: {} }, 'all', now, providers)
  const sumTokens = usage.series.reduce((sum, point) => sum + point.tokens, 0)
  const sumRequests = usage.series.reduce((sum, point) => sum + point.requests, 0)
  const sumCost = usage.series.reduce((sum, point) => sum + (point.cost.CNY?.cost ?? 0), 0)
  assert.equal(sumTokens, usage.total.tokens)
  assert.equal(sumRequests, usage.total.requests)
  assert.ok(Math.abs(sumCost - usage.totals.CNY.cost) < 1e-6)
})

test('buildUsage: 订阅行进 tokens 但不进 cost（口径分叉）', () => {
  const usage = buildUsage(state, { billingModes: {} }, 'today', now, providers)
  const today = usage.series.find((point) => point.dayKey === '2026-11-02')
  // deepseek 1000 输入 + 100 输出 = 1100；zhipu 200 + 20 = 220 也计入 tokens，但其成本不进 cost
  assert.equal(today.tokens, 1100 + 220)
  assert.equal(today.cost.CNY.cost, 3)
  assert.equal(today.cost.CNY.requests, 1)
})

test('buildUsage: hide 的 provider 不进日序列', () => {
  const visible = buildUsage(state, { billingModes: {} }, 'today', now, providers)
  const hidden = buildUsage(state, { billingModes: { zhipu: 'hide' } }, 'today', now, providers)
  const pick = (usage) => usage.series.find((point) => point.dayKey === '2026-11-02')
  assert.ok(pick(visible).tokens > pick(hidden).tokens)
  assert.equal(pick(hidden).tokens, 1100)
})

test('buildUsage: today 只有 1 个点', () => {
  const usage = buildUsage(state, { billingModes: {} }, 'today', now, providers)
  assert.equal(usage.series.length, 1)
  assert.equal(usage.series[0].dayKey, '2026-11-02')
})

test('buildUsage: 无 token 的行命中率为 null 而不是 0', () => {
  const empty = {
    days: {
      '2026-11-02': {
        providers: {
          'deepseek-official': {
            models: {
              'deepseek-flash': { input: 0, cacheRead: 0, cacheWrite: 0, output: 0, requests: 3, cost: 0, priced: 'empty' },
            },
          },
        },
      },
    },
  }
  const usage = buildUsage(empty, { billingModes: {} }, 'today', now, providers)
  assert.equal(usage.series[0].requests, 3)
  assert.equal(usage.series[0].hitRate, null)
})

test('buildMonthlySeries: 超过 60 个日点按月合并，未超过原样返回', () => {
  const day = (dayKey, tokens) => ({
    dayKey, cost: { CNY: { cost: 1, requests: 1 } }, requests: 1,
    input: tokens, cacheRead: 0, cacheWrite: 0, output: 0, tokens, hitRate: null,
  })
  const sixty = Array.from({ length: 60 }, (_, index) => day('2026-09-' + String((index % 30) + 1).padStart(2, '0'), 1))
  assert.equal(buildMonthlySeries(sixty).grain, 'day')

  const many = []
  for (let month = 1; month <= 3; month += 1) {
    for (let d = 1; d <= 25; d += 1) many.push(day(`2026-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`, 2))
  }
  const { grain, series } = buildMonthlySeries(many)
  assert.equal(grain, 'month')
  assert.equal(series.length, 3)
  assert.equal(series[0].dayKey, '2026-01')
  assert.equal(series[0].tokens, 50)
  assert.equal(series.reduce((sum, point) => sum + point.cost.CNY.cost, 0), 75)
})

// —— 订阅用量的估算 API 价格（feature_subscription_estimated_cost）——

const estimateState = {
  days: {
    '2026-11-02': {
      providers: {
        'deepseek-official': { models: { 'deepseek-flash': row(1_000_000, 500_000, 3) } },
        zhipu: { models: { 'glm-5.3': row(1_000_000, 500_000, 0) } },
      },
    },
  },
}

test('订阅行给出估算 API 价格并计入总费用（REQ-01 / REQ-06）', () => {
  resetPricingForTests()
  setCatalogForTests([
    { modelId: 'deepseek-flash', family: 'deepseek', input: 1, output: 4 },
    { modelId: 'glm-5.3', family: 'glm', input: 1, output: 2 },
  ])
  const usage = buildUsage(estimateState, { billingModes: {} }, 'today', now, providers)
  const sub = usage.models.find((item) => item.providerId === 'zhipu')
  // cost 仍归零，估算走独立字段：1e6 × 1 + 5e5 × 2 每百万 token = 2
  assert.equal(sub.cost, 0)
  assert.equal(sub.estimatedPriced, true)
  assert.equal(sub.estimatedCost, 2)
  // 总费用 = 实际 + 估算（D-04），并单列 estimated
  assert.equal(usage.totals.CNY.cost, 5)
  assert.equal(usage.totals.CNY.estimated, 2)
  // api 行不下发估算字段，避免与 cost 混淆
  const api = usage.models.find((item) => item.providerId === 'deepseek-official')
  assert.equal(api.estimatedCost, undefined)
  assert.equal(api.estimatedPriced, undefined)
})

test('目录价缺失时标未定价，不补 0（REQ-04）', () => {
  resetPricingForTests()
  setCatalogForTests([])
  const usage = buildUsage(estimateState, { billingModes: {} }, 'today', now, providers)
  const sub = usage.models.find((item) => item.providerId === 'zhipu')
  assert.equal(sub.estimatedPriced, false)
  assert.equal(sub.estimatedCost, null)
  assert.equal(sub.cost, 0)
})

test('订阅估算跨多日累加，口径与 costOf 一致（REQ-02）', () => {
  resetPricingForTests()
  setCatalogForTests([{ modelId: 'glm-5.3', family: 'glm', input: 1, output: 2 }])
  const twoDays = {
    days: {
      '2026-11-02': { providers: { zhipu: { models: { 'glm-5.3': row(1_000_000, 0, 0) } } } },
      '2026-11-01': { providers: { zhipu: { models: { 'glm-5.3': row(0, 500_000, 0) } } } },
    },
  }
  const usage = buildUsage(twoDays, { billingModes: {} }, '7d', now, providers)
  const sub = usage.models.find((item) => item.providerId === 'zhipu')
  assert.equal(sub.estimatedCost, 2) // 1e6 × 1 + 5e5 × 2，分两日累加
  assert.equal(usage.totals.CNY.cost, 2)
  assert.equal(usage.totals.CNY.estimated, 2)
})
