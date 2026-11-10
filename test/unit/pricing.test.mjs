import test from 'node:test'
import assert from 'node:assert/strict'
import { loadCatalog } from '../../src/catalog.js'
import { resolveMatch } from '../../src/match.js'
import {
  catalogInfo,
  configurePricing,
  loadCommunityPricing,
  resetPricingForTests,
  resolvePrice,
  setCatalogForTests,
} from '../../src/pricing.js'

const BASE = {
  models: [
    { modelId: 'deepseek-v4.1-flash', family: 'deepseek', aliases: ['deepseek-flash'], input: 1, output: 4, cacheRead: 0.02 },
    { modelId: 'deepseek-chat', family: 'deepseek', input: 1.89, output: 7.7 },
    { modelId: 'deepseek-v4-pro', family: 'deepseek', aliases: ['deepseek-pro'], input: 4.5, output: 13.5 },
    { modelId: 'glm-5.3', family: 'glm', input: 8, output: 28 },
    { modelId: 'glm-5.3-flash', family: 'glm', input: 0.8, output: 2.8 },
  ],
}

function setup() {
  resetPricingForTests()
  setCatalogForTests(BASE.models)
}

test('纯模型名匹配：任意 provider 都能出价，provider 不再是准入门槛', () => {
  setup()
  assert.equal(resolvePrice('glm-5.3', 'zhipu').input, 8)
  // 自填 provider / registry 未收录的 provider 一样能算
  assert.equal(resolvePrice('glm-5.3', 'tencent').input, 8)
  assert.equal(resolvePrice('glm-5.3', 'my-relay').currency, 'CNY')
})

test('别名与精确：deepseek-flash → deepseek-v4.1-flash', () => {
  setup()
  const quote = resolvePrice('deepseek-flash', 'tencent')
  assert.equal(quote.confidence, 'alias')
  assert.equal(quote.catalogModel, 'deepseek-v4.1-flash')
  assert.equal(quote.approximate, false)
})

test('版本段隔离：v4.1 不串到 chat / v4-pro', () => {
  setup()
  assert.equal(resolvePrice('deepseek-chat', 'tencent').catalogModel, 'deepseek-chat')
  assert.equal(resolvePrice('deepseek-v4-pro', 'tencent').catalogModel, 'deepseek-v4-pro')
  assert.equal(resolvePrice('deepseek-v4.1-flash-ioa', 'tencent').catalogModel, 'deepseek-v4.1-flash')
})

test('档位保护：glm-5.3-flash 不命中 glm-5.3', () => {
  setup()
  assert.equal(resolvePrice('glm-5.3-flash', 'zhipu').catalogModel, 'glm-5.3-flash')
  assert.equal(resolvePrice('glm-5.3-pro', 'zhipu'), null)
})

test('结构化模糊：剥离噪声后缀，命中唯一候选', () => {
  setup()
  const quote = resolvePrice('deepseek-v4.1-flash-ioa', 'tencent')
  assert.equal(quote.confidence, 'fuzzy')
  assert.equal(quote.approximate, true)
  assert.equal(quote.input, 1)
})

test('多候选不猜：返回 null', () => {
  resetPricingForTests()
  setCatalogForTests([
    { modelId: 'kimi-k3-code', family: 'kimi', input: 1, output: 4 },
    { modelId: 'kimi-k3-air', family: 'kimi', input: 1, output: 4 },
  ])
  assert.equal(resolvePrice('kimi-k3-ioa', 'my-relay'), null)
})

test('表内正则源（aliasPatterns）参与匹配', () => {
  resetPricingForTests()
  setCatalogForTests([
    { modelId: 'claude-sonnet-4.5', family: 'claude', input: 21, output: 105, aliasPatterns: ['^claude-sonnet-4-5(-thinking)?$'] },
  ])
  const quote = resolvePrice('claude-sonnet-4-5-thinking', 'my-relay')
  assert.equal(quote.confidence, 'pattern')
  assert.equal(quote.catalogModel, 'claude-sonnet-4.5')
})

test('未知模型：null（不是 0 元）', () => {
  setup()
  assert.equal(resolvePrice('my-private-model', 'my-relay'), null)
  assert.equal(resolvePrice('', 'my-relay'), null)
})

test('provider 币种声明：USD 走路由价，缺路由时回退社区表并保留 CNY', () => {
  setup()
  configurePricing({ currencyOf: () => 'USD' })
  try {
    const quote = resolvePrice('glm-5.3', 'my-relay')
    assert.equal(quote.currency, 'CNY')
    assert.equal(quote.table, 'community')
  } finally {
    resetPricingForTests()
  }
})

test('override：命中即短路选表，价格与币种同源', () => {
  setup()
  configurePricing({
    overrides: {
      'deepseek-v4.1-flash-ioa': { input: 2, output: 8, currency: 'USD' },
      'tencent:glm-5.3': { input: 3, output: 9, currency: 'CNY' },
    },
  })
  try {
    const byModel = resolvePrice('deepseek-v4.1-flash-ioa', 'my-relay')
    assert.equal(byModel.confidence, 'override')
    assert.equal(byModel.input, 2)
    assert.equal(byModel.currency, 'USD')
    assert.equal(byModel.table, 'override')
    // provider:model 优先于 model，且不再走社区表
    const byProvider = resolvePrice('glm-5.3', 'tencent')
    assert.equal(byProvider.input, 3)
    // 别的 provider 下同一模型仍走表
    assert.equal(resolvePrice('glm-5.3', 'zhipu').confidence, 'exact')
  } finally {
    resetPricingForTests()
  }
})

test('社区峰谷窗口映射为 peak/offPeak，并识别周末', async () => {
  resetPricingForTests()
  const realFetch = globalThis.fetch
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      updatedAt: '1793236514',
      models: [{
        modelId: 'deepseek-v4.1-flash',
        inputCostPerMillion: 1,
        outputCostPerMillion: 4,
        cacheReadCostPerMillion: 0.02,
        aliases: ['deepseek-flash'],
        family: 'deepseek',
        dailySlots: [{
          windows: [{ startMinute: 540, endMinute: 720 }, { startMinute: 840, endMinute: 1080 }],
          daysOfWeek: [1, 2, 3, 4, 5],
          inputCostPerMillion: 2,
          outputCostPerMillion: 8,
          cacheReadCostPerMillion: 0.04,
        }],
      }],
    }),
  })
  try {
    await loadCommunityPricing({ force: true })
    assert.equal(resolvePrice('deepseek-flash', 'tencent', Date.UTC(2026, 9, 30, 2)).input, 2) // 北京 10:00 高峰
    assert.equal(resolvePrice('deepseek-flash', 'tencent', Date.UTC(2026, 9, 30, 13)).input, 1) // 北京 21:00 闲时
    assert.equal(resolvePrice('deepseek-flash', 'tencent', Date.UTC(2026, 9, 31, 2)).input, 1) // 周六
  } finally {
    globalThis.fetch = realFetch
    resetPricingForTests()
  }
})

test('半套峰谷价目回退平坦价', () => {
  resetPricingForTests()
  setCatalogForTests([
    { modelId: 'glm-5.3', family: 'glm', input: 8, cacheRead: 2, output: 28, peak: { input: 9 }, offPeak: { input: 5, output: 14 } },
  ])
  const quote = resolvePrice('glm-5.3', 'zhipu')
  assert.equal(quote.input, 8)
  assert.equal(quote.output, 28)
})

test('全量自检：每个条目用自身名匹配必须回到自身', () => {
  resetPricingForTests()
  const info = catalogInfo()
  const { entries } = loadCatalog({ models: BASE.models }, 'test')
  let failed = 0
  for (const entry of entries) {
    const hit = resolveMatch(entry.modelId, entries)
    if (hit === null || hit.entry.modelId !== entry.modelId) failed += 1
  }
  assert.equal(failed, 0)
  assert.ok(info.models > 0)
})
