/**
 * npm 下载统计：近期版本的 7 日安装量、发布后 24h / 48h 下载，报告落盘到 npm-reports/。
 *
 * Usage: node scripts/npm-stats.mjs [--versions 3] [--days 30] [--pkg dsh-token-dash] [--out <file>] [--stdout] [--json]
 *
 * 只读 npm registry 与 api.npmjs.org 的公开接口，不采集任何用户数据；
 * npm 的下载按 UTC 日统计，且当日通常尚未结算（显示为 —）。
 *
 * 口径：versions/last-week 只给「版本 × 最近 7 天」的合计，没有按天拆分，
 * 所以「发布后 24h / 48h」用发布日起的整日全包下载累加近似（只有该日恰好只发一个版本时才精确）。
 * 数据未结算时写「数据暂未更新」，不按 0 计入。
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const REGISTRY = 'https://registry.npmjs.org'
const STATS = 'https://api.npmjs.org'
const TIMEOUT_MS = 8000
const RETRY = 1
/** 首发后多少天视为冷启动：这段日子的下载是首发曝光，不进基线也不进更新波峰。 */
const LAUNCH_WARMUP_DAYS = 7
/** 发布后 24h 内会主动更新的用户占比区间：把更新波峰折算成装机基数的分母。 */
const PROMPT_SHARE = { min: 0.6, max: 0.7 }
/** 默认展示的近期版本数。 */
const RECENT_VERSIONS = 3
/** 默认报告目录：仓库根下的本地输出目录（见 .gitignore，不入库）。 */
const DEFAULT_OUT_DIR = 'npm-reports'
/** npm 统计落后于发布时的提示文案。 */
const PENDING = '数据暂未更新'

/** ISO 时间 → UTC 日期（YYYY-MM-DD）；无效输入返回 null。 */
export function utcDay(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

/** UTC 日期字符串 → 加减天数后的日期字符串。 */
export function addDays(day, amount) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + amount * 86400000).toISOString().slice(0, 10)
}

/** 中位数；空数组返回 null。 */
export function median(values) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((left, right) => left - right)
  if (sorted.length === 0) return null
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

/** registry 的 time 字段 → 发布日 Map<UTC 日期, 版本[]>；跳过 created/modified 等非版本键。 */
export function collectReleases(times) {
  const releases = new Map()
  for (const [version, publishedAt] of Object.entries(times ?? {})) {
    if (!/^\d+\.\d+\.\d+/.test(version)) continue
    const day = utcDay(publishedAt)
    if (day === null) continue
    if (!releases.has(day)) releases.set(day, [])
    releases.get(day).push(version)
  }
  return releases
}

/** 按发布时间倒序的版本列表（只保留 X.Y.Z 开头的正式版本键）。 */
export function sortedVersions(times) {
  return Object.entries(times ?? {})
    .filter(([version]) => /^\d+\.\d+\.\d+/.test(version))
    .sort((left, right) => Date.parse(right[1]) - Date.parse(left[1]))
    .map(([version, publishedAt]) => ({ version, publishedAt }))
}

/** 基线：非发布日的下载中位数（发布日会被更新波峰抬高，不能进基线）；from 之后才统计。 */
export function pickBaseline(daily, releases, { from = null } = {}) {
  const values = daily
    .filter((row) => row.downloads !== null && !releases.has(row.day) && (from === null || row.day >= from))
    .map((row) => row.downloads)
  return median(values)
}

/** 每个发布日超出基线的下载量，即「存量用户更新」的近似规模。 */
export function releaseWaves(daily, releases, baseline, { from = null } = {}) {
  const waves = []
  for (const row of daily) {
    const versions = releases.get(row.day)
    if (versions === undefined || row.downloads === null || baseline === null) continue
    if (from !== null && row.day < from) continue
    waves.push({ day: row.day, versions, downloads: row.downloads, excess: row.downloads - baseline })
  }
  return waves
}

/**
 * 启发式估算（跳过首发冷启动期）：
 * - 活跃更新用户 ≈ 发布日超额下载的中位（发布后 24h 内会更新的人）
 * - 装机基数 ≈ 波峰 ÷ 主动更新比例（60%–70%），得到区间
 */
export function estimate(daily, releases, { warmupDays = LAUNCH_WARMUP_DAYS } = {}) {
  const firstDay = [...releases.keys()].sort()[0] ?? null
  const from = firstDay === null ? null : addDays(firstDay, warmupDays)
  let baseline = pickBaseline(daily, releases, { from })
  if (baseline === null) baseline = pickBaseline(daily, releases)
  const waves = releaseWaves(daily, releases, baseline, { from })
  const positives = waves.filter((wave) => wave.excess > 0).map((wave) => wave.excess)
  const active = median(positives)
  const peak = positives.length === 0 ? null : Math.max(...positives)
  return {
    baseline,
    warmupFrom: from,
    waves,
    active: active === null ? null : Math.round(active),
    peak,
    installLow: active === null ? null : Math.round(active / PROMPT_SHARE.max),
    installHigh: peak === null ? null : Math.round(peak / PROMPT_SHARE.min),
    // 可用的更新波峰少于 2 个时，估算是噪声
    enough: positives.length >= 2,
  }
}

/**
 * 单日覆盖度：某天的下载里有几成属于「它的 7 日窗口覆盖 7 个完整 UTC 日」。
 * last-week 只累计到最近一个完整日，发布日落在窗口边缘时会被截断。
 */
export function coverageOf(day, { today, lastSettledDay }) {
  if (day > lastSettledDay) return 0
  if (day < addDays(lastSettledDay, -6)) return 0
  return (Date.parse(lastSettledDay) - Date.parse(day)) / 86400000 / 6
}

/**
 * 一个版本发布后若干天内累计的全包下载。
 * settledDays 只有发布日当天可用时，48h 无法得出 → pending，由报告写「数据暂未更新」。
 */
export function launchWindow({ releaseDay, dailyByDay, days }) {
  const out = []
  for (let offset = 0; offset < days; offset += 1) {
    const day = addDays(releaseDay, offset)
    const value = dailyByDay.get(day)
    out.push({ day, downloads: value === undefined || value === null ? null : value })
  }
  return out
}

/**
 * 近期版本的 7 日安装量 + 发布后 24h / 48h 下载，按发布时间倒序。
 * weekByVersion 为 Map<版本, 近 7 天下载>；dailyByDay 为 Map<UTC 日期, 当日全包下载|null>。
 */
export function recentVersions({
  times = {},
  weekByVersion = new Map(),
  dailyByDay = new Map(),
  latest = null,
  count = RECENT_VERSIONS,
  today,
  lastSettledDay,
}) {
  return sortedVersions(times)
    .slice(0, count)
    .map(({ version, publishedAt }) => {
      const releaseDay = utcDay(publishedAt)
      const releasesOnDay = Object.entries(times).filter(
        ([other]) => /^\d+\.\d+\.\d+/.test(other) && utcDay(times[other]) === releaseDay,
      )
      const settled = releaseDay !== null && releaseDay <= lastSettledDay
      // 同一 UTC 日发了多个版本时，当日下载含多个版本，不能当成单版本安装量
      const exact = settled && releasesOnDay.length === 1
      const d1 = launchWindow({ releaseDay: releaseDay ?? today, dailyByDay, days: 1 })
      const d2 = launchWindow({ releaseDay: releaseDay ?? today, dailyByDay, days: 2 })
      const sum = (rows) => (rows.every((row) => row.downloads !== null) ? rows.reduce((acc, row) => acc + row.downloads, 0) : null)
      const window24 = settled ? sum(d1) : null
      const window48 = settled ? sum(d2) : null
      return {
        version,
        latest: version === latest,
        publishedAt,
        releaseDay,
        ageDays: releaseDay === null ? null : Math.round((Date.parse(today) - Date.parse(releaseDay)) / 86400000),
        week: weekByVersion.get(version) ?? null,
        launchDay: settled && d1[0].downloads !== null ? d1[0].downloads : null,
        launchDayVersions: releasesOnDay.map(([other]) => other),
        launchExact: exact,
        window24,
        window48,
        // 发布日已结算但次日未结算：48h 还没数据
        pending48: settled && window48 === null,
        coverage: releaseDay === null ? 0 : coverageOf(releaseDay, { today, lastSettledDay }),
      }
    })
}

const fmt = (value) => (value === null || value === undefined ? '—' : Number(value).toLocaleString('en-US'))
const signed = (value) => (value > 0 ? `+${fmt(value)}` : fmt(value))
const shortDay = (day) => day.slice(5)
const releaseLabel = (versions) =>
  versions.length > 3 ? `${versions.slice(0, 3).join(' / ')} 等 ${versions.length} 个` : versions.join(' / ')
/** 24h / 48h 单元格：未结算写「数据暂未更新」。 */
const windowCell = (row, value) => {
  if (value !== null && value !== undefined) return row.launchExact ? fmt(value) : `${fmt(value)} ⚠`
  return PENDING
}

/** 渲染 Markdown 报告（默认写入 npm-reports/）。 */
export function renderMarkdown(model) {
  const { pkg, generatedAt, start, end, today, lastSettledDay, firstDay, totals, recent, daily, releases, estimate: est } = model
  const lines = []
  lines.push(`# ${pkg} 下载统计`, '')
  lines.push(`> 生成于 ${generatedAt} · 数据结算到 ${lastSettledDay ?? '—'}（UTC）· 来源 npm registry + api.npmjs.org`, '')

  lines.push(`## 近期 ${recent.length} 个版本`, '')
  if (recent.length === 0) {
    lines.push('registry 里没有可用的版本时间。', '')
  } else {
    lines.push('| 版本 | 发布后 24h | 发布后 48h | 7 日安装量 | 发布日 |', '| --- | ---: | ---: | ---: | --- |')
    for (const row of recent) {
      const tags = row.latest ? '（latest）' : ''
      lines.push(
        `| ${row.version}${tags} | ${windowCell(row, row.window24)} | ${windowCell(row, row.window48)} | ${fmt(row.week)} | ${row.releaseDay ?? '—'} |`,
      )
    }
    lines.push('')
    lines.push(`> 「发布后 24h / 48h」= 发布当天起 1 / 2 个 UTC 日的全包下载累计；数据未结算时写「${PENDING}」，不按 0 计入。该日同时发布多个版本时标 ⚠（含同期其他版本）。`)
    lines.push('> 「7 日安装量」= 该版本在最近 7 个完整 UTC 日的 tarball 下载次数；发布不满 7 天的版本只累计到已结算日，实际天数少于 7 天，数值偏低。', '')
  }

  lines.push('## 总量', '', '| 指标 | 数值 |', '| --- | ---: |')
  lines.push(`| 近 7 天下载（全版本） | ${fmt(totals.week)} |`)
  lines.push(`| 窗口内下载（${start} ~ ${lastSettledDay ?? end}） | ${fmt(totals.window)} |`)
  if (totals.lastDay !== null) lines.push(`| 最近完整日（${totals.lastDay.day}） | ${fmt(totals.lastDay.downloads)} |`)
  if (est.baseline !== null) lines.push(`| 基线（非发布日中位） | ${fmt(est.baseline)}/天 |`)
  lines.push('')

  lines.push(`## 每日下载（${start} ~ ${end}，UTC）`, '', '| 日期 | 下载 | 相对基线 | 事件 |', '| --- | ---: | ---: | --- |')
  for (const row of daily) {
    if (firstDay !== null && row.day < firstDay) continue
    const released = releases.get(row.day)
    let event = released === undefined ? '' : `发布 ${releaseLabel(released)}`
    if (row.downloads === null) event = event === '' ? PENDING : `${PENDING}（${event}）`
    const excess = row.downloads === null || est.baseline === null ? '—' : signed(row.downloads - est.baseline)
    lines.push(`| ${shortDay(row.day)} | ${fmt(row.downloads)} | ${excess} | ${event} |`)
  }
  lines.push('')

  lines.push('## 估算（启发式，只看趋势）', '')
  if (est.active === null) {
    lines.push('- 窗口内没有可用于估算的发布日或基线，先积累几天数据再跑。', '')
  } else {
    lines.push(`- 统计起点：${est.warmupFrom ?? firstDay} 之后（首发 ${LAUNCH_WARMUP_DAYS} 天为冷启动，已排除）`)
    lines.push(`- 更新波峰：中位 ${fmt(est.active)} / 最大 ${fmt(est.peak)}（发布日超出基线的下载）`)
    lines.push(`- 活跃更新用户：约 ${fmt(est.active)}（发布后 24h 内会更新的人）`)
    lines.push(`- 装机基数：约 ${fmt(est.installLow)} – ${fmt(est.installHigh)}（按 60%–70% 的用户在 24h 内更新折算）`)
    if (!est.enough) lines.push('- 可用的发布日不足 2 个，估算只能当量级看。')
    lines.push('- 该区间只作趋势参考，不作为对外精确数字。', '')
  }

  lines.push('## 口径说明', '')
  lines.push('- 下载次数是 tarball 拉取次数，不是用户数：镜像同步、供应链扫描、重复安装都会计入。')
  lines.push('- 按版本的拆分接口（versions/last-week）只给最近 7 天的合计，没有按天拆分；历史分布需要定期运行本脚本归档。')
  lines.push(`- npm 结算滞后约 2 天：今日 ${today} 与更晚的日期显示为「${PENDING}」，不参与任何合计。`)
  lines.push(`- 本报告写入 ${DEFAULT_OUT_DIR}/（本地输出目录，不入库）。`)
  lines.push('- 7 日安装量包含镜像回源与重试，长尾版本（发布超过 7 天仍被拉）尤其如此。', '')

  lines.push('## 数据源', '')
  lines.push(`- ${REGISTRY}/${pkg}`)
  lines.push(`- ${STATS}/versions/${pkg}/last-week`)
  lines.push(`- ${STATS}/downloads/range/${start}:${end}/${pkg}`)
  return `${lines.join('\n')}\n`
}

async function fetchJson(url, label) {
  let lastError = null
  for (let attempt = 0; attempt <= RETRY; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) })
      if (response.status === 404) return { notFound: true }
      if (!response.ok) throw new Error(`http-${response.status}`)
      return { data: await response.json() }
    } catch (error) {
      lastError = error
      if (attempt < RETRY) await new Promise((done) => setTimeout(done, 600))
    }
  }
  throw new Error(`${label} 请求失败：${lastError?.message ?? lastError}`)
}

export function parseArgs(argv) {
  const options = { days: 30, pkg: null, out: null, json: false, stdout: false, versions: RECENT_VERSIONS }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--json') options.json = true
    else if (arg === '--stdout') options.stdout = true
    else if (arg === '--days') options.days = Number.parseInt(argv[++index], 10)
    else if (arg === '--versions') options.versions = Number.parseInt(argv[++index], 10)
    else if (arg === '--pkg') options.pkg = argv[++index]
    else if (arg === '--out') options.out = argv[++index]
    else throw new Error(`未知参数：${arg}`)
  }
  if (options.pkg !== null && (typeof options.pkg !== 'string' || options.pkg === '')) throw new Error('--pkg 需要包名')
  if (options.out !== null && (typeof options.out !== 'string' || options.out === '')) throw new Error('--out 需要文件路径')
  if (!Number.isInteger(options.days) || options.days < 7 || options.days > 365) throw new Error('--days 需为 7–365 的整数')
  if (!Number.isInteger(options.versions) || options.versions < 1 || options.versions > 20) throw new Error('--versions 需为 1–20 的整数')
  return options
}

/** 组装统计模型：近期版本表、日线、发布日与估算。weekDownloads 为 [版本, 下载] 有序对。 */
export function buildModel({ pkg, registry, weekDownloads, rangeDownloads, days, versions: versionCount = RECENT_VERSIONS, now = new Date() }) {
  const today = utcDay(now)
  const start = addDays(today, -(days - 1))
  const times = registry?.time ?? {}
  const releases = collectReleases(times)
  const latest = registry?.['dist-tags']?.latest ?? null

  const daily = rangeDownloads.map((row) => ({
    day: row.day,
    // 当日 0 视为尚未结算，避免把「今天还没统计」当成真实归零
    downloads: row.day === today && row.downloads === 0 ? null : row.downloads,
  }))
  const completeRows = daily.filter((row) => row.downloads !== null)
  const lastDay = completeRows.length === 0 ? null : completeRows[completeRows.length - 1]
  const lastSettledDay = lastDay === null ? null : lastDay.day

  const weekByVersion = new Map(weekDownloads)
  if (latest !== null && !weekByVersion.has(latest)) weekByVersion.set(latest, 0)
  const week = [...weekByVersion.values()].reduce((sum, value) => sum + value, 0)
  const dailyByDay = new Map(daily.map((row) => [row.day, row.downloads]))

  const recent = lastSettledDay === null
    ? []
    : recentVersions({ times, weekByVersion, dailyByDay, latest, count: versionCount, today, lastSettledDay })

  return {
    pkg,
    generatedAt: `${now.toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    start,
    end: today,
    today,
    lastSettledDay,
    firstDay: [...releases.keys()].sort()[0] ?? null,
    totals: { week, window: completeRows.reduce((sum, row) => sum + row.downloads, 0), lastDay },
    recent,
    daily,
    releases,
    estimate: estimate(daily, releases),
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const pkg = options.pkg ?? JSON.parse(readFileSync(resolve('package.json'), 'utf8')).name
  const now = new Date()
  const today = utcDay(now)
  const start = addDays(today, -(options.days - 1))

  const [registry, week, range] = await Promise.all([
    fetchJson(`${REGISTRY}/${encodeURIComponent(pkg)}`, 'registry'),
    fetchJson(`${STATS}/versions/${encodeURIComponent(pkg)}/last-week`, 'last-week'),
    fetchJson(`${STATS}/downloads/range/${start}:${today}/${encodeURIComponent(pkg)}`, 'range'),
  ])
  if (registry.notFound === true) throw new Error(`npm 上不存在 ${pkg}`)

  const weekDownloads = week.notFound === true || typeof week.data?.downloads !== 'object' ? [] : Object.entries(week.data.downloads)
  const rangeDownloads = range.notFound === true || !Array.isArray(range.data?.downloads) ? [] : range.data.downloads
  const model = buildModel({
    pkg,
    registry: registry.data ?? {},
    weekDownloads,
    rangeDownloads,
    days: options.days,
    versions: options.versions,
    now,
  })

  const output = options.json
    ? `${JSON.stringify({ ...model, releases: Object.fromEntries(model.releases) }, null, 2)}\n`
    : renderMarkdown(model)

  if (options.stdout) {
    process.stdout.write(output)
    return
  }
  // 默认落盘到 npm-reports/<pkg>-YYYY-MM-DD.<md|json>，该目录不入库
  const ext = options.json ? 'json' : 'md'
  const file = options.out !== null ? resolve(options.out) : resolve(DEFAULT_OUT_DIR, `${pkg}-${today}.${ext}`)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, output)
  console.log(`已写入 ${file}`)
}

const invokedDirectly = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (invokedDirectly) {
  main().catch((error) => {
    console.error(`[TD:stats] ${error?.message ?? error}`)
    process.exitCode = 1
  })
}
