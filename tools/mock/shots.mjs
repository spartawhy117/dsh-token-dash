/**
 * 生成 README 截图：临时 DSH_HOME + web profile + 假数据注入，不读真实账本。
 *
 * 用法：npm run shots [-- --keep] [-- --en]
 * 产物：docs/pic/panel-api.png、panel-sub-2.png、panel-sub-3.png（P2 三种形态）、
 *       settings.png（P3 整页）、pill-api.png / pill-sub.png
 *       --en 输出 docs/pic/en/，供 README.en.md 使用
 */
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright'
import { zstdCompressSync } from 'node:zlib'
import { prefs, summary, summarySubThreeWindows, summarySubTwoWindows, usageFor } from './fixtures.mjs'

const root = resolve('.')
const keep = process.argv.includes('--keep')
const english = process.argv.includes('--en')
const tmpRoot = join(root, '.tmp')
const home = join(tmpRoot, `shots-home-${Date.now()}`)
const outDir = join(root, 'docs', 'pic', english ? 'en' : '')
const pageLocale = english ? 'en-US' : 'zh-CN'
const appRoot = process.env.DSH_APP_ROOT ?? join(process.env.LOCALAPPDATA ?? '', 'Programs', 'DeepSeek Harness')
const exe = join(appRoot, 'DeepSeek Harness.exe')
const cliJs = join(appRoot, 'resources', 'app.asar', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-desktop-host', 'lib', 'cli.js')
mkdirSync(home, { recursive: true })
mkdirSync(outDir, { recursive: true })
if (!existsSync(exe)) throw new Error(`DSH executable not found: ${exe} (set DSH_APP_ROOT)`)

const env = { ...process.env, DSH_HOME: home, ELECTRON_RUN_AS_NODE: '1' }

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

function startWeb() {
  const child = spawn(exe, ['--expose-internals', cliJs, '--profile', 'web', '--port', '0', '--no-open'], { env, windowsHide: true })
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
  return { child, ready }
}

function stopTree(child) {
  if (child?.pid === undefined) return
  try { execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' }) } catch { child.kill() }
}

let server
let browser
try {
  execFileSync(exe, ['--expose-internals', cliJs, 'plugin', '--profile', 'web', 'add', `link:${root}`], { env, encoding: 'utf8' })
  const fixtureLines = readFileSync(join(root, 'test', 'fixtures', 'e2e-session.jsonl'), 'utf8').split(/\r?\n/).filter(Boolean)
  const fixtureHeader = JSON.parse(fixtureLines[0])
  const fixtureKey = `--${fixtureHeader.cwd.replace(':', '').replaceAll('\\', '-')}--`
  const fixtureDir = join(home, 'sessions', fixtureKey, fixtureHeader.id)
  mkdirSync(fixtureDir, { recursive: true })
  writeFileSync(join(fixtureDir, 'session.v4.jsonl.zstd'), Buffer.concat(fixtureLines.map((line) => zstdCompressSync(Buffer.from(`${line}\n`)))))
  server = startWeb()
  const { base, token } = await server.ready
  console.log(`[shots] web ${base}`)

  const seeded = await fetch(`${base}/token-dash/api/prefs`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(prefs),
  })
  if (seeded.status !== 200) throw new Error(`prefs seed failed: ${seeded.status}`)

  const executablePath = resolveChromium()
  browser = await chromium.launch({ headless: true, ...(executablePath === undefined ? {} : { executablePath }) })
  const page = await browser.newPage({ viewport: { width: 1280, height: 1100 }, deviceScaleFactor: 2, locale: pageLocale })

  let activeSummary = summary
  await page.route('**/token-dash/api/summary*', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: activeSummary }),
  }))
  await page.route('**/token-dash/api/usage*', (route) => {
    const range = new URL(route.request().url()).searchParams.get('range') ?? 'today'
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: usageFor(range) }) })
  })
  await page.route('**/token-dash/api/update', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { published: true, hasUpdate: false, latest: '1.1.0', current: '1.1.0' } }),
  }))
  await page.route('**/open-in-app/open', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }))

  await page.goto(`${base}/?token=${token}`, { waitUntil: 'domcontentloaded' })
  // 关掉宿主首次引导遮罩
  for (let round = 0; round < 4; round += 1) {
    await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('[role=presentation] button')]
      const next = buttons.find((button) => /继续|跳过|稍后|关闭|Continue|Skip|Later|Close/i.test(button.textContent ?? ''))
      if (next !== undefined) next.click()
    })
    await page.waitForTimeout(200)
  }
  await page.evaluate(() => {
    for (const node of document.querySelectorAll('[role=presentation]')) node.remove()
  })
  // 与 P1 截图一致：深色主题
  await page.evaluate(() => document.body.setAttribute('data-ds-dark-theme', '1'))
  await page.waitForTimeout(300)

  const openFixtureSession = async () => {
    for (const title of ['E2E Fixture', '未命名', 'Untitled']) {
      const candidate = page.getByText(title, { exact: true }).first()
      if (await candidate.count() > 0) {
        await candidate.evaluate((node) => node.click()).catch(() => {})
        return
      }
    }
  }
  await page.waitForTimeout(1200)
  await openFixtureSession()
  await page.waitForTimeout(1200)
  const pill = page.locator('[data-testid=token-dash-pill]')
  await pill.waitFor({ timeout: 20000 })
  const jsClick = (locator) => locator.evaluate((node) => node.click())

  await jsClick(pill)

  const panel = page.locator('[data-testid=token-dash-panel]')
  await panel.waitFor({ timeout: 8000 })
  // 宿主可能弹出登录/引导浮层，截图前清掉非看板自身的弹层
  await page.evaluate(() => {
    for (const node of document.querySelectorAll('[role=dialog],[role=presentation]')) {
      if (node.matches('[data-testid=token-dash-panel]')) continue
      if (node.querySelector('[data-testid=token-dash-panel]') !== null) continue
      node.remove()
    }
  })
  // 截图需要完整内容：解除 70vh 限高并临时固定到左上角，否则面板会超出视口导致空白
  await page.addStyleTag({
    content: '[data-testid=token-dash-panel]{position:fixed !important;top:8px !important;left:8px !important;bottom:auto !important;max-height:none !important;overflow:visible !important}',
  })
  await page.waitForTimeout(300)

  // API 形态：切到近 30 天，让表内数据更完整
  await jsClick(panel.getByRole('tab', { name: /近30天|Last 30 days/ }))
  await page.waitForTimeout(600)
  await panel.screenshot({ path: join(outDir, 'panel-api.png') })
  console.log('[shots] panel-api.png')

  // 整页看板截图放到最后（切走中栏后 pill 不再可见）

  // P1 Pill（按量形态）：面板固定在左上角，pill 仍在底栏可见
  const shotPill = async (file) => {
    // 面板固定在左上角且高于底栏，截图 pill 前先藏起来；同时清掉宿主弹层并强制深色
    await page.evaluate(() => {
      document.body.setAttribute('data-ds-dark-theme', '1')
      const panel = document.querySelector('[data-testid=token-dash-panel]')
      if (panel !== null) panel.style.display = 'none'
      for (const node of document.querySelectorAll('[role=dialog],[role=presentation],[aria-modal=true]')) {
        if (node.matches('[data-testid=token-dash-panel]')) continue
        if (node.querySelector('[data-testid=token-dash-panel]') !== null) continue
        node.remove()
      }
    })
    const target = page.locator('[data-testid=token-dash-pill]')
    await target.waitFor({ timeout: 10000 })
    await target.scrollIntoViewIfNeeded()
    const box = await target.boundingBox()
    if (box === null) throw new Error(`pill box missing for ${file}`)
    // 按 pill 实际宽度加 20px 内边距裁切，避免裁到相邻的宿主控件
    await page.screenshot({
      path: join(outDir, file),
      clip: { x: Math.max(0, box.x - 20), y: Math.max(0, box.y - 20), width: box.width + 40, height: box.height + 40 },
    })
    console.log(`[shots] ${file}`)
  }
  await shotPill('pill-api.png')

  // 订阅形态（两窗 / 三窗）：换 fixture → 重载 → 打开浮层 → 截图
  const captureSubPanel = async (data, file) => {
    activeSummary = data
    await page.reload({ waitUntil: 'domcontentloaded' })
    for (let round = 0; round < 4; round += 1) {
      await page.evaluate(() => {
        const buttons = [...document.querySelectorAll('[role=presentation] button,[role=dialog] button')]
        const next = buttons.find((button) => /继续|跳过|稍后|关闭|Continue|Skip|Later|Close/i.test(button.textContent ?? ''))
        if (next !== undefined) next.click()
        })
        await page.waitForTimeout(200)
        }
        await page.waitForTimeout(700)
        await page.evaluate(() => {
        document.body.setAttribute('data-ds-dark-theme', '1')
        for (const node of document.querySelectorAll('[role=dialog],[role=presentation]')) node.remove()
        })
        await openFixtureSession()
        await page.waitForTimeout(800)
    const target = page.locator('[data-testid=token-dash-pill]')
    await target.waitFor({ timeout: 15000 })
    await jsClick(target)
    const node = page.locator('[data-testid=token-dash-panel]')
    await node.waitFor({ timeout: 8000 })
    await page.addStyleTag({
      content: '[data-testid=token-dash-panel]{position:fixed !important;top:8px !important;left:8px !important;bottom:auto !important;max-height:none !important;overflow:visible !important}',
    })
    await page.waitForTimeout(600)
    await node.screenshot({ path: join(outDir, file) })
    console.log(`[shots] ${file}`)
  }

  await captureSubPanel(summarySubTwoWindows, 'panel-sub-2.png')
  await shotPill('pill-sub.png')
  await captureSubPanel(summarySubThreeWindows, 'panel-sub-3.png')

  // 整页看板：先切回全量数据（七家），再从侧栏入口进中栏整页
  activeSummary = summary
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(900)
  await page.evaluate(() => {
    for (const node of document.querySelectorAll('[role=presentation]')) node.remove()
    document.body.setAttribute('data-ds-dark-theme', '1')
  })
  await page.waitForTimeout(400)
  const entry = page.locator('[data-testid=token-dash-sidebar-entry]')
  await entry.waitFor({ timeout: 10000 })
  await jsClick(entry.first())
  const board = page.locator('[data-testid=token-dash-board]')
  await board.waitFor({ timeout: 10000 })
  await page.waitForTimeout(600)
  // 元素截图会拼接滚动区域：胶囊改静态，整体缩放以在固定视口内完整呈现
  await page.addStyleTag({
    content: '[data-testid=token-dash-settings-capsule]{position:static !important}[data-testid=token-dash-board]{zoom:.72}',
  })
  await page.waitForTimeout(300)
  await board.screenshot({ path: join(outDir, 'settings.png') })
  console.log('[shots] settings.png')
} finally {
  await browser?.close().catch(() => {})
  stopTree(server?.child)
  if (!keep) rmSync(home, { recursive: true, force: true })
}
