/**
 * npm 下载统计：版本分布、每日曲线、发布日增量与启发式装机估算。
 *
 * Usage: node scripts/npm-stats.mjs [--days 30] [--pkg dsh-token-dash] [--out <file>] [--json]
 *
 * 只读 npm registry 与 api.npmjs.org 的公开接口，不采集任何用户数据；
 * npm 的下载按 UTC 日统计，且当日通常尚未结算（显示为 —）。
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

const fmt = (value) => (value === null || value === undefined ? '—' : Number(value).toLocaleString('en-US'))
const pct = (part, total) => (total > 0 ? `${((part / total) * 100).toFixed(1)}%` : '—')
const signed = (value) => (value > 0 ? `+${fmt(value)}` : fmt(value))
const shortDay = (day) => day.slice(5)
const releaseLabel = (versions) =>
  versions.length > 3 ? `${versions.slice(0, 3).join(' / ')} 等 ${versions.length} 个` : versions.join(' / ')

/** 渲染 Markdown 报告（stdout / --out 用）。 */
export function renderMarkdown(model) {
  const { pkg, generatedAt, start, end, firstDay, totals, versions, daily, releases, estimate: est } = model
  const lines = []
  lines.push(`# ${pkg} 下载统计`, '')
  lines.push(`> 生成于 ${generatedAt} · 窗口 ${start} ~ ${end}（UTC 日）· 来源 npm registry + api.npmjs.org`, '')

  lines.push('## 总量', '', '| 指标 | 数值 |', '| --- | ---: |')
  lines.push(`| 近 7 天下载 | ${fmt(totals.week)} |`)
  lines.push(`| 窗口内下载（${start} ~ ${end}） | ${fmt(totals.window)} |`)
  if (totals.lastDay !== null) lines.push(`| 最近完整日（${totals.lastDay.day}） | ${fmt(totals.lastDay.downloads)} |`)
  if (est.baseline !== null) lines.push(`| 基线（非发布日中位） | ${fmt(est.baseline)}/天 |`)
  lines.push('')

  lines.push('## 版本分布（近 7 天）', '')
  if (versions.length === 0) {
    lines.push('npm 暂未提供按版本的下载拆分。', '')
  } else {
    lines.push('| 版本 | 下载 | 占比 | 发布时间 | 标签 |', '| --- | ---: | ---: | --- | --- |')
    for (const row of versions) {
      const tags = [row.latest ? 'latest' : '', row.stale ? '长尾' : ''].filter(Boolean).join(' / ') || '—'
      lines.push(`| ${row.version} | ${fmt(row.downloads)} | ${pct(row.downloads, totals.week)} | ${row.publishedAt ?? '—'} | ${tags} |`)
    }
    lines.push('')
    lines.push('> 「长尾」= 发布超过 7 天仍在被拉取，多为镜像或固定版本安装，不代表新增用户。', '')
  }

  lines.push(`## 每日下载（${start} ~ ${end}，UTC）`, '', '| 日期 | 下载 | 相对基线 | 事件 |', '| --- | ---: | ---: | --- |')
  for (const row of daily) {
    if (firstDay !== null && row.day < firstDay) continue
    const released = releases.get(row.day)
    let event = released === undefined ? '' : `发布 ${releaseLabel(released)}`
    if (row.downloads === null) event = event === '' ? '未结算' : `未结算（${event}）`
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
  lines.push('- 按版本的拆分接口只提供最近 7 天（last-week），历史分布需要定期运行本脚本归档。')
  lines.push('- 今日（UTC）通常尚未结算，显示为 —。', '')

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

function parseArgs(argv) {
  const options = { days: 30, pkg: null, out: null, json: false }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--json') options.json = true
    else if (arg === '--days') options.days = Number.parseInt(argv[++index], 10)
    else if (arg === '--pkg') options.pkg = argv[++index]
    else if (arg === '--out') options.out = argv[++index]
    else throw new Error(`未知参数：${arg}`)
  }
  if (options.pkg !== null && (typeof options.pkg !== 'string' || options.pkg === '')) throw new Error('--pkg 需要包名')
  if (options.out !== null && (typeof options.out !== 'string' || options.out === '')) throw new Error('--out 需要文件路径')
  if (!Number.isInteger(options.days) || options.days < 7 || options.days > 365) throw new Error('--days 需为 7–365 的整数')
  return options
}

/** 组装统计模型：版本表、日线、发布日与估算。weekDownloads 为 [版本, 下载] 有序对。 */
export function buildModel({ pkg, registry, weekDownloads, rangeDownloads, days, now = new Date() }) {
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

  const weekByVersion = new Map(weekDownloads)
  if (latest !== null && !weekByVersion.has(latest)) weekByVersion.set(latest, 0)
  const versions = [...weekByVersion.entries()]
    .map(([version, downloads]) => {
      const publishedAt = typeof times[version] === 'string' ? utcDay(times[version]) : null
      const ageDays = publishedAt === null ? null : Math.floor((now.getTime() - Date.parse(times[version])) / 86400000)
      return {
        version,
        downloads,
        publishedAt,
        latest: version === latest,
        // 发布超过 7 天仍在被拉：更新流量之外的长尾（镜像 / 固定版本）
        stale: ageDays !== null && ageDays > 7 && downloads > 0,
      }
    })
    .sort((left, right) => right.downloads - left.downloads || right.version.localeCompare(left.version, 'en'))

  const week = [...weekByVersion.values()].reduce((sum, value) => sum + value, 0)
  const completeRows = daily.filter((row) => row.downloads !== null)
  const lastDay = completeRows.length === 0 ? null : completeRows[completeRows.length - 1]
  const firstDay = [...releases.keys()].sort()[0] ?? null

  return {
    pkg,
    generatedAt: `${now.toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    start,
    end: today,
    firstDay,
    totals: { week, window: completeRows.reduce((sum, row) => sum + row.downloads, 0), lastDay },
    versions,
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
  const model = buildModel({ pkg, registry: registry.data ?? {}, weekDownloads, rangeDownloads, days: options.days, now })

  const output = options.json
    ? `${JSON.stringify({ ...model, releases: Object.fromEntries(model.releases) }, null, 2)}\n`
    : renderMarkdown(model)
  if (options.out !== null) {
    const file = resolve(options.out)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, output)
    console.log(`已写入 ${file}`)
    return
  }
  process.stdout.write(output)
}

const invokedDirectly = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (invokedDirectly) {
  main().catch((error) => {
    console.error(`[TD:stats] ${error?.message ?? error}`)
    process.exitCode = 1
  })
}
