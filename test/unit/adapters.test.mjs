import test from 'node:test'
import assert from 'node:assert/strict'
import { logAdapterEvents, logAdapterFailures, parseGlmQuota, parseKimiQuota, parseOpenRouterCredits, readProviders, readSubscriptions, toSnapshot } from '../../src/adapters.js'
import { parseCommandCodeCredits, parseOpenCodeUsage } from '../../src/quota-sources.js'
import { emptyState, stampProviderKinds } from '../../src/core.js'

test('GLM parses TOKENS_LIMIT unit 3/6 and ignores TIME_LIMIT', () => {
  const windows = parseGlmQuota({
    success: true,
    data: {
      limits: [
        { type: 'TOKENS_LIMIT', unit: 3, percentage: 42.5, nextResetTime: 100 },
        { type: 'TOKENS_LIMIT', unit: 6, percentage: 18.2, nextResetTime: 200 },
        { type: 'TIME_LIMIT', percentage: 99 },
      ],
    },
  })
  assert.deepEqual(windows.map((item) => [item.key, item.usedPercent]), [['5h', 42.5], ['week', 18.2]])
})

test('GLM empty/malformed returns no windows', () => {
  assert.deepEqual(parseGlmQuota({ data: { limits: [] } }), [])
  assert.deepEqual(parseGlmQuota({ data: { limits: [{ type: 'TOKENS_LIMIT', unit: 3 }] } }), [])
})

test('Kimi current usages and legacy limits', () => {
  const current = parseKimiQuota({ data: { usages: { limit_5h: { used_ratio: 30, reset_time: 1 }, limit_month_code: { used_ratio: 12, reset_time: 2 } }, usage: { used_ratio: 18, reset_time: 3 } } })
  assert.deepEqual(current.map((item) => [item.key, item.usedPercent]), [['5h', 30], ['month', 12], ['week', 18]])
  const legacy = parseKimiQuota({ limits: [{ detail: { limit: 100, remaining: 70, resetTime: 10 } }, { detail: { limit: 100, remaining: 60, resetTime: 20 } }], usage: { limit: 100, used: 18, resetTime: 30 } })
  assert.equal(legacy.find((item) => item.key === '5h').usedPercent, 40)
  assert.equal(legacy.find((item) => item.key === 'week').usedPercent, 18)
})

test('OpenRouter credits', () => {
  const parsed = parseOpenRouterCredits({ data: { total_credits: 50, total_usage: 12.5 } })
  assert.equal(parsed.amount, 37.5)
  assert.equal(parsed.currency, 'USD')
  assert.equal(parsed.status, 'ok')
  assert.equal(parseOpenRouterCredits({ data: { total_credits: 50 } }), null)
})

function ctxWith(keys = {}) {
  return {
    get(name) {
      if (name === 'credentials') {
        return { resolve: async (keyName) => (keys[keyName] !== undefined ? { value: keys[keyName] } : undefined) }
      }
      return undefined
    },
  }
}

function mockFetch(handler) {
  const original = globalThis.fetch
  globalThis.fetch = async (url, init) => handler(String(url), init)
  return () => {
    globalThis.fetch = original
  }
}

test('手动订阅模式：GLM quota 401 保留订阅卡（套餐查询失败）', async () => {
  const restore = mockFetch(async () => ({ ok: false, status: 401, json: async () => null }))
  try {
    const providers = await readProviders(ctxWith({ ZHIPU_API_KEY: 'sk-test' }), { billingModes: { zhipu: 'subscription' } })
    const zhipu = providers.find((item) => item.id === 'zhipu')
    assert.equal(zhipu.kind, 'subscription')
    assert.equal(zhipu.name, 'GLM Coding')
    assert.deepEqual(zhipu.windows, [])
  } finally {
    restore()
  }
})

test('手动订阅模式：Kimi coding quota 失败保留订阅卡', async () => {
  const restore = mockFetch(async () => ({ ok: false, status: 500, json: async () => null }))
  try {
    const providers = await readProviders(ctxWith({ KIMI_API_KEY: 'sk-test' }), { billingModes: { moonshot: 'subscription' } })
    const moonshot = providers.find((item) => item.id === 'moonshot')
    assert.equal(moonshot.kind, 'subscription')
    assert.equal(moonshot.name, 'Kimi Coding')
    assert.deepEqual(moonshot.windows, [])
  } finally {
    restore()
  }
})

test('hide 模式过滤；showBalance=false 仍请求余额（#31：开关只控制 P1）', async () => {
  const fetched = []
  const restore = mockFetch(async (url) => {
    fetched.push(url)
    return { ok: false, status: 404, json: async () => null }
  })
  try {
    const providers = await readProviders(ctxWith({ DEEPSEEK_API_KEY: 'sk-test', ZHIPU_API_KEY: 'sk-test' }), {
      showBalance: false,
      billingModes: { zhipu: 'hide' },
    })
    assert.equal(providers.find((item) => item.id === 'zhipu'), undefined)
    const deepseek = providers.find((item) => item.id === 'deepseek-official')
    assert.notEqual(deepseek.balance, undefined)
    assert.equal(fetched.some((url) => url.includes('user/balance')), true)
  } finally {
    restore()
  }
})

test('readProviders 空结果附带 misses，区分未配置与隐藏', async () => {
  const none = await readProviders(ctxWith({}), {})
  assert.equal(none.length, 0)
  assert.deepEqual(none.misses, [
    'deepseek-official:none',
    'zhipu:none',
    'moonshot:none',
    'openrouter:none',
    'qwen:none',
    'opencode-go:none',
    'command-code:none',
    'ollama:none',
  ])
  const hidden = await readProviders(ctxWith({ DASHSCOPE_API_KEY: 'sk-test' }), { billingModes: { qwen: 'hide' } })
  assert.equal(hidden.misses.includes('qwen:hidden'), true)
})

test('OpenCode 与 Command Code 解析窗口/credits', () => {
  const opencode = parseOpenCodeUsage({
    data: { usage: { fiveHour: { usedPercent: 12 }, weekly: { used_ratio: 0.34 }, monthly: { used: 58, limit: 100 } } },
  })
  assert.deepEqual(opencode.map((item) => [item.key, item.usedPercent]), [['5h', 12], ['week', 34], ['month', 58]])
  const command = parseCommandCodeCredits({
    data: { credits: 12.5, windowLimits: { fiveHour: { usedPercent: 96 }, weekly: { used: 61, limit: 100 } } },
  })
  assert.deepEqual(command.windows.map((item) => [item.key, item.usedPercent]), [['5h', 96], ['week', 61]])
  assert.equal(command.balance.amount, 12.5)
  assert.equal(command.balance.currency, 'CNY')
})

test('readProviders 接入 OpenCode 与 Command Code，并按源缓存', async () => {
  let calls = 0
  const urls = []
  const restore = mockFetch(async (url) => {
    calls += 1
    urls.push(url)
    if (url.includes('opencode.ai')) {
      return { ok: true, status: 200, json: async () => ({ data: { usage: { fiveHour: { usedPercent: 12 } } } }) }
    }
    return { ok: true, status: 200, json: async () => ({ data: { credits: 12.5, windowLimits: { fiveHour: { usedPercent: 96 } } } }) }
  })
  try {
    const cache = new Map()
    const prefs = {}
    const ctx = ctxWith({ OPENCODE_GO_API_KEY: 'sk-test', COMMAND_CODE_API_KEY: 'sk-test', COMMAND_CODE_ORG_ID: 'org-1' })
    const first = await readProviders(ctx, prefs, cache)
    const second = await readProviders(ctx, prefs, cache)
    assert.equal(calls, 2)
    const opencode = first.find((item) => item.id === 'opencode-go')
    const command = first.find((item) => item.id === 'command-code')
    assert.equal(opencode.currency, 'USD')
    assert.equal(opencode.windows[0].usedPercent, 12)
    assert.equal(command.currency, 'CNY')
    assert.equal(command.windows[0].usedPercent, 96)
    assert.equal(command.balance.amount, 12.5)
    assert.equal(urls.some((url) => url.includes('orgId=org-1')), true)
    assert.deepEqual(second.map((item) => item.id), first.map((item) => item.id))
  } finally {
    restore()
  }
})

test('logAdapterFailures 把源级异常映射到 adapter.<id> detect.fail', () => {
  const events = []
  const log = { info: () => {}, warn: (module, event, meta) => events.push([module, event, meta]) }
  logAdapterFailures(log, [
    { id: 'opencode-go', error: { kind: 'network' } },
    { id: 'command-code', error: { kind: 'http', status: 503, upstream: true } },
  ])
  assert.deepEqual(events, [
    ['adapter.opencode', 'detect.fail', { errorKind: 'network' }],
    ['adapter.commandcode', 'detect.fail', { errorKind: 'http', httpStatus: 503, upstream: true }],
  ])
})

test('Qwen 国际站 Key 按 USD，国内站按 CNY', async () => {
  const intl = await readProviders(ctxWith({ DASHSCOPE_INTL_API_KEY: 'sk-test' }), {})
  assert.equal(intl.find((item) => item.id === 'qwen').currency, 'USD')
  const domestic = await readProviders(ctxWith({ DASHSCOPE_API_KEY: 'sk-test' }), {})
  assert.equal(domestic.find((item) => item.id === 'qwen').currency, 'CNY')
})

test('toSnapshot 统一 windows/error/status，不泄漏旧字段', () => {
  const snap = toSnapshot({
    id: 'zhipu',
    kind: 'subscription',
    currency: 'CNY',
    plans: [{ key: '5h' }],
    _quotaError: { kind: 'parse' },
  })
  assert.deepEqual(snap.windows, [{ key: '5h' }])
  assert.equal(snap.quotaError.kind, 'parse')
  assert.equal(snap.status, 'ok')
  assert.equal('plans' in snap, false)
  assert.equal('_quotaError' in snap, false)
  const failed = toSnapshot({ id: 'deepseek-official', kind: 'api', currency: 'CNY', _error: { kind: 'http', status: 500 }, balance: { status: 'error' } })
  assert.equal(failed.status, 'error')
  assert.deepEqual(failed.error, { kind: 'http', status: 500 })
  assert.equal('_error' in failed, false)
})

test('#46 logAdapterEvents 按 §2.5 事件表映射侦测结果', () => {
  const events = []
  const log = { info: (module, event, meta) => events.push([module, event, meta]) }
  logAdapterEvents(log, [
    { id: 'deepseek-official', kind: 'api', currency: 'CNY', balance: { status: 'ok', amount: 49.86 } },
    { id: 'deepseek-official', kind: 'api', currency: 'CNY', balance: { status: 'unconfigured' } },
    { id: 'zhipu', kind: 'subscription', currency: 'CNY', plans: [{ key: '5h' }, { key: 'week' }] },
    { id: 'zhipu', kind: 'subscription', currency: 'CNY', plans: [] },
    { id: 'moonshot', kind: 'subscription', currency: 'CNY', plans: [{ key: '5h' }] },
    { id: 'moonshot', kind: 'api', currency: 'CNY', balance: { status: 'ok', amount: 8.5 } },
    { id: 'openrouter', kind: 'api', currency: 'USD', balance: { status: 'ok', amount: 7.66 } },
    { id: 'qwen', kind: 'api', currency: 'USD' },
  ].map(toSnapshot))
  assert.deepEqual(events.map(([m, e]) => `${m} ${e}`), [
    'adapter.deepseek balance.ok',
    'adapter.deepseek balance.auth',
    'adapter.glm quota.ok',
    'adapter.glm quota.fail',
    'adapter.kimi quota.ok',
    'adapter.kimi quota.miss',
    'adapter.kimi balance.ok',
    'adapter.openrouter credits.ok',
    'adapter.qwen currency.usd',
  ])
  assert.equal(events[2][2].windows, 2)
})

test('#47 错误链路日志：错误分类与 quota.parse 还原原因', () => {
  const events = []
  const log = { info: (module, event, meta) => events.push([module, event, meta]) }
  logAdapterEvents(log, [
    { id: 'deepseek-official', kind: 'api', currency: 'CNY', _error: { kind: 'http', status: 500 }, balance: { status: 'error' } },
    { id: 'deepseek-official', kind: 'api', currency: 'CNY', _error: { kind: 'timeout' }, balance: { status: 'unconfigured' } },
    { id: 'zhipu', kind: 'subscription', currency: 'CNY', plans: [], _quotaError: { kind: 'parse' } },
    { id: 'zhipu', kind: 'api', currency: 'CNY', _quotaError: { kind: 'http', status: 401 } },
    { id: 'moonshot', kind: 'api', currency: 'CNY', _error: { kind: 'network' }, balance: { status: 'error' } },
  ].map(toSnapshot))
  assert.deepEqual(events.map(([m, e]) => `${m} ${e}`), [
    'adapter.deepseek balance.error',
    'adapter.deepseek balance.auth',
    'adapter.glm quota.parse',
    'adapter.glm quota.fail',
    'adapter.kimi quota.miss',
    'adapter.kimi balance.error',
  ])
  assert.equal(events[0][2].errorKind, 'http')
  assert.equal(events[0][2].httpStatus, 500)
  assert.equal(events[1][2].errorKind, 'timeout')
  assert.equal(events[3][2].errorKind, 'http')
  assert.equal(events[3][2].httpStatus, 401)
  assert.equal(events[5][2].errorKind, 'network')
})

test('readSubscriptions 只重查订阅配额，不请求余额', async () => {
  const fetched = []
  const restore = mockFetch(async (url) => {
    fetched.push(url)
    return { ok: false, status: 500, json: async () => null }
  })
  try {
    const subs = await readSubscriptions(ctxWith({ ZHIPU_API_KEY: 'sk-test', KIMI_API_KEY: 'sk-test', MOONSHOT_API_KEY: 'sk-test' }), {})
    assert.deepEqual(subs.map((item) => item.id), ['zhipu', 'moonshot'])
    // Kimi 自动模式下 quota 失败：回落按量条目，但不查 moonshot 余额
    assert.equal(subs.find((item) => item.id === 'moonshot').kind, 'api')
    assert.equal(fetched.some((url) => url.includes('users/me/balance')), false)
  } finally {
    restore()
  }
})

test('Ollama：金额态快照带 purchased / channel，形态为 api', async () => {
  const restore = mockFetch(async (url) => {
    if (url.includes('/api/usage')) {
      return { ok: true, status: 200, json: async () => ({ range: '30d', totals: { request_count: 3, usage_usd: 0.17, input_tokens: 1200, cached_input_tokens: 200, output_tokens: 300 } }) }
    }
    return { ok: true, status: 200, json: async () => ({ included: { balance_usd: 72.5, allowance_usd: 100 }, purchased: { balance_usd: 25 } }) }
  })
  try {
    const providers = await readProviders(ctxWith({ OLLAMA_API_KEY: 'sk-test' }), {})
    const ollama = providers.find((item) => item.id === 'ollama')
    assert.equal(ollama.kind, 'api')
    assert.equal(ollama.mode, 'api')
    assert.equal(ollama.currency, 'USD')
    assert.equal(ollama.balance.amount, 97.5)
    assert.equal(ollama.balance.allowance, 100)
    assert.equal(ollama.balance.used, 27.5)
    assert.equal(ollama.balance.purchased, 25)
    assert.equal(ollama.channel.usageUsd, 0.17)
    assert.equal(ollama.rateLimited, false)
    // 形态不被固化成订阅：固化的只能是 api
    const state = emptyState()
    assert.equal(stampProviderKinds(state, providers), true)
    assert.equal(state.providerKinds.ollama, 'api')
  } finally {
    restore()
  }
})

test('Ollama：401 记未配置，403 / 503 记错误', async () => {
  for (const [status, expected] of [[401, 'unconfigured'], [403, 'error'], [503, 'error']]) {
    const restore = mockFetch(async () => ({ ok: false, status, json: async () => ({ error: 'x' }) }))
    try {
      const providers = await readProviders(ctxWith({ OLLAMA_API_KEY: 'sk-test' }), {})
      const ollama = providers.find((item) => item.id === 'ollama')
      assert.equal(ollama.balance.status, expected)
      assert.equal(ollama.balance.amount, null)
      assert.deepEqual(ollama.windows, [])
    } finally {
      restore()
    }
  }
})

test('Ollama：429 复用旧快照并按 Retry-After 退避', async () => {
  let calls = 0
  const restore = mockFetch(async (url) => {
    if (url.includes('/api/usage')) {
      return { ok: true, status: 200, json: async () => ({ range: '30d', totals: { usage_usd: 0.17 } }) }
    }
    calls += 1
    if (calls === 1) {
      return { ok: true, status: 200, json: async () => ({ included: { balance_usd: 72.5, allowance_usd: 100 }, purchased: { balance_usd: 25 } }) }
    }
    return {
      ok: false,
      status: 429,
      headers: { get: (name) => (String(name).toLowerCase() === 'retry-after' ? '30' : null) },
      json: async () => ({ error: 'too many requests' }),
    }
  })
  try {
    const cache = new Map()
    const ctx = ctxWith({ OLLAMA_API_KEY: 'sk-test' })
    const first = await readProviders(ctx, {}, cache)
    assert.equal(first.find((item) => item.id === 'ollama').balance.amount, 97.5)
    cache.set('ollama', { ...cache.get('ollama'), until: Date.now() - 1 })
    const second = await readProviders(ctx, {}, cache)
    const stale = second.find((item) => item.id === 'ollama')
    assert.equal(stale.rateLimited, true)
    assert.equal(stale.balance.amount, 97.5)
    assert.equal(stale.quotaError.status, 429)
    assert.equal(stale.quotaError.retryAfter, 30)
    assert.ok(cache.get('ollama').until - Date.now() > 20_000)
  } finally {
    restore()
  }
})
