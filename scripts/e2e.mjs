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
  model('zhipu', 'GLM Coding', 'glm-5.3', 'GLM-5.3', 'subscription', 'CNY', 0),
  model('moonshot', 'Kimi Coding', 'kimi-k3', 'Kimi K3', 'subscription', 'CNY', 0),
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
})
let failSummary = false
let failUsage = false
let summaryRequests = 0
let updateAvailable = false
let updateRequests = 0
let usageDelay = 0
const env = { ...process.env, DSH_HOME: home }
let server
let browser
try {
  run(['plugin', '--profile', 'web', 'add', `link:${root}`], env)
  mkdirSync(join(tmpRoot, 'e2e'), { recursive: true })
  const dataDir = join(home, 'dsh-token-dash')
  mkdirSync(dataDir, { recursive: true })
  const fixtureLines = readFileSync(join(root, 'test', 'fixtures', 'e2e-session.jsonl'), 'utf8').split(/\r?\n/).filter(Boolean)
  const fixtureHeader = JSON.parse(fixtureLines[0])
  const fixtureKey = `--${fixtureHeader.cwd.replace(':', '').replaceAll('\\', '-')}--`
  const fixtureDir = join(home, 'sessions', fixtureKey, fixtureHeader.id)
  mkdirSync(fixtureDir, { recursive: true })
  writeFileSync(join(fixtureDir, 'session.v4.jsonl.zstd'), Buffer.concat(fixtureLines.map((line) => zstdCompressSync(Buffer.from(`${line}\n`)))))
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
  assert.equal((await fetch(`${base}/token-dash/api/usage?range=bad`)).status, 400)

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
    const range = new URL(route.request().url()).searchParams.get('range') ?? 'today'
    if (usageDelay > 0) await new Promise((resolveDelay) => setTimeout(resolveDelay, usageDelay))
    if (failUsage) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, reason: 'mock-usage' }) })
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: usageFor(range) }) })
  })
  // /repo 不再请求：按钮只做跳转，不拦截该路由也能通过。
  await page.route('**/token-dash/api/update', (route) => {
    updateRequests += 1
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { published: true, hasUpdate: updateAvailable, latest: '9.9.9', current: PKG_VERSION } }) })
  })
  await page.route('**/open-in-app/open', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }))
  await page.route('**/token-dash/api/logs/export*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { content: '{"type":"header"}\n' } }) }))

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
  const fixtureTitle = (await page.getByText('E2E Fixture', { exact: true }).count()) > 0 ? 'E2E Fixture' : '未命名'
  await page.getByText(fixtureTitle, { exact: true }).first().evaluate((node) => node.click()).catch(() => {})
  await page.waitForTimeout(800)
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
  assert.ok(updateRequests >= 1, 'startup update check should run once')

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
  assert.equal(await board.locator('[data-testid^=token-dash-budget-gauge-label-]').count(), apiProviders.length)
  // Subscription cards: only actual windows (two-window providers have no month cell).
  const windowCount = subProviders.reduce((total, provider) => total + (provider.windows?.length ?? 0), 0)
  assert.equal(await board.locator('[data-testid^=token-dash-quota-cell-]').count(), windowCount)
  assert.match(await board.getByTestId('token-dash-quota-cell-moonshot-5h').innerText(), /96\.0%|96%/)
  assert.match(await board.getByTestId('token-dash-quota-cell-opencode-go-month').innerText(), /58\.0%|58%/)
  assert.match(await board.getByTestId('token-dash-quota-rel-opencode-go-month').innerText(), /天后|小时后|分钟后/)
  assert.match(await board.getByTestId('token-dash-quota-abs-opencode-go-month').innerText(), /\d{2}-\d{2} \d{2}:\d{2}/)
  // Summary band: two halves inside one bordered band, above the detail table.
  const cardCost = board.getByTestId('token-dash-card-cost')
  const cardTokens = board.getByTestId('token-dash-card-tokens')
  const [costBox, tokensBox] = await Promise.all([cardCost.boundingBox(), cardTokens.boundingBox()])
  assert.ok(costBox !== null && tokensBox !== null)
  assert.ok(tokensBox.x > costBox.x, 'tokens half should sit right of cost half')
  const bandBorder = await board.getByTestId('token-dash-range-cards').evaluate((node) => getComputedStyle(node).borderTopStyle)
  assert.equal(bandBorder, 'solid')
  const detailTable = board.getByTestId('token-dash-detail-table')
  const detailBox = await detailTable.boundingBox()
  assert.ok(detailBox !== null && costBox !== null && detailBox.y > costBox.y + costBox.height, 'detail table should be below summary band')
  assert.match(await detailTable.innerText(), /费用/)
  assert.equal(await board.locator('[data-testid^=token-dash-detail-row-]').count(), models.length)
  assert.equal(await board.getByTestId('token-dash-board-head-refresh').count(), 1)
  assert.match(await board.locator('[data-testid^=token-dash-detail-row-]').first().innerText(), /·/)

  // 费用列四态：≈ / 精确 / 未定价 / 零消耗 —
  const approxRow = board.getByTestId('token-dash-detail-row-tencent-deepseek-v4.1-flash-ioa')
  assert.match(await approxRow.innerText(), /≈¥1\.24/, 'fuzzy hit should carry ≈')
  const exactCell = board.getByTestId('token-dash-detail-row-siliconflow-deepseek-v4.1-flash').getByTestId('token-dash-detail-cost')
  assert.equal((await exactCell.innerText()).trim(), '¥1.24', 'exact hit must not carry ≈')
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

  // Update check restores the button after "up to date".
  const updateButton = board.getByTestId('token-dash-update')
  await updateButton.waitFor({ timeout: 5000 })
  await jsClick(updateButton)
  await page.waitForTimeout(250)
  assert.match(await board.innerText(), /已是最新/)
  assert.equal(await updateButton.isEnabled(), true)
  updateAvailable = true
  await jsClick(updateButton)
  await page.waitForTimeout(250)
  assert.match(await board.innerText(), /发现 9\.9\.9/)
  await jsClick(board.getByRole('button', { name: '取消' }))
  updateAvailable = false

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
