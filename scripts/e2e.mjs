/**
 * L2 + L3 E2E: temporary DSH_HOME + web profile, API assertions and Playwright UI.
 * Usage: node scripts/e2e.mjs [--keep]
 */
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright'
import { zstdCompressSync } from 'node:zlib'
import { resolvePrice } from '../src/pricing.js'

const root = resolve('.')
const PKG_VERSION = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version
const keep = process.argv.includes('--keep')
const tmpRoot = join(root, '.tmp')
const home = join(tmpRoot, `e2e-home-${Date.now()}`)
const appRoot = process.env.DSH_APP_ROOT ?? join(process.env.LOCALAPPDATA ?? '', 'Programs', 'DeepSeek Harness')
const exe = join(appRoot, 'DeepSeek Harness.exe')
const cliJs = join(appRoot, 'resources', 'app.asar', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-desktop-host', 'lib', 'cli.js')
mkdirSync(home, { recursive: true })
assert.ok(existsSync(exe), `DSH executable not found: ${exe} (set DSH_APP_ROOT)`)

const nodeEnv = (env) => ({ ...env, ELECTRON_RUN_AS_NODE: '1' })
function run(args, env) {
  return execFileSync(exe, ['--expose-internals', cliJs, ...args], { env: nodeEnv(env), encoding: 'utf8' })
}
function startWeb(env) {
  const child = spawn(exe, ['--expose-internals', cliJs, '--profile', 'web', '--port', '0', '--no-open'], { env: nodeEnv(env), windowsHide: true })
  let log = ''
  const ready = new Promise((resolveReady, reject) => {
    const timer = setTimeout(() => reject(new Error(`web start timeout:\n${log}`)), 30000)
    const onData = (chunk) => {
      log += chunk.toString()
      const match = log.match(/http:\/\/127\.0\.0\.1:(\d+)\/\?token=([^\s]+)/)
      if (match) { clearTimeout(timer); resolveReady({ base: `http://127.0.0.1:${match[1]}`, token: match[2] }) }
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.on('exit', (code) => { if (!log.includes('http://127.0.0.1')) reject(new Error(`web exited ${code}:\n${log}`)) })
  })
  return { child, ready, log: () => log }
}
function resolveChromium() {
  const fromEnv = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
  if (typeof fromEnv === 'string' && fromEnv !== '' && existsSync(fromEnv)) return fromEnv
  try {
    const bundled = chromium.executablePath()
    if (existsSync(bundled)) return bundled
  } catch { /* fall through */ }
  const base = join(process.env.LOCALAPPDATA ?? '', 'ms-playwright')
  if (!existsSync(base)) return undefined
  return readdirSync(base)
    .filter((name) => /^chromium-\d+$/.test(name))
    .sort((left, right) => Number(right.split('-')[1]) - Number(left.split('-')[1]))
    .map((name) => join(base, name, 'chrome-win64', 'chrome.exe'))
    .find((candidate) => existsSync(candidate))
}
function stopTree(child) {
  if (child?.pid === undefined) return
  try { execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' }) } catch { child.kill() }
}
const now = Date.now()
const budget = (amount, currency, used, percent) => ({ amount, used, remaining: Math.max(0, amount - used), percent, state: percent >= 1 ? 'over' : percent >= 0.8 ? 'warn' : 'ok', currency })
const provider = (id, name, kind, currency, extra = {}) => ({
  id, name, kind, currency, canSubscribe: id === 'zhipu' || id === 'moonshot',
  usage: { todayTokens: 12_000, monthTokens: 1_280_000, todayCost: 0.04, monthCost: 12.34, requests: 12 },
  ...extra,
})
const apiProviders = [
  provider('deepseek-official', 'DeepSeek', 'api', 'CNY', { currencySource: 'snapshot', budget: budget(100, 'CNY', 12.34, 0.1234), balance: { amount: 49.86, status: 'ok', currency: 'CNY', updatedAt: now } }),
  provider('openrouter', 'OpenRouter', 'api', 'USD', { currencySource: 'snapshot', budget: budget(50, 'USD', 19, 0.38), balance: { amount: 7.66, status: 'ok', currency: 'USD', updatedAt: now } }),
  // 未声明币种的自填 provider：卡片应标「按社区表 CNY」
  provider('siliconflow', 'siliconflow', 'api', 'CNY', { currencySource: 'community', budget: budget(100, 'CNY', 1.24, 0.0124) }),
  // 额度 + 购买余额 + 周期 + 渠道用量；速率限制时保留旧值并标「限流中」
  provider('ollama', 'Ollama', 'api', 'USD', {
    currencySource: 'snapshot',
    rateLimited: true,
    budget: budget(100, 'USD', 31.2, 0.312),
    balance: {
      amount: 97.5, packageLeft: 72.5, allowance: 100, used: 27.5, purchased: 25,
      periodEnd: now + 3 * 86400_000, status: 'ok', currency: 'USD', updatedAt: now,
    },
    channel: { range: '30d', usageUsd: 0.17, requests: 3, inputTokens: 1200, cachedInputTokens: 200, outputTokens: 300 },
  }),
]
const subProviders = [
  provider('zhipu', 'GLM Coding', 'subscription', 'CNY', { windows: [{ key: '5h', usedPercent: 42.5, resetAt: now + 3600_000 }, { key: 'week', usedPercent: 18.2, resetAt: now + 26 * 3600_000 }] }),
  provider('moonshot', 'Kimi Coding', 'subscription', 'CNY', { windows: [{ key: '5h', usedPercent: 96, resetAt: now + 600_000 }, { key: 'week', usedPercent: 12, resetAt: now + 26 * 3600_000 }] }),
  provider('opencode-go', 'OpenCode Go', 'subscription', 'USD', {
    usage: { todayTokens: 24_000, monthTokens: 480_000, todayCost: 0, monthCost: 0, requests: 22 },
    windows: [
      { key: '5h', usedPercent: 12, resetAt: now + 2 * 3600_000 },
      { key: 'week', usedPercent: 34, resetAt: now + 4 * 86400_000 },
      { key: 'month', usedPercent: 58, resetAt: now + 18 * 86400_000 },
    ],
  }),
]
const pricingLinks = [
  { id: 'deepseek-official', label: 'DeepSeek', url: 'https://api-docs.deepseek.com/quick_start/pricing' },
  { id: 'zhipu', label: '智谱 AI', url: 'https://docs.bigmodel.cn/cn/guide/start/pricing' },
  { id: 'moonshot', label: 'Kimi', url: 'https://platform.moonshot.cn/docs/pricing/chat' },
  { id: 'openrouter', label: 'OpenRouter', url: 'https://openrouter.ai/models' },
  { id: 'qwen', label: '通义千问', url: 'https://help.aliyun.com/zh/model-studio/billing-for-alibaba-cloud-model-studio' },
]
const model = (providerId, providerName, modelId, displayName, kind, currency, cost, extra = {}) => ({
  providerId, providerName, modelId, displayName, kind, currency, cost, priced: true,
  requests: 12, input: 100_000, cacheRead: 200_000, cacheWrite: 0, output: 20_000,
  tokens: { input: 100_000, cacheRead: 200_000, cacheWrite: 0, cache: 200_000, output: 20_000, total: 320_000 },
  hitRate: 200 / 300,
  ...extra,
})
const EMPTY_TOKENS = { input: 0, cacheRead: 0, cacheWrite: 0, cache: 0, output: 0, total: 0 }
const models = [
  model('deepseek-official', 'DeepSeek', 'deepseek-flash', 'DeepSeek-V4.1-Flash', 'api', 'CNY', 12.34),
  model('openrouter', 'OpenRouter', 'deepseek-flash', 'DeepSeek-V4.1-Flash', 'api', 'USD', 4.68),
  model('zhipu', 'GLM Coding', 'glm-5.3', 'GLM-5.3', 'subscription', 'CNY', 0, { estimatedCost: 3.42, estimatedPriced: true }),
  model('moonshot', 'Kimi Coding', 'kimi-k3', 'Kimi K3', 'subscription', 'CNY', 0, { estimatedCost: 1.08, estimatedPriced: true, approximate: true }),
  // 模糊命中：带 ≈ 前缀
  model('tencent', 'tencent', 'deepseek-v4.1-flash-ioa', 'deepseek-v4.1-flash', 'api', 'CNY', 1.24, { approximate: true }),
  // 精确命中：不带 ≈
  model('siliconflow', 'siliconflow', 'deepseek-v4.1-flash', 'deepseek-v4.1-flash', 'api', 'CNY', 1.24, { approximate: false }),
  // 未定价：显示"未定价" + reason tooltip
  model('my-relay', 'my-relay', 'my-private-model', 'my-private-model', 'api', 'CNY', 0, { priced: false, reason: 'no-model-price', requests: 1 }),
  // 零消耗：显示 —（不是 ¥0.00）
  model('tencent', 'tencent', 'deepseek-chat', 'deepseek-chat', 'api', 'CNY', 0, {
    priced: 'empty', requests: 0, input: 0, cacheRead: 0, cacheWrite: 0, output: 0,
    tokens: EMPTY_TOKENS, hitRate: null,
  }),
]
let currentSummary = {
  providers: [...apiProviders, ...subProviders],
  breakdown: { models },
  pricingLinks,
  catalog: { version: 1, updatedAt: '1793591115', source: 'community-gitee', url: 'https://gitee.com/oyw125/model-price-table' },
  showBalance: true,
  version: PKG_VERSION,
  refreshMs: 60000,
  currentProviderId: 'deepseek-official',
  updatedAt: now,
  stale: false,
}
const usageFor = (range) => ({
  range,
  startAt: now - 86400000,
  endAt: now,
  totals: {
    CNY: { cost: 12.34, requests: 12, input: 100_000, cacheRead: 200_000, cacheWrite: 0, output: 20_000, hitRate: 200 / 300 },
    USD: { cost: 4.68, requests: 12, input: 100_000, cacheRead: 200_000, cacheWrite: 0, output: 20_000, hitRate: 200 / 300 },
  },
  total: {
    tokens: 1_280_000,
    input: 400_000,
    cacheRead: 800_000,
    cacheWrite: 0,
    cache: 800_000,
    output: 80_000,
    requests: 48,
    hitRate: 2 / 3,
  },
  models,
  // 7 个日点，第 5 天零值、第 6 天命中率缺失；末点承接全量使 Σ 与 total 闭合
  grain: 'day',
  series: seriesFor(),
})

/** 与 total / totals 自洽的逐日点：前 6 天按权重分摊，末点取余量。 */
function seriesFor() {
  const days = ['2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']
  const weights = [0.08, 0.14, 0.11, 0.16, 0, 0.18]
  const total = { tokens: 1_280_000, input: 400_000, cacheRead: 800_000, cacheWrite: 0, output: 80_000, requests: 48 }
  const totals = { CNY: 12.34, USD: 4.68 }
  const used = { tokens: 0, input: 0, cacheRead: 0, cacheWrite: 0, output: 0, requests: 0, CNY: 0, USD: 0 }
  return days.map((dayKey, index) => {
    if (index === days.length - 1) {
      return {
        dayKey,
        cost: {
          CNY: { cost: Math.round((totals.CNY - used.CNY) * 100) / 100, requests: 6 },
          USD: { cost: Math.round((totals.USD - used.USD) * 100) / 100, requests: 6 },
        },
        requests: total.requests - used.requests,
        input: total.input - used.input,
        cacheRead: total.cacheRead - used.cacheRead,
        cacheWrite: 0,
        output: total.output - used.output,
        tokens: total.tokens - used.tokens,
        hitRate: 2 / 3,
      }
    }
    const share = weights[index]
    const point = {
      dayKey,
      cost: {
        CNY: { cost: Math.round(totals.CNY * share * 100) / 100, requests: Math.round(12 * share) },
        USD: { cost: Math.round(totals.USD * share * 100) / 100, requests: Math.round(12 * share) },
      },
      requests: Math.round(total.requests * share),
      input: Math.round(total.input * share),
      cacheRead: Math.round(total.cacheRead * share),
      cacheWrite: 0,
      output: Math.round(total.output * share),
      tokens: Math.round(total.tokens * share),
      hitRate: index === 5 ? null : 2 / 3,
    }
    used.tokens += point.tokens
    used.input += point.input
    used.cacheRead += point.cacheRead
    used.output += point.output
    used.requests += point.requests
    used.CNY += point.cost.CNY.cost
    used.USD += point.cost.USD.cost
    return point
  })
}

let failSummary = false
let failUsage = false
let summaryRequests = 0
let usageRequests = 0
let updateAvailable = false
let updateRequests = 0
let usageDelay = 0
// 本地假更新源：让宿主从 <dir>/latest.json 读「最新版本」，不请求 npm registry。
// 这样 /update 走真实后端路径，能测到「本地源 → 判定 → 提示 → 安装」整条链路。
// 更新检测走真实链路：宿主直接请求 npm registry，不注入任何假版本源。
// TOKEN_DASH_CURRENT_VERSION 把「当前版本」压到 2.1.0，让它对 registry 上的最新版判定为有新版本——
// 这样 e2e 覆盖的是真实的 registry 请求、真实的版本比较、真实的安装 spec，全程没有自造数据。
const UPDATE_BASELINE_VERSION = '2.1.0'
const env = { ...process.env, DSH_HOME: home, TOKEN_DASH_CURRENT_VERSION: UPDATE_BASELINE_VERSION }
let server
let browser
try {
  run(['plugin', '--profile', 'web', 'add', `link:${root}`], env)
  mkdirSync(join(tmpRoot, 'e2e'), { recursive: true })
  const dataDir = join(home, 'dsh-token-dash')
  mkdirSync(dataDir, { recursive: true })
  const fixtureLines = readFileSync(join(root, 'test', 'fixtures', 'e2e-session.jsonl'), 'utf8').split(/\r?\n/).filter(Boolean)
  // 0.2.2 起会话按工作区分组：fixture 的 cwd 必须真实存在，并在 workspace.json 里登记，否则侧栏列表为空、P1 永远不挂载。
  const fixtureHeader = JSON.parse(fixtureLines[0])
  const fixtureWorkspace = join(home, 'e2e-workspace')
  mkdirSync(fixtureWorkspace, { recursive: true })
  fixtureHeader.cwd = fixtureWorkspace
  const fixtureBody = [JSON.stringify(fixtureHeader), ...fixtureLines.slice(1)]
  const fixtureKey = `--${fixtureHeader.cwd.replace(':', '').replaceAll('\\', '-')}--`
  const fixtureDir = join(home, 'sessions', fixtureKey, fixtureHeader.id)
  mkdirSync(fixtureDir, { recursive: true })
  writeFileSync(join(fixtureDir, 'session.v4.jsonl.zstd'), Buffer.concat(fixtureBody.map((line) => zstdCompressSync(Buffer.from(`${line}\n`)))))
  const seededAt = new Date().toISOString()
  mkdirSync(join(home, 'storages'), { recursive: true })
  writeFileSync(join(home, 'storages', 'workspace.json'), JSON.stringify({
    unit: { name: 'workspace', version: 2 },
    global: { initialized: true, workspaceIds: ['ws-e2e'], archivedSessionIds: [], pinnedSessionIds: [] },
    tables: {
      workspaces: {
        'ws-e2e': { path: fixtureWorkspace, title: 'E2E', sessionIds: [fixtureHeader.id], createdAt: seededAt, updatedAt: seededAt },
      },
    },
  }, null, 2))
  server = startWeb(env)
  const { base, token } = await server.ready
  console.log(`[e2e] web ${base}`)

  // L2: real /usage contract with empty state.
  const usageResponse = await fetch(`${base}/token-dash/api/usage?range=7d`)
  assert.equal(usageResponse.status, 200)
  const usageData = (await usageResponse.json()).data
  assert.equal(usageData.range, '7d')
  assert.ok(usageData.totals !== undefined)
  assert.ok(Array.isArray(usageData.models))
  assert.ok(usageData.total !== undefined)
  // 趋势序列：连续日点 + 粒度标志
  assert.ok(Array.isArray(usageData.series), 'usage VM should carry series')
  assert.equal(usageData.series.length, 7)
  assert.equal(usageData.grain, 'day')
  for (const point of usageData.series) {
    for (const key of ['dayKey', 'cost', 'requests', 'tokens', 'hitRate']) assert.ok(key in point, `series point missing ${key}`)
  }
  assert.equal((await fetch(`${base}/token-dash/api/usage?range=bad`)).status, 400)

  // L2: 更新检测走真实 npm registry。当前版本被压到 2.1.0，registry 最新版更高 → 必须判定为可更新。
  const readUpdate = async (refresh = true) =>
    (await (await fetch(`${base}/token-dash/api/update${refresh ? '?refresh=1' : ''}`)).json()).data
  const updateFirst = await readUpdate()
  assert.equal(updateFirst.published, true, 'package is published on npm')
  assert.equal(updateFirst.current, '2.1.0', 'current version must honour TOKEN_DASH_CURRENT_VERSION')
  // 断言「latest 来自真实 registry」而不是钉死某个历史版本：发版后该值会随 npm latest 前移。
  assert.notEqual(updateFirst.latest, '2.1.0', 'latest must come from the real registry, not the pinned current')
  assert.equal(updateFirst.hasUpdate, true, 'an older current version must report an update')
  // 不带 refresh 时命中宿主的 5min 缓存：两次结果一致即证明缓存生效
  const updateCached = await readUpdate(false)
  assert.deepEqual(updateCached, updateFirst, 'without refresh the host must serve the cached payload')

  // L2: 安装接口契约（Issue #9）——只验校验分支，绝不真的触发安装
  const installBad = await fetch(`${base}/token-dash/api/update/install`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ version: '../../evil' }),
  })
  assert.equal(installBad.status, 400, 'illegal version must be rejected with 400, not 500')
  assert.equal((await installBad.json()).reason, 'invalid-version', 'rejection must carry a readable reason')

  // L2: export / import round-trip on the real host API.
  const exportData = (await (await fetch(`${base}/token-dash/api/export`)).json()).data
  assert.equal(exportData.schema, 1)
  assert.match(exportData.month, /^\d{4}-\d{2}$/)
  assert.ok(exportData.usage.all.total !== undefined)
  const importOk = await fetch(`${base}/token-dash/api/import`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(exportData),
  })
  assert.equal(importOk.status, 200)
  const importBad = await fetch(`${base}/token-dash/api/import`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ schema: 99 }),
  })
  assert.equal(importBad.status, 400)

  // Seed prefs used by P3（含两个“仅认文件”的计价键）。
  const prefsResponse = await fetch(`${base}/token-dash/api/prefs`, {
    method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      budgets: { 'deepseek-official': { amount: 100, currency: 'CNY' }, openrouter: { amount: 50, currency: 'USD' } },
      billingModes: { zhipu: 'subscription', moonshot: 'subscription', 'opencode-go': 'subscription' },
      priceOverrides: { 'my-relay:my-private-model': { input: 2, output: 8, currency: 'CNY' }, 'bad-override': { input: 'x' } },
      providerCurrency: { 'my-relay': 'USD', broken: 'EUR' },
    }),
  })
  assert.equal(prefsResponse.status, 200)
  const prefsEcho = (await (await fetch(`${base}/token-dash/api/prefs`)).json()).data
  assert.deepEqual(prefsEcho.providerCurrency, { 'my-relay': 'USD' })
  assert.deepEqual(Object.keys(prefsEcho.priceOverrides), ['my-relay:my-private-model'])
  assert.equal(prefsEcho.priceOverrides['my-relay:my-private-model'].input, 2)

  // L2: pricing contracts on the real host routes.
  assert.equal((await fetch(`${base}/token-dash/api/pricing/reprice?scope=2026-1`, { method: 'POST' })).status, 400)
  const repriceBody = await (await fetch(`${base}/token-dash/api/pricing/reprice?scope=all`, { method: 'POST' })).json()
  assert.equal(repriceBody.ok, true)
  assert.equal(repriceBody.data.scope, 'all')
  assert.equal(typeof repriceBody.data.rows, 'number')
  assert.equal(typeof repriceBody.data.skipped, 'object')
  const realSummary = (await (await fetch(`${base}/token-dash/api/summary`)).json()).data
  assert.ok(Array.isArray(realSummary.cost.unpriced), 'summary.cost.unpriced must be an array')
  for (const provider of realSummary.providers) {
    assert.ok(['prefs', 'snapshot', 'community'].includes(provider.currencySource), `currencySource=${provider.currencySource}`)
  }

  const executablePath = resolveChromium()
  browser = await chromium.launch({ headless: true, ...(executablePath === undefined ? {} : { executablePath }) })
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const slotMounts = []
  page.on('request', (request) => {
    if (!request.url().includes('/token-dash/api/log')) return
    try {
      const body = JSON.parse(request.postData() ?? '{}')
      if (body.module === 'slot' && typeof body.meta?.slot === 'string') slotMounts.push(body.meta.slot)
    } catch { /* ignore malformed log */ }
  })
  await page.route('**/token-dash/api/summary*', async (route) => {
    summaryRequests += 1
    if (failSummary) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, reason: 'mock-summary' }) })
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: currentSummary }) })
  })
  await page.route('**/token-dash/api/usage*', async (route) => {
    usageRequests += 1
    const range = new URL(route.request().url()).searchParams.get('range') ?? 'today'
    if (usageDelay > 0) await new Promise((resolveDelay) => setTimeout(resolveDelay, usageDelay))
    if (failUsage) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, reason: 'mock-usage' }) })
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: usageFor(range) }) })
  })
  // /repo 不再请求：按钮只做跳转，不拦截该路由也能通过。
  // /update 不 mock：走宿主的真实实现，直接请求 npm registry。
  // 这里只统计请求次数，用于断言周期检测是否发生。
  page.on('request', (request) => {
    if (request.url().includes('/token-dash/api/update')) updateRequests += 1
  })
  await page.route('**/open-in-app/open', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }))
  await page.route('**/token-dash/api/logs/export*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { content: '{"type":"header"}\n' } }) }))

  // 更新检测的时间戳在 localStorage（apply 时看板可能尚未挂载，读不到 /prefs）。
  // 每次 e2e 用干净的 localStorage，保证启动补检必然触发，结果可复现。
  // updateStartupDelay 也存 localStorage（apply 阶段读不到 prefs），测试改成 1s。
  // 同时预置「刚刚检测过」的时间戳：启动检测必须无条件执行，不能被它挡掉。
  await page.addInitScript(() => {
    try {
      localStorage.clear()
      localStorage.setItem('td:updateStartupDelay', '1000')
      localStorage.setItem('td:updateCheckedAt', String(Date.now()))
    } catch { /* ignore */ }
  })
  await page.goto(`${base}/?token=${token}`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => {
    for (let round = 0; round < 4; round += 1) {
      const buttons = [...document.querySelectorAll('[role=presentation] button')]
      const next = buttons.find((button) => /继续|跳过|稍后|关闭/.test(button.textContent ?? ''))
      if (next === undefined) break
      next.click()
    }
  })
  await page.waitForTimeout(400)
  await page.evaluate(() => {
    for (const node of document.querySelectorAll('[role=presentation]')) node.remove()
  })
  await page.waitForTimeout(200)

  const pill = page.locator('[data-testid=token-dash-pill]')
  assert.equal(await pill.count(), 0, 'blank session should not show P1')
  assert.match(await page.locator('body').innerText(), /标准模式/)
  // 0.2.2 的侧栏条目只监听真实指针事件：evaluate(node.click) 不会触发 React 的 onPointerDown，P1 就不会挂载。
  const fixtureTitle = (await page.getByText('E2E Fixture', { exact: true }).count()) > 0 ? 'E2E Fixture' : '未命名'
  await page.evaluate((title) => {
    const nodes = [...document.querySelectorAll('*')].filter((node) => (node.textContent ?? '').trim().startsWith(title))
    const target = nodes[nodes.length - 1]
    if (target === undefined) return
    for (let node = target, depth = 0; node !== null && depth < 6; node = node.parentElement, depth += 1) {
      node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      node.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      node.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
    }
  }, fixtureTitle)
  await page.waitForTimeout(1500)
  await pill.waitFor({ timeout: 20000 })
  assert.ok(await pill.isVisible())
  await page.waitForTimeout(300)
  assert.ok(slotMounts.includes('conversation.composer.dock'), `P1 should mount in composer.dock: ${slotMounts}`)
  assert.ok(!slotMounts.includes('conversation.hero.agentPreset'), `official agent preset slot must stay free: ${slotMounts}`)
  const dockBox = await page.locator('[data-composer-dock]').first().boundingBox()
  const pillBox = await pill.boundingBox()
  assert.ok(dockBox !== null && pillBox !== null, 'dock and pill boxes should exist')
  assert.ok(
    pillBox.x + pillBox.width >= dockBox.x + dockBox.width - 24,
    `P1 should align to the bottom bar right edge: pill=${pillBox.x + pillBox.width}, dock=${dockBox.x + dockBox.width}`,
  )
  assert.match(await pill.innerText(), /\[API\]/)
  assert.match(await pill.innerText(), /12\.3%/)
  assert.match(await pill.innerText(), /¥49\.86/)
  assert.equal(await pill.locator('[data-testid=token-dash-pill-ring-budget] svg').count(), 1)
  await page.waitForTimeout(4300)
  // client 上报通道必须接收 update 模块（曾因模块白名单只允许 slot 被 400 拒绝）
  const logProbe = await fetch(`${base}/token-dash/api/log`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ module: 'update', event: 'probe', meta: { from: 'e2e' } }),
  })
  assert.equal(logProbe.status, 200, 'client log whitelist must accept the update module')
  // 上一行 initScript 预置了「刚刚检测过」，启动检测仍必须发出请求
  assert.ok(updateRequests >= 1, `startup check must run unconditionally, not gated by last check time (requests=${updateRequests})`)
  // 启动检测完成后应写入时间戳，供下一轮启动去重
  const checkedAt = await page.evaluate(() => localStorage.getItem('td:updateCheckedAt'))
  assert.ok(checkedAt !== null && Number(checkedAt) > 0, 'startup check must record its timestamp')

  const jsClick = (locator) => locator.evaluate((node) => node.click())
  const openPanel = async () => {
    if (await page.locator('[data-testid=token-dash-panel]').count() === 0) await jsClick(pill)
    await page.locator('[data-testid=token-dash-panel]').waitFor({ timeout: 8000 })
    await page.waitForTimeout(250)
  }
  const panel = page.locator('[data-testid=token-dash-panel]')
  const summaryBeforeOpen = summaryRequests
  await openPanel()
  assert.ok(summaryRequests > summaryBeforeOpen, '展开面板应触发一次新的 /summary（Issue #1）')
  await page.screenshot({ path: join(tmpRoot, 'e2e', 'p2-current.png'), fullPage: true })

  // P2: adaptive width, no tabs, current-model four columns.
  const panelBox = await panel.boundingBox()
  assert.ok(panelBox !== null && Math.abs(panelBox.width - 380) <= 2, `panel width ${panelBox?.width} should be 380`)
  assert.match(await panel.innerText(), /当前模型/)
  assert.match(await panel.innerText(), /API 用量/)
  assert.equal(await panel.getByRole('tab').count(), 4) // range capsule only
  assert.ok(!(await panel.innerText()).includes('本月预算'))
  assert.ok(!(await panel.innerText()).includes('订阅套餐（账户级）'))
  const summaryRow = panel.getByTestId('token-dash-summary-row')
  assert.equal(await summaryRow.count(), 1)
  assert.match(await summaryRow.innerText(), /12\.3%/)
  assert.match(await summaryRow.innerText(), /¥12\.34 \/ ¥100\.00/)
  assert.match(await summaryRow.innerText(), /¥49\.86/)
  assert.equal(await panel.getByTestId('token-dash-summary-ring').locator('svg').count(), 1)
  assert.match(await summaryRow.innerText(), /已用 \/ 预算/)
  assert.ok(!(await summaryRow.innerText()).includes('本月已花'))
  assert.equal(await panel.getByTestId('token-dash-summary-month').count(), 0)
  assert.equal(await summaryRow.locator('[data-testid^=token-dash-summary-]').count(), 3)
  const rangeBox = await panel.locator('[role=tablist]').first().boundingBox()
  assert.ok(
    rangeBox !== null && panelBox !== null && rangeBox.width >= panelBox.width - 34,
    `range capsule width ${rangeBox?.width} should fill the panel`,
  )
  const balanceBox = await panel.getByTestId('token-dash-summary-balance').boundingBox()
  assert.ok(
    balanceBox !== null && panelBox !== null
      && balanceBox.x + balanceBox.width >= panelBox.x + panelBox.width - 18,
    `balance cell should align to the panel right: ${balanceBox?.x + balanceBox?.width} / ${panelBox?.x + panelBox?.width}`,
  )
  assert.equal(
    await panel.evaluate((node) => getComputedStyle(node).paddingTop), '16px',
    'P2 panel padding should be 16',
  )

  // Usage table: four columns, Tokens bracket, no cost column.
  assert.match(await panel.innerText(), /DeepSeek-V4\.1-Flash/)
  assert.match(await panel.innerText(), /320k\s*\[100k\/200k\/20k\]/)
  const usageRow = panel.getByTestId('token-dash-usage-row-deepseek-official-deepseek-flash')
  assert.equal(await usageRow.count(), 1)
  assert.match(await usageRow.innerText(), /12/)
  assert.ok(!(await panel.innerText()).includes('费用'))
  const usageLineBox = await panel.getByTestId('token-dash-usage-line').first().boundingBox()
  assert.ok(usageLineBox !== null && usageLineBox.height < 30, 'usage metrics should stay on one line')
  const usageDiff = await panel.getByTestId('token-dash-usage-table').evaluate((table) => {
    const heads = [...table.querySelectorAll('[role=columnheader]')].slice(1)
    const cells = [...table.querySelector('[role=row]').querySelectorAll('[role=cell]')].slice(1)
    return heads.map((head, index) => Math.abs(
      head.getBoundingClientRect().right - cells[index].getBoundingClientRect().right,
    ))
  })
  assert.ok(usageDiff.every((diff) => diff <= 1), `P2 numeric columns should right-align: ${usageDiff}`)
  assert.match(await panel.innerText(), /更新于/)
  assert.equal(await panel.getByTestId('token-dash-open-board').count(), 1, 'board entry should render once main is registered')

  // Header icon buttons share one control size.
  const info = panel.getByRole('button', { name: '查看支持的 API Key 范围' })
  const refreshButton = panel.getByTestId('token-dash-refresh')
  const closeButton = panel.getByTestId('token-dash-close')
  const [infoBox, refreshBox, closeBox] = await Promise.all([info.boundingBox(), refreshButton.boundingBox(), closeButton.boundingBox()])
  for (const [name, box] of [['info', infoBox], ['refresh', refreshBox], ['close', closeBox]]) {
    assert.ok(box !== null && Math.abs(box.width - 22) < 0.5 && Math.abs(box.height - 22) < 0.5, `${name} header button ${box?.width}x${box?.height} should be 22x22`)
  }
  await jsClick(info)
  await page.waitForTimeout(100)
  assert.match(await panel.innerText(), /目前支持 DeepSeek \/ Kimi \/ GLM \/ OpenRouter \/ Qwen API Key/)
  await jsClick(info)

  // Range switch keeps previous data while loading.
  usageDelay = 600
  await jsClick(panel.getByRole('tab', { name: '近30天' }))
  await page.waitForTimeout(120)
  assert.match(await panel.innerText(), /320k\s*\[100k\/200k\/20k\]/)
  assert.ok(!(await panel.innerText()).includes('Tokens 0'))
  await page.waitForTimeout(700)
  usageDelay = 0
  assert.match(await panel.innerText(), /近30天/)

  // Esc closes the panel.
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  assert.equal(await page.locator('[data-testid=token-dash-panel]').count(), 0)

  // Narrow viewport: panel clamps and page does not scroll horizontally.
  await page.setViewportSize({ width: 360, height: 800 })
  await openPanel()
  const narrowBox = await panel.boundingBox()
  assert.ok(narrowBox !== null && narrowBox.width <= 344, `panel width ${narrowBox?.width} should clamp to viewport`)
  assert.ok(narrowBox.x >= 0 && narrowBox.x + narrowBox.width <= 360, `panel bounds ${narrowBox.x}+${narrowBox.width} should fit viewport`)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  assert.equal(overflow, 0)
  await jsClick(closeButton)
  await page.waitForTimeout(200)
  await page.setViewportSize({ width: 1280, height: 900 })
  await openPanel()

  // Error states and empty provider.
  failSummary = true
  await jsClick(panel.getByTestId('token-dash-refresh'))
  await page.waitForTimeout(300)
  assert.match(await panel.innerText(), /刷新失败，保留上次数据/)
  failSummary = false
  await jsClick(panel.getByTestId('token-dash-refresh'))
  await page.waitForTimeout(300)
  failUsage = true
  await jsClick(panel.getByRole('tab', { name: '近7天' }))
  await page.waitForTimeout(300)
  assert.match(await panel.innerText(), /范围数据加载失败/)
  failUsage = false
  currentSummary = { ...currentSummary, providers: [], providersDegraded: false, updatedAt: now - 300000 }
  await jsClick(panel.getByTestId('token-dash-refresh'))
  await page.waitForTimeout(300)
  assert.match(await panel.innerText(), /未检测到已配置供应商/)
  currentSummary = { ...currentSummary, providersDegraded: true }
  await jsClick(panel.getByTestId('token-dash-refresh'))
  await page.waitForTimeout(300)
  assert.match(await panel.innerText(), /供应商探测失败/)
  assert.ok(await panel.getByRole('button', { name: '重试' }).count() >= 1)
  currentSummary = { ...currentSummary, providers: [...apiProviders, ...subProviders], providersDegraded: false }
  assert.match(await pill.innerText(), /--/)

  // Back to full data, then open the full-page board from the panel.
  await jsClick(panel.getByTestId('token-dash-refresh'))
  await page.waitForTimeout(400)
  await jsClick(panel.getByTestId('token-dash-open-board'))
  const board = page.locator('[data-testid=token-dash-board]')
  await board.waitFor({ timeout: 8000 })
  await page.waitForTimeout(400)
  const boardScroll = page.getByTestId('token-dash-board-scroll')
  const scrollMetrics = await boardScroll.evaluate((node) => ({
    client: node.clientHeight,
    scroll: node.scrollHeight,
  }))
  assert.ok(
    scrollMetrics.scroll > scrollMetrics.client,
    `board should own its scroll: ${scrollMetrics.scroll} > ${scrollMetrics.client}`,
  )
  // 清掉宿主欢迎/引导浮层，避免遮挡看板截图。
  await page.evaluate(() => {
    for (const node of document.querySelectorAll('[role=dialog],[role=presentation]')) {
      if (node.querySelector('[data-testid=token-dash-board]') !== null) continue
      node.remove()
    }
  })
  // 全页截图时把 sticky 胶囊改为静态，否则会盖住摘要带与明细。
  await board.getByTestId('token-dash-settings-capsule').evaluate((node) => { node.style.position = 'static' })
  await page.screenshot({ path: join(tmpRoot, 'e2e', 'p3-board.png'), fullPage: true })

  assert.match(await board.innerText(), /API 用量（按供应商）/)
  assert.match(await board.innerText(), /订阅套餐（按供应商）/)
  assert.equal(await board.getByTestId('token-dash-settings-capsule').count(), 1)
  // Two tables split by kind.
  assert.equal(await board.locator('[data-testid^=token-dash-budget-row-]').count(), apiProviders.length)
  assert.equal(await board.locator('[data-testid^=token-dash-quota-row-]').count(), subProviders.length)
  // Budget cards: always-visible input + gauge + three rows.
  assert.match(await board.getByTestId('token-dash-budget-input-deepseek-official').inputValue(), /^100(\.00)?$/)
  assert.match(await board.getByTestId('token-dash-budget-used-deepseek-official').innerText(), /12\.3%/)
  assert.match(await board.getByTestId('token-dash-budget-plan-deepseek-official').innerText(), /¥87\.66/)
  assert.match(await board.getByTestId('token-dash-budget-balance-deepseek-official').innerText(), /¥49\.86/)
  // 额度 + 购买余额：单值位是合计，进度与购买额拆行，周期 / 限流 / 渠道用量进 caption
  assert.match(await board.getByTestId('token-dash-budget-balance-ollama').innerText(), /\$97\.50/)
  assert.match(await board.getByTestId('token-dash-budget-allowance-ollama').innerText(), /\$27\.50 \/ \$100\.00/)
  assert.match(await board.getByTestId('token-dash-budget-purchased-ollama').innerText(), /\$25\.00/)
  const ollamaCard = await board.getByTestId('token-dash-budget-row-ollama').innerText()
  assert.match(ollamaCard, /周期至/)
  assert.match(ollamaCard, /限流中/)
  assert.match(ollamaCard, /渠道用量 \$0\.17/)
  const openrouterCard = await board.getByTestId('token-dash-budget-row-openrouter').innerText()
  assert.equal(openrouterCard.includes('限流中'), false)
  assert.equal(await board.locator('[data-testid^=token-dash-budget-gauge-label-]').count(), apiProviders.length)
  // Subscription cards: only actual windows (two-window providers have no month cell).
  const windowCount = subProviders.reduce((total, provider) => total + (provider.windows?.length ?? 0), 0)
  assert.equal(await board.locator('[data-testid^=token-dash-quota-cell-]').count(), windowCount)
  assert.match(await board.getByTestId('token-dash-quota-cell-moonshot-5h').innerText(), /96\.0%|96%/)
  assert.match(await board.getByTestId('token-dash-quota-cell-opencode-go-month').innerText(), /58\.0%|58%/)
  assert.match(await board.getByTestId('token-dash-quota-rel-opencode-go-month').innerText(), /天后|小时后|分钟后/)
  assert.match(await board.getByTestId('token-dash-quota-abs-opencode-go-month').innerText(), /\d{2}-\d{2} \d{2}:\d{2}/)
  // 费用列统一 ≈：订阅行与 api 行同一形态，且不再出现「预估」（订阅估算 Issue #2）
  for (const [id, expectText] of [
    ['token-dash-detail-row-zhipu-glm-5.3', '≈¥3.42'],
    ['token-dash-detail-row-moonshot-kimi-k3', '≈¥1.08'],
    ['token-dash-detail-row-deepseek-official-deepseek-flash', '≈¥12.34'],
  ]) {
    const cell = board.getByTestId(id).getByTestId('token-dash-detail-cost')
    const text = (await cell.innerText()).replace(/\s+/g, ' ').trim()
    assert.ok(text.includes(expectText), `${id} cost cell should read '${expectText}', received '${text}'`)
    assert.equal(text.includes('\n'), false, `${id} estimate must stay on one line`)
  }
  // 订阅卡宽度：与按量卡同源，封顶 260，不得随容器铺满（Issue #4）
  const quotaCardWidths = await board.locator('[data-testid^=token-dash-quota-row-]').evaluateAll((nodes) =>
    nodes.map((node) => node.getBoundingClientRect().width))
  const quotaTableBox = await board.getByTestId('token-dash-quota-table').boundingBox()
  assert.ok(quotaTableBox !== null)
  for (const width of quotaCardWidths) {
    assert.ok(width <= 260.5, `subscription card width ${width} must not exceed the 260 cap`)
    assert.ok(width < quotaTableBox.width, 'subscription card must not stretch to the table width')
  }
  // 全表不得再出现「预估」字样；费用表头必须带估算说明（Issue #2）
  const detailText = await board.getByTestId('token-dash-detail-table').innerText()
  assert.equal(detailText.includes('预估'), false, 'cost column must not use the 预估 prefix any more')
  const costHead = board.getByTestId('token-dash-detail-table').locator('[role=columnheader]').last()
  assert.ok((await costHead.getAttribute('title')) !== null, 'cost column header must carry an estimate tooltip')
  // 两套卡片网格都必须靠换行承载任意家数，不得退化成横向滚动容器
  for (const testid of ['token-dash-budget-table', 'token-dash-quota-table']) {
    const metrics = await board.getByTestId(testid).evaluate((node) => ({ scroll: node.scrollWidth, client: node.clientWidth }))
    assert.ok(
      metrics.scroll <= metrics.client + 1,
      `${testid} must wrap new rows instead of scrolling horizontally (${metrics.scroll} > ${metrics.client})`,
    )
  }
  // Summary band: four halves inside one bordered band, above the detail table.
  const cardCost = board.getByTestId('token-dash-card-cost')
  const cardTokens = board.getByTestId('token-dash-card-tokens')
  const [costBox, tokensBox] = await Promise.all([cardCost.boundingBox(), cardTokens.boundingBox()])
  assert.ok(costBox !== null && tokensBox !== null)
  assert.ok(tokensBox.x < costBox.x, 'tokens cell should sit left of cost cell')
  // 四格与右侧指标胶囊必须同序：Tokens → 费用 → 命中率 → 请求数（Issue #3）
  const EXPECTED_METRIC_ORDER = ['tokens', 'cost', 'hitRate', 'requests']
  const cellOrder = await board.locator('[data-testid^=token-dash-card-]').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('data-testid').replace('token-dash-card-', '')))
  assert.deepEqual(cellOrder, EXPECTED_METRIC_ORDER, 'summary cells must follow TREND_METRICS order')
  const pillLabels = await board.getByTestId('token-dash-trend').locator('[role=radio]').evaluateAll((nodes) =>
    nodes.map((node) => node.textContent.trim()))
  assert.deepEqual(pillLabels, ['Tokens', '费用', '命中率', '请求'], 'metric pills must follow TREND_METRICS order')
  // 逐格横向递增，确认顺序不是只靠 DOM 顺序
  const cellXs = []
  for (const metric of EXPECTED_METRIC_ORDER) {
    const box = await board.getByTestId(`token-dash-card-${metric}`).boundingBox()
    assert.ok(box !== null, `card ${metric} should be visible`)
    cellXs.push(box.x)
  }
  assert.deepEqual([...cellXs].sort((a, b) => a - b), cellXs, 'summary cells must be laid out left-to-right in order')
  const bandBorder = await board.getByTestId('token-dash-range-cards').evaluate((node) => getComputedStyle(node).borderTopStyle)
  assert.equal(bandBorder, 'solid')
  // 四格：总请求数与缓存命中率随四格方案新增，且四格都是指标选择器
  assert.equal(await board.locator('[data-testid^=token-dash-card-]').count(), 4)
  assert.match(await board.getByTestId('token-dash-card-requests').innerText(), /48/)
  assert.match(await board.getByTestId('token-dash-card-hitRate').innerText(), /66\.7%|66\.6%|67%/)
  assert.equal(await board.getByTestId('token-dash-card-tokens').getAttribute('aria-pressed'), 'true')
  // 趋势柱：位于摘要带与明细表之间，柱数等于序列点数，零值日不画柱
  const trend = board.getByTestId('token-dash-trend')
  const [trendBox, bandBox] = await Promise.all([trend.boundingBox(), board.getByTestId('token-dash-range-cards').boundingBox()])
  assert.ok(trendBox !== null && bandBox !== null)
  assert.ok(trendBox.y >= bandBox.y + bandBox.height, 'trend should sit below the summary band')
  assert.equal(await board.locator('[data-testid^=token-dash-trend-bar-]').count(), 7)
  const zeroBox = await board.getByTestId('token-dash-trend-bar-2026-10-31').boundingBox()
  assert.equal(zeroBox === null ? 0 : Math.round(zeroBox.height), 0, 'zero-value day should render no bar')
  assert.match(await board.getByTestId('token-dash-trend-title').innerText(), /使用趋势 · Tokens/)
  // Y 轴：上 / 中两档（下限为 0 时不出底部档），刻度必须落在柱区左侧且不压柱
  const axisTop = board.getByTestId('token-dash-trend-axis-top')
  const axisMid = board.getByTestId('token-dash-trend-axis-mid')
  assert.equal(await axisTop.count(), 1, 'Y axis must render a top tick')
  assert.equal(await axisMid.count(), 1, 'Y axis must render a mid tick')
  assert.equal(await board.getByTestId('token-dash-trend-axis-bottom').count(), 0, 'no bottom tick when floor is 0')
  const axisText = await axisTop.innerText()
  assert.ok(axisText.trim().length > 0, 'top tick must carry a formatted value')
  // 轴必须在绘图区之外（与 CC Switch 的 <YAxis> 同构），不压柱
  const [axisBox, plotBox, firstBarBox] = await Promise.all([
    axisTop.boundingBox(),
    board.getByTestId('token-dash-trend-plot-area').boundingBox(),
    board.getByTestId('token-dash-trend-bar-2026-11-01').boundingBox().catch(() => null),
  ])
  assert.ok(axisBox !== null && plotBox !== null, 'axis and plot area must both be laid out')
  assert.ok(axisBox.x + axisBox.width <= plotBox.x + 1, 'axis must sit outside the plot area, not inside it')
  if (firstBarBox !== null) assert.ok(axisBox.x + axisBox.width <= firstBarBox.x + 1, 'axis tick must not overlap the bars')
  // 明细表有独立分区标题
  assert.equal(await board.getByTestId('token-dash-detail-title').innerText(), '模型明细', 'detail table needs its own section heading')
  // 悬停：虚线指示线 + 浮层随鼠标出现，不依赖原生 title（Issue #5）
  const hoverDay = '2026-10-30'
  assert.equal(await board.getByTestId('token-dash-trend-hover-line').count(), 0, 'no guide line before hover')
  const hoverSlot = board.getByTestId(`token-dash-trend-slot-${hoverDay}`)
  assert.equal(await hoverSlot.count(), 1, 'every slot must be hoverable, including zero-value days')
  const slotBox = await hoverSlot.boundingBox()
  assert.ok(slotBox !== null)
  // dispatchEvent 走真实 mouseenter/enter 语义，但不移动视口，避免影响后续 boundingBox 比较
  await hoverSlot.dispatchEvent('mouseover')
  await hoverSlot.dispatchEvent('mouseenter')
  const lineAppeared = await board.getByTestId('token-dash-trend-hover-line')
    .waitFor({ state: 'visible', timeout: 400 })
    .then(() => true, () => false)
  assert.ok(lineAppeared, 'guide line must appear within 400ms of hover, without the native title delay')
  assert.equal(await board.getByTestId('token-dash-trend-bar-2026-10-30').getAttribute('title'), null, 'native title must be removed')
  assert.match(await board.getByTestId('token-dash-trend-hover-tip').innerText(), /2026-10-30 · /)
  // 虚线为虚线且垂直
  const lineStyle = await board.getByTestId('token-dash-trend-hover-line')
    .evaluate((node) => {
      const s = getComputedStyle(node)
      const r = node.getBoundingClientRect()
      return { style: s.borderLeftStyle, width: s.width, height: s.height, left: s.left, z: s.zIndex, opacity: s.opacity, rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }, color: s.borderLeftColor }
    })

  assert.equal(lineStyle.style, 'dashed', 'guide line must be dashed')
  assert.equal(Math.round(parseFloat(lineStyle.width)), 1, 'guide line must be 1px wide')
  assert.ok(parseFloat(lineStyle.height) > 100, 'guide line must span the plot height')
  // 移出后消失
  await trend.locator('[data-testid^=token-dash-trend-slot-]').first().evaluate((node) => {
    node.parentElement.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }))
    node.parentElement.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false, relatedTarget: document.body }))
  })
  await page.waitForTimeout(120)
  assert.equal(await board.getByTestId('token-dash-trend-hover-line').count(), 0, 'guide line must clear on mouse leave')
  assert.equal(await board.getByTestId('token-dash-trend-hover-tip').count(), 0, 'tooltip must clear on mouse leave')
  // 点摘要带切指标：标题、选中态、胶囊与图表一起变
  await jsClick(board.getByTestId('token-dash-card-requests'))
  await page.waitForTimeout(120)
  assert.match(await board.getByTestId('token-dash-trend-title').innerText(), /使用趋势 · 请求/)
  assert.equal(await board.getByTestId('token-dash-card-requests').getAttribute('aria-pressed'), 'true')
  assert.equal(await board.getByTestId('token-dash-card-tokens').getAttribute('aria-pressed'), 'false')
  assert.equal(await trend.getAttribute('data-td-trend'), 'requests')
  // 命中率轴：下限非 0 时补出底部档，且三档格式均为百分比
  await jsClick(board.getByTestId('token-dash-card-hitRate'))
  await page.waitForTimeout(120)
  assert.equal(await trend.getAttribute('data-td-trend'), 'hitRate')
  const axisKeys = await board.locator('[data-testid^=token-dash-trend-axis-]').count()
  assert.ok(axisKeys >= 2, 'hit rate axis must render at least two ticks')
  assert.match(await board.getByTestId('token-dash-trend-axis-top').innerText(), /%$/, 'hit rate ticks carry a percent sign')
  // 多币种下费用指标禁用，不静默取首个币种
  await jsClick(board.getByTestId('token-dash-card-cost'))
  await page.waitForTimeout(120)
  assert.equal(await board.getByTestId('token-dash-trend-empty').count(), 1)
  assert.match(await board.getByTestId('token-dash-trend-empty').innerText(), /多币种下成本柱不可用/)
  await jsClick(board.getByTestId('token-dash-card-tokens'))
  await page.waitForTimeout(120)
  const detailTable = board.getByTestId('token-dash-detail-table')
  const detailBox = await detailTable.boundingBox()
  assert.ok(detailBox !== null && trendBox !== null && detailBox.y > trendBox.y + trendBox.height, 'detail table should be below the trend chart')
  assert.match(await detailTable.innerText(), /费用/)
  assert.equal(await board.locator('[data-testid^=token-dash-detail-row-]').count(), models.length)
  assert.equal(await board.getByTestId('token-dash-board-head-refresh').count(), 1)
  assert.match(await board.locator('[data-testid^=token-dash-detail-row-]').first().innerText(), /·/)

  // 费用列四态（v3.20 起统一）：金额一律 ≈ / 未定价 / 零消耗 —
  const approxRow = board.getByTestId('token-dash-detail-row-tencent-deepseek-v4.1-flash-ioa')
  assert.match(await approxRow.innerText(), /≈¥1\.24/, 'fuzzy hit should carry ≈')
  const exactCell = board.getByTestId('token-dash-detail-row-siliconflow-deepseek-v4.1-flash').getByTestId('token-dash-detail-cost')
  assert.equal((await exactCell.innerText()).trim(), '≈¥1.24', 'estimate marker is unified: every amount carries ≈')
  const unpricedCell = board.getByTestId('token-dash-detail-row-my-relay-my-private-model').getByTestId('token-dash-detail-cost')
  assert.equal((await unpricedCell.innerText()).trim(), '未定价')
  assert.match(await unpricedCell.getAttribute('title'), /无匹配价目/, 'unpriced cell should explain why')
  const emptyCell = board.getByTestId('token-dash-detail-row-tencent-deepseek-chat').getByTestId('token-dash-detail-cost')
  assert.equal((await emptyCell.innerText()).trim(), '—', 'zero-token row must not render ¥0.00')

  // 未声明币种的 provider 标「按社区表 CNY」；已声明的（openrouter=USD）不标
  const currencyBadge = board.getByTestId('token-dash-currency-source-siliconflow')
  assert.equal(await currencyBadge.count(), 1)
  assert.match(await currencyBadge.innerText(), /按社区表 CNY/)
  assert.equal(await board.getByTestId('token-dash-currency-source-openrouter').count(), 0)

  // Issue #1 B 项：看板常驻时每 10s 应重新拉 /usage（费用与明细的数据源）
  const usageBeforePoll = usageRequests
  await page.waitForTimeout(11_000)
  assert.ok(usageRequests > usageBeforePoll, '看板应每 10s 刷新 /usage（Issue #1）')
  const [repoBox, headRefreshBox] = await Promise.all([
    board.getByTestId('token-dash-repo').boundingBox(),
    board.getByTestId('token-dash-board-head-refresh').boundingBox(),
  ])
  assert.ok(repoBox !== null && Math.abs(repoBox.width - 44) <= 1, `repo button width ${repoBox?.width} should be 44`)
  assert.ok(headRefreshBox !== null && Math.abs(headRefreshBox.width - 44) <= 1, `refresh button width ${headRefreshBox?.width} should be 44`)
  assert.equal(
    await board.locator('[data-testid^=token-dash-budget-row-]').first().evaluate((node) => getComputedStyle(node).paddingTop),
    '16px',
    'P3 card padding should be 16',
  )
  const detailDiff = await detailTable.evaluate((table) => {
    const heads = [...table.querySelectorAll('[role=columnheader]')].slice(1)
    const cells = [...table.querySelector('[role=row]').querySelectorAll('[role=cell]')].slice(1)
    return heads.map((head, index) => Math.abs(
      head.getBoundingClientRect().right - cells[index].getBoundingClientRect().right,
    ))
  })
  assert.ok(detailDiff.every((diff) => diff <= 1), `P3 numeric columns should right-align: ${detailDiff}`)
  const detailCols = await detailTable.evaluate((table) => {
    const cells = [...table.querySelector('[role=row]').querySelectorAll('[role=cell]')]
    const widths = cells.map((cell) => cell.getBoundingClientRect().width)
    return {
      model: widths[0],
      numeric: widths.slice(1),
      font: getComputedStyle(cells[1]).fontSize,
    }
  })
  assert.ok(detailCols.model <= 241, `model column ${detailCols.model} should be <= 240`)
  assert.ok(
    Math.max(...detailCols.numeric) - Math.min(...detailCols.numeric) <= 2,
    `numeric columns should be equal width: ${detailCols.numeric}`,
  )
  assert.equal(detailCols.font, '13px', 'numeric cell font should be 13px')
  // Settings capsule: three rows and expected controls.
  const rangeSection = board.locator('section').filter({ hasText: '范围与明细' })
  const [rangeSectionBox, capsuleBox] = await Promise.all([
    rangeSection.boundingBox(),
    board.getByTestId('token-dash-settings-capsule').boundingBox(),
  ])
  assert.ok(
    rangeSectionBox !== null && capsuleBox !== null
      && capsuleBox.y - (rangeSectionBox.y + rangeSectionBox.height) >= 20,
    'settings capsule should keep a gap below the range/detail section',
  )
  assert.equal(await board.getByTestId('token-dash-settings-title').count(), 1)
  assert.match(await board.getByTestId('token-dash-settings-title').innerText(), /设置与数据管理/)
  const localeHint = board.getByTestId('token-dash-settings-locale-hint')
  assert.equal(await localeHint.count(), 1)
  assert.match(await localeHint.innerText(), /语言跟随DSH设置；当前仅中文\/English，其他语言回退英文/)
  assert.equal(await localeHint.evaluate((node) => node.tagName), 'SPAN')
  assert.equal(await localeHint.getAttribute('title'), null)
  const [settingsTitleBox, localeHintBox, settingsRow1Box, settingsCapsuleBox] = await Promise.all([
    board.getByTestId('token-dash-settings-title').boundingBox(),
    localeHint.boundingBox(),
    board.getByTestId('token-dash-settings-row-1').boundingBox(),
    board.getByTestId('token-dash-settings-capsule').boundingBox(),
  ])
  assert.ok(
    settingsTitleBox !== null && localeHintBox !== null
      && localeHintBox.x > settingsTitleBox.x
      && localeHintBox.y < settingsTitleBox.y + settingsTitleBox.height,
    'language hint should sit to the right of the settings title',
  )
  assert.ok(
    settingsTitleBox !== null && settingsRow1Box !== null && settingsCapsuleBox !== null
      && settingsTitleBox.y + settingsTitleBox.height <= settingsCapsuleBox.y + 1
      && settingsCapsuleBox.y <= settingsRow1Box.y,
    'settings title should sit outside and above the capsule',
  )
  assert.equal(await board.getByTestId('token-dash-settings-row-1').count(), 1)
  assert.equal(await board.getByTestId('token-dash-settings-row-2').count(), 1)
  assert.equal(await board.getByTestId('token-dash-settings-row-3').count(), 1)
  const [leftGroup, rightGroup] = await Promise.all([
    board.getByTestId('token-dash-settings-refresh-left').boundingBox(),
    board.getByTestId('token-dash-settings-refresh-right').boundingBox(),
  ])
  assert.ok(leftGroup !== null && rightGroup !== null)
  assert.ok(leftGroup.x < rightGroup.x, 'refresh row groups should be two ends')
  assert.ok(
    Math.abs(leftGroup.x - (capsuleBox.x + 17)) <= 2,
    'refresh interval group should align to the left edge',
  )
  assert.ok(
    Math.abs((rightGroup.x + rightGroup.width) - (capsuleBox.x + capsuleBox.width - 17)) <= 2,
    'account balance group should align to the right edge',
  )
  assert.equal(await board.getByTestId('token-dash-board-refresh').count(), 0)
  const boardBox = await board.boundingBox()
  assert.ok(
    boardBox !== null && capsuleBox !== null
      && boardBox.y + boardBox.height - (capsuleBox.y + capsuleBox.height) >= 24,
    'capsule should keep bottom spacing',
  )
  const refreshSegment = board.getByTestId('token-dash-refresh-segment')
  const refreshSegmentBox = await refreshSegment.boundingBox()
  assert.ok(refreshSegmentBox !== null && refreshSegmentBox.width <= 170, `refresh segment width ${refreshSegmentBox?.width} should be <= 170`)
  assert.equal(await board.locator('select').count(), 0)
  assert.match(await board.innerText(), new RegExp(`v?${PKG_VERSION.replaceAll('.', '\\.')}`))
  assert.ok(!(await board.innerText()).includes('诊断'))
  assert.ok(!(await board.innerText()).includes('清空日志'))
  assert.ok(!(await board.innerText()).includes('本月 Token'))

  // Star chip is a plain link to the repository (no star count, no /repo request).
  const repoChip = board.getByTestId('token-dash-repo')
  assert.equal((await repoChip.innerText()).trim(), '★')
  assert.ok((await repoChip.getAttribute('href'))?.includes('github.com'))
  assert.equal(await repoChip.getAttribute('target'), '_blank')

  // Budget: always-visible input; Enter commits and recalculates immediately.
  const budgetInput = board.getByTestId('token-dash-budget-input-deepseek-official')
  await budgetInput.waitFor({ timeout: 5000 })
  assert.match(await budgetInput.inputValue(), /^100(\.00)?$/)
  // Headless 窗口拿不到系统焦点：值走原生 setter + input 事件，按键直接派发。
  const setInputValue = (locator, value) => locator.evaluate((node, next) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(node, next)
    node.dispatchEvent(new Event('input', { bubbles: true }))
  }, value)
  const pressInInput = (locator, key) => locator.evaluate((node, value) => {
    node.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true }))
  }, key)
  await setInputValue(budgetInput, '200.50')
  await page.waitForTimeout(80)
  await pressInInput(budgetInput, 'Enter')
  await page.waitForTimeout(500)
  assert.match(await budgetInput.inputValue(), /^200\.5(0)?$/)
  assert.match(await board.getByTestId('token-dash-budget-plan-deepseek-official').innerText(), /¥188\.16/)
  assert.match(await board.getByTestId('token-dash-budget-used-deepseek-official').innerText(), /6\.2%/)
  // Invalid value reports the error and keeps the input.
  await setInputValue(budgetInput, '-1')
  await page.waitForTimeout(50)
  await pressInInput(budgetInput, 'Enter')
  await page.waitForTimeout(300)
  assert.match(await board.innerText(), /请输入 0 或正数/)
  // Esc restores the last saved value without changing it.
  await setInputValue(budgetInput, '123')
  await pressInInput(budgetInput, 'Escape')
  await page.waitForTimeout(300)
  assert.match(await budgetInput.inputValue(), /^200\.5(0)?$/)
  // Clearing writes an explicit zero => unset.
  await setInputValue(budgetInput, '')
  await page.waitForTimeout(50)
  await pressInInput(budgetInput, 'Enter')
  await page.waitForTimeout(500)
  assert.equal(await budgetInput.inputValue(), '')
  const clearedPrefs = (await (await fetch(`${base}/token-dash/api/prefs`)).json()).data
  assert.equal(clearedPrefs.budgets['deepseek-official'].amount, 0)

  // Update control：真实 registry 下 2.1.0 会看到比它更高的最新版。
  const updateButton = board.getByTestId('token-dash-update')
  await updateButton.waitFor({ timeout: 5000 })
  // 先让自动检测建立 available 态（点击前必须能看到版本号）
  await page.evaluate(() => {
    localStorage.setItem('td:updateCheckedAt', '0')
    document.dispatchEvent(new Event('visibilitychange'))
  })
  // 用户切回可见触发补检，需要等一等让它真正发出请求并渲染 available
  await updateButton.waitFor({ timeout: 5000 })
  await page.waitForFunction(
    () => document.querySelector('[data-testid=token-dash-update]')?.getAttribute('data-state') === 'available',
    undefined,
    { timeout: 8000 },
  )
  assert.equal(await updateButton.getAttribute('data-state'), 'available', 'auto check with update available shows available state')
  // 断言显示的是 registry 真实 latest（不钉死历史版本号），且与 update API 一致。
  assert.match(await board.getByTestId('token-dash-update-latest').innerText(), /\d+\.\d+\.\d+/, 'version must be visible without hovering')
  const availableStyle = await updateButton.evaluate((node) => {
    const s = getComputedStyle(node)
    return { color: s.color, background: s.backgroundColor, height: Math.round(node.getBoundingClientRect().height) }
  })
  assert.notEqual(availableStyle.background, 'rgba(0, 0, 0, 0)', 'available button must carry an accent tint')
  assert.equal(availableStyle.height, 22, 'button height must stay 22px after component extraction')
  // 调度去重（Issue #10）：短时间内连续派发可见事件，到期判定只放行一次
  const beforeBurst = updateRequests
  await page.evaluate(() => {
    for (let i = 0; i < 5; i += 1) document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.waitForTimeout(700)
  assert.ok(
    updateRequests - beforeBurst <= 1,
    `repeated visibility events must not fan out checks (delta=${updateRequests - beforeBurst})`,
  )
  // 无二次确认（Issue #11）：confirm 节点永不存在，点击直接进入安装
  assert.equal(await board.getByTestId('token-dash-update-confirm').count(), 0, 'confirm bar must no longer exist')
  assert.equal(await board.getByRole('button', { name: '立即更新' }).count(), 0, 'immediate-update button must no longer exist')
  // 用独立页签验证，避免与上方的 available 态互相覆盖（同一按钮状态存在竞态）。
  const failPage = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  try {
    await failPage.addInitScript(() => {
      try { localStorage.clear(); localStorage.setItem('td:updateStartupDelay', '300') } catch { /* ignore */ }
    })
    await failPage.route('**/token-dash/api/update*', (route) => route.fulfill({ status: 502, contentType: 'application/json', body: '{"ok":false}' }))
    await failPage.goto(`${base}/?token=${token}`, { waitUntil: 'domcontentloaded' })
    await failPage.waitForTimeout(2500)
    const failBoard = failPage.locator('[data-testid=token-dash-board]')
    if (await failBoard.count() > 0) {
      assert.match(await failBoard.innerText(), /更新检查失败/, 'auto check failure must be visible')
      assert.equal(
        await failBoard.getByTestId('token-dash-update').getAttribute('data-state'),
        'idle',
        'auto failure must not turn the button red',
      )
      // 无障碍（Issue #11）：失败提示必须用 alert 语义，读屏会立即播报
      const failHint = failBoard.getByTestId('token-dash-update-hint')
      assert.equal(await failHint.getAttribute('role'), 'alert', 'failure hint must use role=alert')
      assert.equal(await failHint.getAttribute('aria-live'), 'assertive', 'failure hint must be assertive')
    }
  } finally {
    await failPage.close().catch(() => {})
  }

  // Logs / data entries stay reachable from the capsule.
  await jsClick(board.getByTestId('token-dash-log-open'))
  await page.waitForTimeout(200)
  assert.match(await board.innerText(), /已打开日志文件夹|无法打开，已复制路径/)
  await jsClick(board.getByTestId('token-dash-log-export'))
  await page.waitForTimeout(200)
  assert.equal(await board.getByTestId('token-dash-data-export').count(), 1)
  assert.equal(await board.getByTestId('token-dash-data-import').count(), 1)

  // Reload keeps the board entry and the plain link.
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  const reloadedEntry = page.locator('[data-testid=token-dash-sidebar-entry]')
  await reloadedEntry.waitFor({ timeout: 10000 })
  await jsClick(reloadedEntry.first())
  const reloadedBoard = page.locator('[data-testid=token-dash-board]')
  await reloadedBoard.waitFor({ timeout: 8000 })
  await page.waitForTimeout(400)
  assert.equal((await reloadedBoard.getByTestId('token-dash-repo').innerText()).trim(), '★')

  // Dark theme: chrome follows host tokens, no hard-coded white panel.
  await page.evaluate(() => document.body.setAttribute('data-ds-dark-theme', '1'))
  await page.waitForTimeout(120)
  const capsuleBg = await reloadedBoard.getByTestId('token-dash-settings-capsule').evaluate((node) => getComputedStyle(node).backgroundColor)
  assert.notEqual(capsuleBg, 'rgba(0, 0, 0, 0)')
  await page.screenshot({ path: join(tmpRoot, 'e2e', 'p3-dark.png'), fullPage: true })
  await page.evaluate(() => document.body.removeAttribute('data-ds-dark-theme'))

  // E9：英文 locale 下刻度单位必须切到 K / M / B，标题走英文词条（Issue #2）
  const enPage = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: 'en-US' })
  await enPage.route('**/token-dash/api/summary*', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: currentSummary }),
  }))
  await enPage.route('**/token-dash/api/usage*', (route) => {
    const range = new URL(route.request().url()).searchParams.get('range') ?? 'today'
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: usageFor(range) }) })
  })
  // 英文页只验刻度与文案，更新提示会遮挡视线：这里固定回「无更新」，避免干扰
  await enPage.route('**/token-dash/api/update*', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { published: true, hasUpdate: false, latest: UPDATE_BASELINE_VERSION, current: UPDATE_BASELINE_VERSION } }),
  }))
  await enPage.goto(`${base}/?token=${token}`, { waitUntil: 'domcontentloaded' })
  await enPage.waitForTimeout(2500)
  await enPage.evaluate(() => { for (const node of document.querySelectorAll('[role=presentation]')) node.remove() })
  await enPage.waitForTimeout(300)
  await enPage.evaluate(() => {
    const nodes = [...document.querySelectorAll('*')].filter((node) => (node.textContent ?? '').trim().startsWith('E2E Fixture') || (node.textContent ?? '').trim().startsWith('Untitled') || (node.textContent ?? '').trim().startsWith('未命名'))
    const target = nodes[nodes.length - 1]
    if (target === undefined) return
    for (let node = target, depth = 0; node !== null && depth < 6; node = node.parentElement, depth += 1) {
      node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      node.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      node.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
    }
  })
  await enPage.waitForTimeout(2000)
  const enEntry = enPage.locator('[data-testid=token-dash-sidebar-entry]')
  await enEntry.waitFor({ timeout: 15000 })
  await jsClick(enEntry.first())
  const enBoard = enPage.locator('[data-testid=token-dash-board]')
  await enBoard.waitFor({ timeout: 10000 })
  await enPage.waitForTimeout(600)
  // 英文标题必须走词典，不能残留中文
  assert.match(await enBoard.getByTestId('token-dash-trend-title').innerText(), /Trend · /)
  assert.equal((await enBoard.getByTestId('token-dash-trend-title').innerText()).includes('使用趋势'), false, 'English title must not fall back to Chinese')
  assert.match(await enBoard.getByTestId('token-dash-card-requests').innerText(), /Total requests/)
  // 轴刻度不得出现中文单位「万 / 亿」
  const enAxisText = await enBoard.getByTestId('token-dash-trend')
    .evaluate((node) => [...node.querySelectorAll('span')].map((item) => item.textContent ?? '').join(' '))
  assert.equal(/[万亿]/.test(enAxisText), false, `English axis must use K/M/B, got: ${enAxisText.slice(0, 120)}`)
  await enPage.close()

  console.log('[e2e] UI assertions passed')

  // L4 真实调用采样（opt-in）：用真实 Key 发一次极短请求，再走本仓计价链验证可出价。
  // 默认跳过；限额与安全约束见 docs/plan/active/feature_third_party_provider_pricing.md §5.1。
  if (process.env.TOKEN_DASH_E2E_LIVE === '1') {
    const key = process.env.DSH_E2E_LIVE_KEY
    const baseUrl = (process.env.DSH_E2E_LIVE_BASE_URL ?? 'https://api.deepseek.com').replace(/\/+$/, '')
    const liveModel = process.env.DSH_E2E_LIVE_MODEL ?? 'deepseek-v4.1-flash'
    assert.ok(typeof key === 'string' && key !== '', 'DSH_E2E_LIVE_KEY is required when TOKEN_DASH_E2E_LIVE=1')
    const started = Date.now()
    const live = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: liveModel, messages: [{ role: 'user', content: 'ping' }], max_tokens: 8, stream: false }),
      signal: AbortSignal.timeout(30000),
    })
    assert.equal(live.status, 200, `live call failed: http-${live.status}`)
    const payload = await live.json()
    assert.ok(!JSON.stringify(payload).includes(key), 'provider response must not echo the key')
    const usage = payload?.usage ?? {}
    const tokens = Number(usage.prompt_tokens ?? 0) + Number(usage.completion_tokens ?? 0)
    assert.ok(tokens > 0, 'live call should report token usage')
    const quote = resolvePrice(liveModel, 'live-sample', Date.now())
    assert.ok(quote !== null, `live model ${liveModel} must be priceable`)
    assert.ok(quote.input > 0 && quote.output > 0, 'live quote must carry real prices')
    const cost = (Number(usage.prompt_tokens ?? 0) * quote.input + Number(usage.completion_tokens ?? 0) * quote.output) / 1e6
    console.log(`[e2e] L4 live ok model=${liveModel} tokens=${tokens} cost=${cost.toFixed(6)} ${quote.currency} table=${quote.table} ms=${Date.now() - started}`)
  } else {
    console.log('[e2e] L4 live sampling skipped (set TOKEN_DASH_E2E_LIVE=1 to enable)')
  }
} finally {
  await browser?.close().catch(() => {})
  stopTree(server?.child)
  if (!keep) rmSync(home, { recursive: true, force: true })
}