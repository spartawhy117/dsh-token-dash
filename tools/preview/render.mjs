/**
 * 预览渲染器：模板 + spec → 单文件 HTML（默认）；需要静态图时再截 PNG。
 *
 * 用法：
 *   node tools/preview/render.mjs [template] [--png] [--scale <n>] [--publish]
 *   npm run preview ring              # 只生成 .tmp/preview/ring.html，在 IDE 里直接预览
 *   npm run preview ring -- --png     # 额外输出 ring.png
 *   npm run preview:publish ring      # PNG 写 docs/pic（隐含 --png）
 *
 * 默认不截图：IDE 的内置预览/实时预览比截图更接近真实渲染，也省一次 Playwright 启动。
 * HTML 与 PNG 都写 .tmp/preview/（不入库）；--publish 时 PNG 另写 docs/pic。
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { SPEC, cardWidth, columnCount } from './spec.mjs'

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(name)
const value = (name, fallback) => {
  const index = argv.indexOf(name)
  return index === -1 ? fallback : argv[index + 1]
}

let template = 'ring'
for (let index = 0; index < argv.length; index += 1) {
  const item = argv[index]
  if (item === '--scale') { index += 1; continue }
  if (!item.startsWith('--')) { template = item; break }
}

const publish = flag('--publish')
const wantPng = flag('--png') || publish
const scale = Number(value('--scale', '2')) || 2
const columns = columnCount()
const card = cardWidth(SPEC.layout.contentWidth, columns, SPEC.layout.gap)

const css = [
  `--content-width: ${SPEC.layout.contentWidth}px;`,
  `--layout-gap: ${SPEC.layout.gap}px;`,
  `--space-1: ${SPEC.spacing.xxs}px;`,
  `--space-2: ${SPEC.spacing.xs}px;`,
  `--space-3: ${SPEC.spacing.sm}px;`,
  `--space-4: ${SPEC.spacing.md}px;`,
  `--space-5: ${SPEC.spacing.lg}px;`,
  `--space-6: ${SPEC.spacing.xl}px;`,
  `--card-width: ${card}px;`,
  `--card-min: ${SPEC.layout.minCard}px;`,
  `--card-max: ${SPEC.layout.maxCard}px;`,
  `--card-radius: ${SPEC.card.radius}px;`,
  `--card-padding: ${SPEC.card.padding}px;`,
  `--card-header-font: ${SPEC.card.headerFont}px;`,
  `--card-chip-font: ${SPEC.card.chipFont}px;`,
  `--gauge-ring: ${SPEC.gauge.ring}px;`,
  `--gauge-stroke: ${SPEC.gauge.stroke}px;`,
  `--gauge-label: ${SPEC.gauge.label}px;`,
  `--gauge-percent: ${SPEC.gauge.percent}px;`,
  `--gauge-meta: ${SPEC.gauge.meta}px;`,
  `--gauge-gap: ${SPEC.gauge.gap}px;`,
  `--gauge-percent-offset: ${SPEC.gauge.percentOffset}px;`,
  `--api-ring: ${SPEC.apiGauge.ring}px;`,
  `--api-stroke: ${SPEC.apiGauge.stroke}px;`,
  `--inline-font: ${SPEC.inlineRing.font}px;`,
  `--inline-gap: ${SPEC.inlineRing.gap}px;`,
  `--summary-font: ${SPEC.summary.font}px;`,
  `--summary-sub: ${SPEC.summary.subFont}px;`,
  `--trend-height: ${SPEC.trend.height}px;`,
  `--trend-axis-pad: ${SPEC.trend.axisPadLeft}px;`,
  `--trend-tick-h: ${SPEC.trend.tickHeight}px;`,
  `--trend-bar-max: ${SPEC.trend.barMax}px;`,
  `--trend-bar-radius: ${SPEC.trend.barRadius}px;`,
  `--trend-bar-gap: ${SPEC.trend.barGap}px;`,
  `--trend-tick-font: ${SPEC.trend.tickFont}px;`,
].join('\n    ')

// 支持 `drafts/<name>`：探索稿放 drafts/，定稿移 templates/；输出统一加 draft- 前缀避免撞名
const isDraft = template.startsWith('drafts/')
const name = isDraft ? template.slice('drafts/'.length) : template
const outName = isDraft ? `draft-${name}` : name
const searchDirs = isDraft ? ['drafts'] : ['templates', 'drafts']
const templatePath = searchDirs
  .map((dir) => resolve('tools/preview', dir, `${name}.html`))
  .find((candidate) => existsSync(candidate))
if (templatePath === undefined) throw new Error(`template not found: ${name}.html（templates/ 或 drafts/）`)

const baseCssPath = resolve('tools/preview/templates/_base.css')
const baseCss = existsSync(baseCssPath) ? readFileSync(baseCssPath, 'utf8') : ''

const ringJsPath = resolve('tools/preview/templates/_ring.js')
const ringJs = existsSync(ringJsPath) ? readFileSync(ringJsPath, 'utf8') : ''

const html = readFileSync(templatePath, 'utf8')
  .replace('/*__SPEC_CSS__*/', css)
  .replace('/*__BASE_CSS__*/', baseCss)
  .replace('/*__RING_JS__*/', ringJs)
  .replace('/*__SPEC_JSON__*/', JSON.stringify({ ...SPEC, resolvedCardWidth: card, columns }))

const tmpDir = resolve('.tmp/preview')
mkdirSync(tmpDir, { recursive: true })
const htmlPath = join(tmpDir, `${outName}.html`)
writeFileSync(htmlPath, html)
console.log(`[preview] ${outName} → ${htmlPath}`)

if (!wantPng) {
  console.log('[preview] 直接在 IDE 中预览该 HTML；需要静态图时加 --png')
} else {
  // 只在需要截图时加载 playwright，HTML 预览不必付启动成本
  const { chromium } = await import('playwright')
  const executablePath = (() => {
    try {
      const bundled = chromium.executablePath()
      if (existsSync(bundled)) return bundled
    } catch { /* fall through */ }
    const base = join(process.env.LOCALAPPDATA ?? '', 'ms-playwright')
    if (!existsSync(base)) return undefined
    return readdirSync(base)
      .filter((entry) => /^chromium-\d+$/.test(entry))
      .sort((left, right) => Number(right.split('-')[1]) - Number(left.split('-')[1]))
      .map((entry) => join(base, entry, 'chrome-win64', 'chrome.exe'))
      .find((candidate) => existsSync(candidate))
  })()

  const browser = await chromium.launch(executablePath === undefined ? {} : { executablePath })
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 }, deviceScaleFactor: scale })
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' })
  await page.waitForTimeout(300)
  // 按内容高度收紧视口，避免截图底部大片空白
  const contentHeight = await page.evaluate(() => {
    const pageNode = document.querySelector('.page')
    const bottom = pageNode === null ? 0 : pageNode.getBoundingClientRect().bottom
    return Math.ceil(bottom + 24)
  })
  await page.setViewportSize({ width: 1000, height: Math.max(200, contentHeight) })
  await page.waitForTimeout(100)
  const pngPath = join(tmpDir, `${outName}.png`)
  await page.screenshot({ path: pngPath, fullPage: true })
  await browser.close()
  console.log(`[preview] png → ${pngPath} (${card}px × ${columns} 列, ${scale}x)`)

  if (publish) {
    const target = resolve('docs/pic', `${outName}.png`)
    mkdirSync(resolve('docs/pic'), { recursive: true })
    copyFileSync(pngPath, target)
    console.log(`[preview] published → ${target}`)
  }
}
