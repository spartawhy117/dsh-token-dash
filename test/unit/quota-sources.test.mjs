import test from 'node:test'
import assert from 'node:assert/strict'
import { parseOllamaBalance, parseOllamaUsage, PROVIDER_SOURCES } from '../../src/quota-sources.js'

test('Ollama 金额态：amount 为合计，used 只算套餐进度', () => {
  const parsed = parseOllamaBalance({
    included: {
      balance_usd: 72.5,
      allowance_usd: 100,
      period: { from: '2026-09-15T09:30:00Z', until: '2026-10-15T09:30:00Z' },
    },
    purchased: { balance_usd: 25 },
  })
  assert.deepEqual(parsed.windows, [])
  assert.equal(parsed.balance.amount, 97.5)
  assert.equal(parsed.balance.packageLeft, 72.5)
  assert.equal(parsed.balance.allowance, 100)
  assert.equal(parsed.balance.used, 27.5)
  assert.equal(parsed.balance.purchased, 25)
  assert.equal(parsed.balance.periodEnd, Date.parse('2026-10-15T09:30:00Z'))
  assert.equal(parsed.balance.status, 'ok')
  assert.equal(parsed.balance.currency, 'USD')
})

test('Ollama 旧套餐态：session/weekly 转百分比，amount 取 purchased', () => {
  const parsed = parseOllamaBalance({
    included: {
      session: { remaining_percent: 75, resets_at: '2026-10-01T07:00:00Z' },
      weekly: { remaining_percent: 40, resets_at: '2026-10-05T00:00:00Z' },
    },
    purchased: { balance_usd: 25 },
  })
  assert.deepEqual(parsed.windows.map((item) => [item.key, item.usedPercent]), [['session', 25], ['week', 60]])
  assert.equal(parsed.windows[0].resetAt, Date.parse('2026-10-01T07:00:00Z'))
  assert.equal(parsed.balance.legacy, true)
  assert.equal(parsed.balance.amount, 25)
  assert.equal(parsed.balance.allowance, undefined)
})

test('Ollama 两态都缺：返回 error，不伪造 0', () => {
  for (const body of [{}, { included: {} }, { included: { balance_usd: 1 } }, null]) {
    const parsed = parseOllamaBalance(body)
    assert.equal(parsed.balance.status, 'error')
    assert.equal(parsed.balance.amount, null)
    assert.equal(parsed.balance._error.kind, 'parse')
  }
})

test('Ollama usage：只取 totals，缺失返回空对象', () => {
  const parsed = parseOllamaUsage({
    range: '30d',
    totals: {
      request_count: 3,
      usage_usd: 0.01718,
      input_tokens: 1200,
      cached_input_tokens: 200,
      output_tokens: 300,
    },
  })
  assert.equal(parsed.channel.range, '30d')
  assert.equal(parsed.channel.usageUsd, 0.01718)
  assert.equal(parsed.channel.requests, 3)
  assert.equal(parsed.channel.inputTokens, 1200)
  assert.equal(parsed.channel.cachedInputTokens, 200)
  assert.equal(parsed.channel.outputTokens, 300)
  assert.deepEqual(parseOllamaUsage({}), {})
  assert.deepEqual(parseOllamaUsage(null), {})
})

test('源表：ollama 声明 api / USD / bearer，且带 usage 钩子', () => {
  const ollama = PROVIDER_SOURCES.find((source) => source.id === 'ollama')
  assert.equal(ollama.kind, 'api')
  assert.equal(ollama.currency, 'USD')
  assert.deepEqual(ollama.credential, { type: 'bearer', refs: ['OLLAMA_API_KEY'] })
  assert.equal(ollama.quota.url, 'https://ollama.com/api/balance')
  assert.equal(ollama.usage.range, '30d')
  assert.equal(ollama.usage.url, 'https://ollama.com/api/usage')
})
