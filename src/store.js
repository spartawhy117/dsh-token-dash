import { homedir } from 'node:os'
import { join } from 'node:path'
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import { emptyState, num } from './core.js'
import { normalizeModel, normalizeProvider } from './providers.js'

/** 计价模型版本：3 = 内置价对齐官方、社区峰谷识别与工作日/周末规则。 */
export const COST_MODEL_VERSION = 3

export const DEFAULT_PREFS = {
  version: 1,
  budgets: {},
  billingModes: {},
  refreshMs: 60000,
  showBalance: true,
  /** 价目逃生阀：仅认文件，无 UI；键为 `provider:model` 或 `model`。 */
  priceOverrides: {},
  /** 币种声明：仅认文件，无 UI；`{ [providerId]: 'CNY' | 'USD' }`。 */
  providerCurrency: {},
}

function quoteOf(raw) {
  const input = Number(raw?.input)
  const output = Number(raw?.output)
  if (!Number.isFinite(input) || input < 0 || !Number.isFinite(output) || output < 0) return null
  const optional = (value) => {
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
  }
  return {
    input,
    cacheRead: optional(raw?.cacheRead),
    cacheWrite: optional(raw?.cacheWrite),
    output,
    currency: raw?.currency === 'USD' ? 'USD' : 'CNY',
  }
}

/** 键两侧归一（provider 走别名表），非法条目直接丢弃，不阻塞启动。 */
export function normalizeOverrides(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out = {}
  for (const [key, value] of Object.entries(raw)) {
    const quote = quoteOf(value)
    if (quote === null) continue
    const [left, right] = String(key).split(':')
    const normalized = right === undefined
      ? normalizeModel(left)
      : `${normalizeProvider(left)}:${normalizeModel(right)}`
    if (normalized === 'unknown' || normalized.endsWith(':unknown')) continue
    out[normalized] = quote
  }
  return out
}

/** 币种声明只接受 CNY / USD；其余值丢弃（不做启发式猜测）。 */
export function normalizeCurrencyMap(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out = {}
  for (const [key, value] of Object.entries(raw)) {
    const id = normalizeProvider(key)
    if (id === 'unknown') continue
    if (value === 'CNY' || value === 'USD') out[id] = value
  }
  return out
}

/** 刷新间隔唯一枚举：loadPrefs 归一与 normalizePrefs 校验共用。 */
export const REFRESH_OPTIONS = [30000, 60000, 300000]

export function resolveHome(ctx) {
  try {
    const fn = ctx.get?.('dshHomePath')
    if (typeof fn === 'function') {
      const value = fn()
      if (typeof value === 'string' && value.trim() !== '') return value
    }
  } catch {
    // fall through
  }
  const env = process.env.DSH_HOME
  if (typeof env === 'string' && env.trim() !== '') return env
  return join(homedir(), '.dsh')
}

export function dataDir(ctx) {
  return join(resolveHome(ctx), 'dsh-token-dash')
}

export function logsDir(ctx) {
  return join(resolveHome(ctx), 'logs', 'dsh-token-dash')
}

async function readJson(file, fallback, onCorrupt) {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') return fallback
    const backup = `${file}.corrupt-${Date.now()}`
    try {
      await rename(file, backup)
    } catch {
      // ignore
    }
    // #47：损坏文件不再静默丢弃——报障时日志可还原"数据为何重置"
    if (typeof onCorrupt === 'function') onCorrupt(file, backup, error)
    return fallback
  }
}

/** 兼容 v0.1 的 day.models 形状；所有读取入口共用。 */
function normalizeBuckets(days) {
  for (const bucket of Object.values(days ?? {})) {
    if (bucket === null || typeof bucket !== 'object') continue
    if (bucket.providers === undefined) {
      bucket.providers = { unknown: { models: bucket.models ?? {} } }
      delete bucket.models
    }
  }
  return days
}

export async function loadState(dir, logger) {
  await mkdir(dir, { recursive: true })
  const state = await readJson(join(dir, 'daily.json'), emptyState(), (file, backup) => {
    logger?.warn('boot', 'state.corrupt', { file, backup })
  })
  if (state?.version !== 1 || typeof state.days !== 'object') return emptyState()
  normalizeBuckets(state.days)
  state.watermarks ??= {}
  state.headers ??= {}
  state.currentProvider ??= null
  state.providerKinds ??= {}
  // 月度账本是独立文件：daily.json 缺失/被重置时从这里恢复本月历史
  const months = await loadMonths(dir, logger)
  let loaded = 0
  for (const [dayKey, bucket] of Object.entries(months.days)) {
    if (state.days[dayKey] !== undefined) continue
    state.days[dayKey] = bucket
    loaded += 1
  }
  if (months.costVersion !== undefined) {
    state.costVersion = state.costVersion === undefined ? months.costVersion : Math.min(state.costVersion, months.costVersion)
  }
  if (loaded > 0) logger?.info('boot', 'state.months', { months: months.months, days: loaded })
  return state
}

/** 月度账本：`$DSH_HOME/dsh-token-dash/months/YYYY-MM.json`（每文件一个月的日级聚合）。 */
function monthsDir(dir) {
  return join(dir, 'months')
}

export async function saveMonths(dir, state) {
  const byMonth = new Map()
  for (const [dayKey, bucket] of Object.entries(state.days ?? {})) {
    const month = String(dayKey).slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(month)) continue
    let entry = byMonth.get(month)
    if (entry === undefined) {
      entry = { version: 1, month, updatedAt: 0, costVersion: state.costVersion ?? COST_MODEL_VERSION, days: {} }
      byMonth.set(month, entry)
    }
    entry.days[dayKey] = bucket
  }
  for (const [month, payload] of byMonth) {
    payload.updatedAt = Date.now()
    await saveJson(monthsDir(dir), `${month}.json`, payload)
  }
  return byMonth.size
}

export async function loadMonths(dir, logger) {
  let names
  try {
    names = await readdir(monthsDir(dir))
  } catch {
    return { days: {}, months: 0, costVersion: undefined }
  }
  const days = {}
  let months = 0
  let costVersion
  for (const name of names) {
    if (!/^\d{4}-\d{2}\.json$/.test(name)) continue
    try {
      const payload = JSON.parse(await readFile(join(monthsDir(dir), name), 'utf8'))
      if (payload?.version !== 1 || typeof payload.days !== 'object') continue
      months += 1
      const version = payload.costVersion === undefined ? 1 : payload.costVersion
      costVersion = costVersion === undefined ? version : Math.min(costVersion, version)
      normalizeBuckets(payload.days)
      for (const [dayKey, bucket] of Object.entries(payload.days)) {
        if (days[dayKey] === undefined) days[dayKey] = bucket
      }
    } catch (error) {
      logger?.warn('boot', 'state.month-corrupt', { file: name, message: String(error?.message ?? error) })
    }
  }
  return { days, months, costVersion }
}

/**
 * 1.0.3 的迁移会先把旧 daily.json 改名为 *.pre-v2-*.bak 再清空聚合；backfill 在桌面
 * 环境拿不到会话时，这份备份就是唯一历史。启动时把它并回当前状态并标记已消费，
 * 避免重复合并；成本由 repriceState 统一重算。
 */
export async function recoverState(dir, state, logger) {
  let names
  try {
    names = await readdir(dir)
  } catch {
    return { recovered: false, backup: null, days: 0 }
  }
  const backups = names
    .filter((name) => name.startsWith('daily.json.pre-v2-') && name.endsWith('.bak'))
    .sort()
    .reverse()
  for (const name of backups) {
    const file = join(dir, name)
    let backup
    try {
      backup = JSON.parse(await readFile(file, 'utf8'))
    } catch {
      continue
    }
    if (backup?.version !== 1 || typeof backup.days !== 'object') continue
    const dayCount = Object.keys(backup.days).length
    if (dayCount === 0) continue
    normalizeBuckets(backup.days)
    mergeBackup(state, backup)
    try {
      await rename(file, `${file}.merged`)
    } catch (error) {
      // 改名失败会留下重复合并风险，必须留痕
      logger?.warn('boot', 'state.recover-rename', { file, message: String(error?.message ?? error) })
    }
    logger?.info('boot', 'state.recover', { backup: file, days: dayCount })
    return { recovered: true, backup: file, days: dayCount }
  }
  return { recovered: false, backup: null, days: 0 }
}

function mergeBackup(target, source) {
  target.days ??= {}
  for (const [dayKey, bucket] of Object.entries(source.days ?? {})) {
    const targetBucket = (target.days[dayKey] ??= { providers: {} })
    targetBucket.providers ??= {}
    const providers = bucket.providers ?? { unknown: { models: bucket.models ?? {} } }
    for (const [providerId, providerBucket] of Object.entries(providers)) {
      const targetProvider = (targetBucket.providers[providerId] ??= { models: {} })
      targetProvider.models ??= {}
      for (const [model, row] of Object.entries(providerBucket?.models ?? {})) {
        const targetRow = targetProvider.models[model]
        if (targetRow === undefined) {
          targetProvider.models[model] = { ...row }
          continue
        }
        targetRow.input += num(row.input)
        targetRow.cacheRead += num(row.cacheRead)
        targetRow.cacheWrite += num(row.cacheWrite)
        targetRow.output += num(row.output)
        targetRow.requests += num(row.requests)
        targetRow.cost += num(row.cost)
        targetRow.priced = targetRow.priced !== false && row.priced !== false
      }
    }
  }
  target.watermarks ??= {}
  for (const [sessionId, seq] of Object.entries(source.watermarks ?? {})) {
    target.watermarks[sessionId] = Math.max(num(target.watermarks[sessionId]), num(seq))
  }
  target.headers = { ...(source.headers ?? {}), ...(target.headers ?? {}) }
  target.currentProvider ??= source.currentProvider ?? null
  // 备份来自旧计价模型：强制走一次重算
  target.costVersion = Math.min(target.costVersion ?? COST_MODEL_VERSION, source.costVersion ?? 1)
}

/** 返回对象即白名单：legacy `budget`、已删字段与未知键都不进入运行时。 */
export async function loadPrefs(dir, logger) {
  const prefs = await readJson(join(dir, 'prefs.json'), DEFAULT_PREFS, (file, backup) => {
    logger?.warn('boot', 'state.corrupt', { file, backup })
  })
  const rawRefresh = Number(prefs?.refreshMs)
  const refreshMs = REFRESH_OPTIONS.includes(rawRefresh) ? rawRefresh : DEFAULT_PREFS.refreshMs
  if (prefs?.refreshMs !== undefined && refreshMs !== rawRefresh) {
    logger?.warn('boot', 'prefs.normalize', { field: 'refreshMs', value: prefs.refreshMs, used: refreshMs })
  }
  return {
    version: 1,
    budgets: { ...(prefs?.budgets ?? {}) },
    billingModes: { ...(prefs?.billingModes ?? {}) },
    refreshMs,
    showBalance: prefs?.showBalance !== false,
    priceOverrides: normalizeOverrides(prefs?.priceOverrides),
    providerCurrency: normalizeCurrencyMap(prefs?.providerCurrency),
  }
}

export async function saveJson(dir, name, value) {
  await mkdir(dir, { recursive: true })
  const file = join(dir, name)
  const tmp = `${file}.tmp-${process.pid}`
  await writeFile(tmp, JSON.stringify(value), 'utf8')
  await rename(tmp, file)
}

export function createFlusher(dir, state, delay = 2000, logger) {
  let timer
  let saving
  const flush = async () => {
    if (saving !== undefined) return saving
    saving = (async () => {
      await saveJson(dir, 'daily.json', state)
      await saveMonths(dir, state)
    })()
      .catch((error) => {
        // #47：写盘失败不再静默——数据丢失报障的关键线索
        logger?.warn('collect', 'state.write-fail', { message: String(error?.message ?? error) })
      })
      .finally(() => {
        saving = undefined
      })
    return saving
  }
  const schedule = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      void flush()
    }, delay)
    timer.unref?.()
  }
  return {
    schedule,
    flush,
    stop() {
      clearTimeout(timer)
    },
  }
}
