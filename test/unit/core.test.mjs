import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addRecord,
  buildSummary,
  costOf,
  displayModel,
  emptyState,
  localDayKey,
  normalizeModel,
  normalizeProvider,
  priceFor,
  providerLabel,
  reattributeUnknown,
  repriceState,
  resolveProviderKind,
  stampProviderKinds,
} from '../../src/core.js'

test('normalizeModel 去掉渠道前缀与后缀', () => {
  assert.equal(normalizeModel('deepseek/deepseek-v4.1-flash-free'), 'deepseek-v4.1-flash')
  assert.equal(normalizeModel('glm-5.3-ioa@2026-10-01'), 'glm-5.3-ioa')
})

test('峰谷价：Flash 高峰 1M 未命中 + 1M 输出 = 10', () => {
  const ts = Date.UTC(2026, 9, 30, 2, 0, 0) // 北京时间 10:00
  const price = priceFor('deepseek-account', 'deepseek-v4-flash', ts)
  assert.equal(price.input, 2)
  assert.equal(price.output, 8)
  const cost = costOf({ ts, provider: 'deepseek-account', model: 'deepseek-v4-flash', input: 1_000_000, cacheRead: 0, cacheWrite: 0, output: 1_000_000 })
  assert.ok(Math.abs(cost - 10) < 1e-9)
})

test('闲时 Flash 1M + 1M = 5', () => {
  const ts = Date.UTC(2026, 9, 30, 13, 0, 0) // 北京时间 21:00
  const cost = costOf({ ts, provider: 'deepseek-account', model: 'deepseek-v4-flash', input: 1_000_000, cacheRead: 0, cacheWrite: 0, output: 1_000_000 })
  assert.ok(Math.abs(cost - 5) < 1e-9)
})

test('第三方按自己的目录价，未知 provider 不套 DeepSeek 价', () => {
  const ts = Date.UTC(2026, 9, 30, 2, 0, 0)
  assert.equal(priceFor('zhipu', 'glm-5.3', ts).input, 8)
  assert.equal(priceFor('openrouter', 'deepseek-flash', ts), null)
  assert.equal(costOf({ ts, provider: 'openrouter', model: 'deepseek-flash', input: 1_000_000, output: 0 }), 0)
})

test('费用占比不超过 100%', () => {
  const state = emptyState()
  const now = Date.UTC(2026, 9, 30, 2, 0, 0) // 北京时间 10:00，高峰
  addRecord(state, { ts: now, provider: 'deepseek-account', model: 'deepseek-v4-flash', input: 10_000, cacheRead: 0, cacheWrite: 0, output: 1_000 })
  const summary = buildSummary(state, { budget: { amount: 0 }, showBalance: false }, now, {
    provider: 'unknown',
    amount: null,
    currency: 'CNY',
    status: 'unsupported',
    updatedAt: now,
  })
  const row = summary.breakdown.models[0]
  assert.equal(row.cost, 0.03)
  assert.ok(row.share <= 1, `share=${row.share}`)
})

test('模型展示名映射到宿主标签', () => {
  const state = emptyState()
  const now = new Date(2026, 9, 31, 12, 0, 0).getTime()
  addRecord(state, { ts: now, provider: 'deepseek-account', model: 'deepseek-flash', input: 10_000, cacheRead: 0, cacheWrite: 0, output: 1_000 })
  const summary = buildSummary(state, { budget: { amount: 0 }, showBalance: true }, now, {
    provider: 'unknown',
    amount: null,
    currency: 'CNY',
    status: 'unsupported',
    updatedAt: now,
  })
  assert.equal(summary.breakdown.models[0].name, 'deepseek-flash')
  assert.equal(summary.breakdown.models[0].displayName, 'DeepSeek-V4.1-Flash')
  assert.equal(summary.breakdown.models[0].providerId, 'deepseek-official')
  assert.equal(summary.breakdown.models[0].providerName, 'DeepSeek')
  assert.equal(summary.showBalance, true)
  assert.equal('showMonthTokens' in summary, false)
})

test('同模型不同 provider 分行，未定价不套官方价', () => {
  const state = emptyState()
  const now = Date.UTC(2026, 9, 30, 2, 0, 0)
  addRecord(state, { ts: now, provider: 'deepseek-account', model: 'deepseek-flash', input: 10_000, output: 1_000 })
  addRecord(state, { ts: now, provider: 'openrouter', model: 'deepseek-flash', input: 10_000, output: 1_000 })
  const summary = buildSummary(state, { budget: { amount: 0 }, showBalance: false }, now, {
    provider: 'unknown',
    amount: null,
    currency: 'CNY',
    status: 'unsupported',
    updatedAt: now,
  })
  assert.equal(summary.breakdown.models.length, 2)
  const official = summary.breakdown.models.find((row) => row.providerId === 'deepseek-official')
  const relay = summary.breakdown.models.find((row) => row.providerId === 'openrouter')
  assert.equal(official.priced, true)
  assert.equal(relay.priced, false)
  assert.equal(relay.cost, 0)
  assert.deepEqual(summary.cost.unpricedModels, ['openrouter:deepseek-flash'])
})

test('旧 unknown 行在 provider 唯一时归因', () => {
  const state = emptyState()
  const now = Date.UTC(2026, 9, 30, 2, 0, 0)
  addRecord(state, { ts: now, provider: 'unknown', model: 'deepseek-flash', input: 10_000, output: 1_000 })
  const row = state.days['2026-10-30'].providers.unknown.models['deepseek-flash']
  row.cost = 0.04
  row.priced = true
  reattributeUnknown(
    state,
    new Map([['deepseek-flash', new Set(['deepseek-account'])]]),
  )
  assert.equal(state.days['2026-10-30'].providers.unknown, undefined)
  assert.equal(state.days['2026-10-30'].providers['deepseek-official'].models['deepseek-flash'].cost, 0.04)
})

test('provider 归一化与展示名', () => {
  assert.equal(normalizeProvider('deepseek-account'), 'deepseek-official')
  assert.equal(normalizeProvider('glm'), 'zhipu')
  assert.equal(providerLabel('zhipu'), 'Zhipu AI')
  assert.equal(displayModel('glm-5.3'), 'GLM-5.3')
})

test('#44 已配置 provider 无消耗时补默认模型行（配置即可见）', () => {
  const now = new Date(2026, 10, 1, 12, 0, 0).getTime()
  // 已配置 DeepSeek（providerInfo），本月零消耗 → 补 deepseek-v4.1-flash 0 值行
  const summary = buildSummary(emptyState(), { budgets: {} }, now, [
    { id: 'deepseek-official', kind: 'api', currency: 'CNY' },
  ])
  const row = summary.breakdown.models.find((item) => item.modelId === 'deepseek-v4.1-flash')
  assert.notEqual(row, undefined)
  assert.equal(row.providerId, 'deepseek-official')
  assert.equal(row.cost, 0)
  assert.equal(row.requests, 0)
  // 有真实消耗行时不重复补（同模型去重）
  const state = emptyState()
  addRecord(state, { ts: now, provider: 'deepseek-account', model: 'deepseek-v4.1-flash', input: 100, cacheRead: 0, cacheWrite: 0, output: 1 })
  const summary2 = buildSummary(state, { budgets: {} }, now, [
    { id: 'deepseek-official', kind: 'api', currency: 'CNY' },
  ])
  assert.equal(summary2.breakdown.models.filter((item) => item.modelId === 'deepseek-v4.1-flash').length, 1)
  assert.equal(summary2.breakdown.models[0].requests, 1)
  // 未配置（providerInfo 空）→ 无补行
  const summary3 = buildSummary(emptyState(), { budgets: {} }, now, [])
  assert.deepEqual(summary3.breakdown.models, [])
})

test('repriceState 用日级 token 重算旧成本', () => {
  const state = emptyState()
  state.costVersion = 1
  state.days['2026-11-02'] = {
    providers: {
      'deepseek-official': { models: { 'deepseek-flash': { input: 1_000_000, cacheRead: 0, cacheWrite: 0, output: 0, requests: 1, cost: 0, priced: true } } },
      unknown: { models: { 'deepseek-flash': { input: 1_000_000, cacheRead: 0, cacheWrite: 0, output: 0, requests: 1, cost: 0, priced: true } } },
    },
  }
  const result = repriceState(state)
  assert.equal(result.repriced, true)
  assert.equal(state.costVersion, 3)
  // 00:00 走 DeepSeek 闲时价：1M 输入 = 1
  assert.equal(state.days['2026-11-02'].providers['deepseek-official'].models['deepseek-flash'].cost, 1)
  // unknown 行按模型前缀归因后同样可计价
  assert.equal(state.days['2026-11-02'].providers.unknown.models['deepseek-flash'].cost, 1)
  assert.equal(repriceState(state).repriced, false)
})

test('#49 已有真实模型行时不再补默认行（不同 id、同展示名）', () => {
  const now = new Date(2026, 10, 2, 10, 0, 0).getTime()
  const state = emptyState()
  addRecord(state, { ts: now, provider: 'deepseek-account', model: 'deepseek-flash', input: 128_000, cacheRead: 1_000_000, cacheWrite: 0, output: 8_000 })
  const summary = buildSummary(state, { budgets: {} }, now, [
    { id: 'deepseek-official', kind: 'api', currency: 'CNY' },
  ])
  const rows = summary.breakdown.models.filter((item) => item.providerId === 'deepseek-official')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].modelId, 'deepseek-flash')
  assert.equal(rows[0].requests, 1)
  assert.equal(rows[0].displayName, 'DeepSeek-V4.1-Flash')
})

test('月汇总：预算、剩余、按模型请求数', () => {
  const state = emptyState()
  const now = new Date(2026, 9, 31, 12, 0, 0).getTime()
  addRecord(state, { ts: now, provider: 'zhipu', model: 'glm-5.3', input: 300_000, cacheRead: 600_000, cacheWrite: 0, output: 44_000 })
  addRecord(state, { ts: now, provider: 'deepseek-account', model: 'deepseek-v4.1-flash', input: 108_000, cacheRead: 200_000, cacheWrite: 0, output: 16_000 })
  const summary = buildSummary(state, { budget: { amount: 3500 }, showBalance: true }, now, {
    provider: 'unknown',
    amount: null,
    currency: 'CNY',
    status: 'unsupported',
    updatedAt: now,
  })
  assert.equal(summary.month, '2026-10')
  assert.equal(summary.requests.month, 2)
  assert.equal(summary.breakdown.models.length, 2)
  assert.equal(summary.breakdown.models[0].requests, 1)
  // 无单 budget/balance 字段；legacy prefs.budget 不参与计算，未配置时统一按默认 100
  assert.equal(summary.budget, undefined)
  assert.equal(summary.balance, undefined)
  const deepseek = summary.providers.find((item) => item.id === 'deepseek-official')
  assert.equal(deepseek.budget.amount, 100)
  assert.ok(deepseek.budget.used > 0)
  assert.ok(deepseek.budget.remaining < 100)
  const zhipu = summary.providers.find((item) => item.id === 'zhipu')
  // usage-only 的 zhipu（无订阅 info）按量处理：未配置预算时落到默认 100
  assert.equal(zhipu.budget.amount, 100)
  assert.equal(zhipu.canSubscribe, true)
  assert.equal(deepseek.canSubscribe, false)
  assert.equal(summary.tokens.total, 1_268_000)
  assert.equal(localDayKey(now), '2026-10-31')
})

test('hide 模式：provider 与模型行整体不出现在 VM', () => {
  const state = emptyState()
  const now = new Date(2026, 9, 31, 12, 0, 0).getTime()
  addRecord(state, { ts: now, provider: 'zhipu', model: 'glm-5.3', input: 300_000, cacheRead: 0, cacheWrite: 0, output: 44_000 })
  addRecord(state, { ts: now, provider: 'deepseek-account', model: 'deepseek-v4.1-flash', input: 108_000, cacheRead: 0, cacheWrite: 0, output: 16_000 })
  const providers = [
    { id: 'zhipu', kind: 'subscription', currency: 'CNY', windows: [{ key: '5h', usedPercent: 10 }] },
    { id: 'deepseek-official', kind: 'api', currency: 'CNY' },
  ]
  const summary = buildSummary(state, { billingModes: { zhipu: 'hide' } }, now, providers)
  assert.equal(summary.providers.some((item) => item.id === 'zhipu'), false)
  assert.equal(summary.breakdown.models.some((item) => item.providerId === 'zhipu'), false)
  assert.equal(summary.providers.length, 1)
})

test('provider 排序：当前 provider 置顶，其余按今日消耗降序', () => {
  const state = emptyState()
  const now = new Date(2026, 9, 31, 12, 0, 0).getTime()
  addRecord(state, { ts: now, provider: 'zhipu', model: 'glm-5.3', input: 900_000, cacheRead: 0, cacheWrite: 0, output: 44_000 })
  addRecord(state, { ts: now, provider: 'deepseek-account', model: 'deepseek-v4.1-flash', input: 100_000, cacheRead: 0, cacheWrite: 0, output: 16_000 })
  const summary = buildSummary(state, { budgets: {} }, now, [
    { id: 'zhipu', kind: 'subscription', currency: 'CNY', windows: [] },
    { id: 'deepseek-official', kind: 'api', currency: 'CNY' },
  ])
  // 最后一条消息 provider 是 deepseek-account（当前 provider），置顶；zhipu 今日消耗更高排第二
  assert.equal(summary.providers[0].id, 'deepseek-official')
  assert.equal(summary.providers[1].id, 'zhipu')
})

test('#41 unknown 行按模型名前缀归因（#42 本月口径：上月不显示）', () => {
  const state = emptyState()
  // 上月（10 月）unknown 数据：本月看板不显示（#42）
  const lastMonth = new Date(2026, 9, 30, 12, 0, 0).getTime()
  addRecord(state, { ts: lastMonth, provider: 'unknown', model: 'deepseek-flash', input: 500_000, cacheRead: 0, cacheWrite: 0, output: 10_000 })
  // 本月（11 月 1 日）unknown 数据：归因到 deepseek-official 后显示
  const now = new Date(2026, 10, 1, 12, 0, 0).getTime()
  addRecord(state, { ts: now, provider: 'unknown', model: 'deepseek-flash', input: 100_000, cacheRead: 0, cacheWrite: 0, output: 1_000 })
  const summary = buildSummary(state, { budgets: {} }, now, [])
  const rows = summary.breakdown.models.filter((item) => item.modelId === 'deepseek-flash')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].providerId, 'deepseek-official')
  assert.equal(rows[0].input, 100_000)
  const deepseek = summary.providers.find((item) => item.id === 'deepseek-official')
  assert.equal(deepseek.usage.todayTokens, 101_000)
  // 无前缀的 unknown 模型保持不可见
  addRecord(state, { ts: now, provider: 'unknown', model: 'mystery-model', input: 1000, cacheRead: 0, cacheWrite: 0, output: 1 })
  const summary2 = buildSummary(state, { budgets: {} }, now, [])
  assert.equal(summary2.breakdown.models.some((item) => item.modelId === 'mystery-model'), false)
})

test('预算：未配置默认 100，显式 0 才是未设置', () => {
  const now = new Date(2026, 10, 2, 12, 0, 0).getTime()
  const providers = [{ id: 'deepseek-official', kind: 'api', currency: 'CNY' }]
  const empty = buildSummary(emptyState(), { budgets: {} }, now, providers)
  assert.equal(empty.providers[0].budget.amount, 100)
  assert.equal(empty.providers[0].budget.state, 'ok')

  const explicit = buildSummary(emptyState(), { budgets: { 'deepseek-official': { amount: 0, currency: 'CNY' } } }, now, providers)
  assert.equal(explicit.providers[0].budget.amount, 0)
  assert.equal(explicit.providers[0].budget.state, 'unset')

  const configured = buildSummary(emptyState(), { budgets: { 'deepseek-official': { amount: 50, currency: 'CNY' } } }, now, providers)
  assert.equal(configured.providers[0].budget.amount, 50)
})

test('预算：legacy prefs.budget 不再参与计算', () => {
  const now = new Date(2026, 10, 2, 12, 0, 0).getTime()
  const summary = buildSummary(emptyState(), { budget: { amount: 3500, currency: 'CNY' } }, now, [
    { id: 'deepseek-official', kind: 'api', currency: 'CNY' },
  ])
  assert.equal(summary.providers[0].budget.amount, 100)
})

test('预算：币种以 provider 当前币种为准', () => {
  const now = new Date(2026, 10, 2, 12, 0, 0).getTime()
  const summary = buildSummary(emptyState(), { budgets: { openrouter: { amount: 20, currency: 'USD' } } }, now, [
    { id: 'openrouter', kind: 'api', currency: 'CNY' },
  ])
  assert.equal(summary.providers[0].budget.currency, 'CNY')
})

test('kind 判定优先级：prefs > 快照 mode > providerKinds > 快照 kind', () => {
  const state = { providerKinds: { zhipu: 'subscription' } }
  const prefs = { billingModes: {} }
  assert.equal(resolveProviderKind(state, prefs, 'zhipu', { kind: 'api', mode: 'api' }), 'api')
  assert.equal(resolveProviderKind(state, { billingModes: { zhipu: 'api' } }, 'zhipu', { kind: 'subscription', mode: 'subscription' }), 'api')
  assert.equal(resolveProviderKind(state, prefs, 'zhipu', { kind: 'api', mode: 'unknown' }), 'subscription')
  assert.equal(resolveProviderKind({ providerKinds: {} }, prefs, 'zhipu', { kind: 'subscription', mode: 'unknown' }), 'subscription')
  assert.equal(resolveProviderKind({ providerKinds: {} }, prefs, 'deepseek-official', { kind: 'api', mode: 'unknown' }), 'api')
})

test('stampProviderKinds 只固化确定形态，unknown 不覆盖', () => {
  const state = emptyState()
  assert.equal(stampProviderKinds(state, [{ id: 'zhipu', mode: 'unknown' }]), false)
  assert.equal(state.providerKinds.zhipu, undefined)
  assert.equal(stampProviderKinds(state, [{ id: 'zhipu', mode: 'subscription' }]), true)
  assert.equal(state.providerKinds.zhipu, 'subscription')
  assert.equal(stampProviderKinds(state, [{ id: 'zhipu', mode: 'subscription' }]), false)
})
