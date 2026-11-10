import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { COST_MODEL_VERSION, loadPrefs, loadState, recoverState, saveJson, saveMonths } from '../../src/store.js'

function row(input, output, requests) {
  return { input, cacheRead: 0, cacheWrite: 0, output, requests, cost: 0, priced: true }
}

test('recoverState 合并 1.0.3 备份并标记已消费', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'td-store-'))
  try {
    await saveJson(dir, 'daily.json', {
      version: 1,
      costVersion: 2,
      days: {
        '2026-11-02': {
          providers: { 'deepseek-official': { models: { 'deepseek-flash': row(2000, 200, 9) } } },
        },
      },
      watermarks: { s1: 100 },
      headers: { s1: { provider: 'deepseek-account', model: 'deepseek-flash' } },
      currentProvider: 'deepseek-official',
    })
    const backupName = 'daily.json.pre-v2-1793552377294.bak'
    await saveJson(dir, backupName, {
      version: 1,
      days: {
        '2026-11-01': {
          providers: { 'deepseek-official': { models: { 'deepseek-flash': row(1000, 100, 150) } } },
        },
        '2026-11-02': {
          providers: { 'deepseek-official': { models: { 'deepseek-flash': row(5000, 500, 255) } } },
        },
      },
      watermarks: { s1: 90 },
    })
    const state = await loadState(dir)
    const result = await recoverState(dir, state)
    assert.equal(result.recovered, true)
    assert.equal(state.costVersion, 1)
    assert.equal(state.days['2026-11-01'] !== undefined, true)
    assert.equal(state.days['2026-11-02'].providers['deepseek-official'].models['deepseek-flash'].requests, 264)
    assert.equal(state.watermarks.s1, 100)
    assert.equal(existsSync(join(dir, backupName)), false)
    assert.equal(existsSync(join(dir, `${backupName}.merged`)), true)
    const again = await recoverState(dir, state)
    assert.equal(again.recovered, false)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('月度账本可在 daily.json 缺失时恢复本月数据', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'td-store-'))
  try {
    await saveJson(dir, 'daily.json', { version: 1, costVersion: 2, days: {}, watermarks: {}, headers: {}, currentProvider: null })
    await saveMonths(dir, {
      costVersion: 1,
      days: {
        '2026-11-01': {
          providers: { 'deepseek-official': { models: { 'deepseek-flash': row(1000, 100, 1) } } },
        },
      },
    })
    assert.equal(existsSync(join(dir, 'months', '2026-11.json')), true)
    const state = await loadState(dir)
    assert.equal(state.days['2026-11-01'] !== undefined, true)
    // 账本为旧计价模型：触发一次重算
    assert.equal(state.costVersion, 1)
    assert.equal(state.costVersion < COST_MODEL_VERSION, true)
    const payload = JSON.parse(await readFile(join(dir, 'months', '2026-11.json'), 'utf8'))
    assert.equal(payload.month, '2026-11')
    assert.equal(payload.days['2026-11-01'] !== undefined, true)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('loadPrefs 白名单：丢弃 legacy budget / 已删字段 / 未知键', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'td-store-'))
  try {
    await saveJson(dir, 'prefs.json', {
      version: 1,
      budget: { amount: 3500, currency: 'CNY' },
      budgets: { 'deepseek-official': { amount: 20, currency: 'CNY' } },
      billingModes: { zhipu: 'subscription' },
      refreshMs: 60000,
      showBalance: false,
      showMonthTokens: true,
      logLevel: 'debug',
      unknownKey: 1,
    })
    const prefs = await loadPrefs(dir)
    assert.equal('budget' in prefs, false)
    assert.equal('showMonthTokens' in prefs, false)
    assert.equal('logLevel' in prefs, false)
    assert.equal('unknownKey' in prefs, false)
    assert.equal(prefs.budgets['deepseek-official'].amount, 20)
    assert.equal(prefs.billingModes.zhipu, 'subscription')
    assert.equal(prefs.showBalance, false)
    assert.equal(prefs.version, 1)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('loadPrefs 归一非法 refreshMs 并记 warn', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'td-store-'))
  try {
    await saveJson(dir, 'prefs.json', { version: 1, budgets: {}, billingModes: {}, refreshMs: 120000, showBalance: true })
    const warns = []
    const logger = { warn: (module, event, fields) => warns.push({ module, event, fields }), info: () => {} }
    const prefs = await loadPrefs(dir, logger)
    assert.equal(prefs.refreshMs, 60000)
    assert.equal(warns[0].event, 'prefs.normalize')
    assert.equal(warns[0].fields.field, 'refreshMs')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('loadPrefs 收编 priceOverrides / providerCurrency 并归一非法条目', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'td-store-'))
  try {
    await saveJson(dir, 'prefs.json', {
      version: 1,
      budgets: {},
      billingModes: {},
      refreshMs: 60000,
      showBalance: true,
      priceOverrides: {
        'tencent:DeepSeek-V4.1-Flash-IOA': { input: 2, output: 8, currency: 'USD' },
        'my-private-model': { input: 'x', output: 1 },
        'no-output': { input: 1 },
      },
      providerCurrency: { GLM: 'USD', tencent: 'CNY', broken: 'EUR' },
    })
    const prefs = await loadPrefs(dir)
    assert.deepEqual(Object.keys(prefs.priceOverrides), ['tencent:deepseek-v4.1-flash-ioa'])
    assert.equal(prefs.priceOverrides['tencent:deepseek-v4.1-flash-ioa'].input, 2)
    assert.equal(prefs.priceOverrides['tencent:deepseek-v4.1-flash-ioa'].currency, 'USD')
    assert.deepEqual(prefs.providerCurrency, { zhipu: 'USD', tencent: 'CNY' })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('loadState 为旧 daily.json 补齐 providerKinds', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'td-store-'))
  try {
    await saveJson(dir, 'daily.json', {
      version: 1,
      costVersion: COST_MODEL_VERSION,
      days: {},
      watermarks: {},
      headers: {},
      currentProvider: null,
    })
    const state = await loadState(dir)
    assert.deepEqual(state.providerKinds, {})
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
