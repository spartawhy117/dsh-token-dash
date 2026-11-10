/**
 * External provider adapters. Endpoints and response semantics are copied from
 * the reference plugins; do not invent fields or percentages.
 */
import { normalizeProvider, providerCurrency, providerLabel } from './providers.js'
import { PROVIDER_SOURCES } from './quota-sources.js'

const TIMEOUT = 6000
const GLM_QUOTA = 'https://bigmodel.cn/api/monitor/usage/quota/limit'
const KIMI_USAGES = 'https://api.kimi.com/coding/v1/usages'
const KIMI_BALANCE = 'https://api.moonshot.cn/v1/users/me/balance'
const OPENROUTER_CREDITS = 'https://openrouter.ai/api/v1/credits'

export function clampPercent(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(100, n))
}

export function parseGlmQuota(body) {
  const data = body?.data ?? body
  const rows = Array.isArray(data?.limits) ? data.limits : []
  const windows = []
  for (const row of rows) {
    if (String(row?.type ?? '').toUpperCase() !== 'TOKENS_LIMIT') continue
    const unit = Number(row.unit)
    const key = unit === 3 ? '5h' : unit === 6 ? 'week' : null
    if (key === null) continue
    const percent = clampPercent(row.percentage)
    if (percent === null) continue
    windows.push({ key, usedPercent: percent, resetAt: Number(row.nextResetTime) || undefined, source: 'official' })
  }
  return windows
}

function ratioWindow(key, raw) {
  const used = clampPercent(raw?.used_ratio)
  if (used === null) return undefined
  return { key, usedPercent: used, resetAt: Number(raw?.reset_time) || undefined, source: 'official' }
}

export function parseKimiQuota(body) {
  const record = body?.data ?? body
  const windows = []
  const usages = record?.usages
  if (usages !== null && typeof usages === 'object') {
    const five = ratioWindow('5h', usages.limit_5h)
    const month = ratioWindow('month', usages.limit_month_code) ?? ratioWindow('month', usages.limit_month_total)
    if (five) windows.push(five)
    if (month) windows.push(month)
  }
  const weekly = ratioWindow('week', record?.usage)
  if (weekly) windows.push(weekly)
  if (windows.length === 0) {
    const limits = Array.isArray(record?.limits) ? record.limits : []
    const five = limits
      .map((item) => {
        const detail = item?.detail ?? item
        const limit = Number(detail?.limit)
        const used = detail?.used !== undefined ? Number(detail.used) : (limit - Number(detail?.remaining))
        const percent = limit > 0 && Number.isFinite(used) ? clampPercent((used / limit) * 100) : null
        return percent === null ? null : { key: '5h', usedPercent: percent, resetAt: Number(detail?.resetTime) || undefined, source: 'official' }
      })
      .filter(Boolean)
      .sort((left, right) => (right.resetAt ?? 0) - (left.resetAt ?? 0))
    if (five[0]) windows.push(five[0])
    const usage = record?.usage
    const limit = Number(usage?.limit)
    const used = Number(usage?.used)
    if (limit > 0 && Number.isFinite(used)) windows.push({ key: 'week', usedPercent: clampPercent((used / limit) * 100), resetAt: Number(usage.resetTime) || undefined, source: 'official' })
  }
  return windows
}

export function parseOpenRouterCredits(body) {
  const data = body?.data ?? body
  const total = Number(data?.total_credits)
  const usage = Number(data?.total_usage)
  if (!Number.isFinite(total) || !Number.isFinite(usage)) return null
  return { amount: Math.max(0, total - usage), currency: 'USD', status: 'ok', updatedAt: Date.now() }
}

async function resolveCredential(ctx, credential) {
  if (credential === undefined || credential === null) return undefined
  if (credential.type !== 'bearer' && credential.type !== 'oauth-reuse') return undefined
  return resolveKey(ctx, credential.refs ?? [])
}

async function resolveKey(ctx, names) {
  const credentials = ctx.get?.('credentials')
  if (credentials === undefined || typeof credentials.resolve !== 'function') return undefined
  for (const name of names) {
    try {
      const hit = await credentials.resolve(name)
      const value = hit?.value
      if (typeof value === 'string' && value.trim() !== '') return { value: value.trim(), name }
    } catch {
      // try next name
    }
  }
  return undefined
}

async function requestJson(url, headers) {
  const response = await fetch(url, { headers: { accept: 'application/json', ...headers }, signal: AbortSignal.timeout(TIMEOUT) })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(`http-${response.status}`)
    error.status = response.status
    error.body = body
    // 429 带整数秒的 Retry-After，属于源级退避输入，不进任何展示文案
    const retryAfter = Number(response.headers?.get?.('retry-after'))
    if (Number.isFinite(retryAfter) && retryAfter > 0) error.retryAfter = retryAfter
    throw error
  }
  return body
}

/** #47：错误分类（http+状态码 / timeout / network）——挂在条目 `_error`/`_quotaError` 上供日志还原原因。 */
function errorDetail(error) {
  if (error?.status !== undefined) {
    return {
      kind: 'http',
      status: error.status,
      ...(error.status >= 500 ? { upstream: true } : {}),
      ...(error.retryAfter === undefined ? {} : { retryAfter: error.retryAfter }),
    }
  }
  const name = `${error?.name ?? ''} ${error?.message ?? ''}`
  if (name.includes('Timeout') || name.includes('abort') || name.includes('Abort')) return { kind: 'timeout' }
  return { kind: 'network' }
}

async function deepseek(ctx) {
  const account = ctx.get?.('deepseekAccount')
  if (account !== undefined && typeof account.getBalance === 'function') {
    try {
      const data = await account.getBalance({ version: '1.0.2', locale: 'zh-CN', timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60 })
      if (data?.status === 'ready') {
        const wallets = [...(Array.isArray(data.value) ? data.value : Object.values(data.value ?? {})), ...(data.bonusWallets ?? [])]
        const amount = wallets.filter((wallet) => wallet?.currency === undefined || wallet.currency === 'CNY')
          .reduce((sum, wallet) => sum + (Number(wallet?.balance ?? wallet?.amount) || 0), 0)
        return { id: 'deepseek-official', kind: 'api', currency: 'CNY', balance: { amount, status: 'ok', currency: 'CNY', updatedAt: Date.now() } }
      }
    } catch {
      // fall through to key
    }
  }
  const key = await resolveKey(ctx, ['DEEPSEEK_API_KEY'])
  if (key === undefined) return null
  try {
    const body = await requestJson('https://api.deepseek.com/user/balance', { authorization: `Bearer ${key.value}` })
    const amount = (body?.balance_infos ?? []).reduce((sum, item) => sum + (Number(item?.total_balance) || 0), 0)
    return { id: 'deepseek-official', kind: 'api', currency: 'CNY', balance: { amount, status: 'ok', currency: 'CNY', updatedAt: Date.now() } }
  } catch (error) {
    return { id: 'deepseek-official', kind: 'api', currency: 'CNY', _error: errorDetail(error), balance: { amount: null, status: error.status === 401 ? 'unconfigured' : 'error', currency: 'CNY', updatedAt: Date.now() } }
  }
}

async function glm(ctx, prefs) {
  const key = await resolveKey(ctx, ['ZHIPU_API_KEY', 'GLM_API_KEY', 'ZAI_API_KEY'])
  if (key === undefined) return null
  const mode = prefs?.billingModes?.zhipu
  if (mode === 'api') return { id: 'zhipu', kind: 'api', mode: 'api', currency: 'CNY' }
  // 手动覆盖为订阅时，quota 失败/无窗口仍保留订阅卡（显示“套餐查询失败”），不回落 api。
  const subscriptionFallback = mode === 'subscription'
    ? { id: 'zhipu', name: 'GLM Coding', kind: 'subscription', mode: 'subscription', currency: 'CNY', plans: [] }
    : null
  try {
    const body = await requestJson(GLM_QUOTA, { authorization: key.value })
    const windows = parseGlmQuota(body)
    if (windows.length > 0) return { id: 'zhipu', name: 'GLM Coding', kind: 'subscription', mode: 'subscription', currency: 'CNY', plans: windows }
    // 响应可解析但无窗口：解析问题（quota.parse），非网络错误
    return { ...(subscriptionFallback ?? { id: 'zhipu', kind: 'api', mode: 'unknown', currency: 'CNY' }), _quotaError: { kind: 'parse' } }
  } catch (error) {
    return { ...(subscriptionFallback ?? { id: 'zhipu', kind: 'api', mode: 'unknown', currency: 'CNY' }), _quotaError: errorDetail(error) }
  }
}

/**
 * Kimi Coding 配额查询。
 * 返回 { state }：'no-key'（无 Coding Key 或显式 api 模式）、'ok'（含 entry）、'fallback'（自动模式下配额失败，走按量路径）。
 */
async function kimiCodingQuota(ctx, prefs) {
  const coding = await resolveKey(ctx, ['KIMI_API_KEY', 'KIMI_CODING_API_KEY'])
  if (coding === undefined) return { state: 'no-key' }
  const mode = prefs?.billingModes?.moonshot
  if (mode === 'api') return { state: 'no-key' }
  let quotaError = null
  try {
    const body = await requestJson(KIMI_USAGES, { authorization: `Bearer ${coding.value}` })
    const windows = parseKimiQuota(body)
    if (windows.length > 0) return { state: 'ok', entry: { id: 'moonshot', name: 'Kimi Coding', kind: 'subscription', mode: 'subscription', currency: 'CNY', plans: windows } }
    quotaError = { kind: 'parse' }
  } catch (error) {
    quotaError = errorDetail(error)
  }
  if (mode === 'subscription') return { state: 'ok', entry: { id: 'moonshot', name: 'Kimi Coding', kind: 'subscription', mode: 'subscription', currency: 'CNY', plans: [], _quotaError: quotaError } }
  return { state: 'fallback', quotaError }
  return { state: 'fallback' }
}

async function kimi(ctx, prefs) {
  const quota = await kimiCodingQuota(ctx, prefs)
  if (quota.state === 'ok') return quota.entry
  const quotaError = quota.quotaError ?? null
  const normal = await resolveKey(ctx, ['MOONSHOT_API_KEY'])
  if (normal === undefined) return quota.state === 'no-key' ? null : { id: 'moonshot', kind: 'api', mode: 'unknown', currency: 'CNY', _quotaError: quotaError }
  try {
    const body = await requestJson(KIMI_BALANCE, { authorization: `Bearer ${normal.value}` })
    const amount = Number(body?.data?.available_balance)
    const ok = Number.isFinite(amount)
    return {
      id: 'moonshot', kind: 'api', mode: 'unknown', currency: 'CNY', _quotaError: quotaError,
      balance: { amount: ok ? amount : null, status: ok ? 'ok' : 'error', currency: 'CNY', updatedAt: Date.now(), ...(ok ? {} : { _error: { kind: 'parse' } }) },
    }
  } catch (error) {
    return { id: 'moonshot', kind: 'api', mode: 'unknown', currency: 'CNY', _quotaError: quotaError, _error: errorDetail(error), balance: { amount: null, status: 'error', currency: 'CNY', updatedAt: Date.now() } }
  }
}

async function openrouter(ctx) {
  const key = await resolveKey(ctx, ['OPENROUTER_API_KEY'])
  if (key === undefined) return null
  try {
    const body = await requestJson(OPENROUTER_CREDITS, { authorization: `Bearer ${key.value}` })
    const balance = parseOpenRouterCredits(body)
    return { id: 'openrouter', kind: 'api', currency: 'USD', balance: balance ?? { amount: null, status: 'error', currency: 'USD', updatedAt: Date.now(), _error: { kind: 'parse' } } }
  } catch (error) {
    return { id: 'openrouter', kind: 'api', currency: 'USD', _error: errorDetail(error), balance: { amount: null, status: 'error', currency: 'USD', updatedAt: Date.now() } }
  }
}

/** Qwen 仅按量；国际站 Key（DASHSCOPE_INTL_API_KEY）按 USD，其余 CNY。无 quota 请求。 */
async function qwen(ctx) {
  const key = await resolveKey(ctx, ['DASHSCOPE_INTL_API_KEY', 'DASHSCOPE_API_KEY', 'QWEN_API_KEY'])
  if (key === undefined) return null
  const intl = key.name === 'DASHSCOPE_INTL_API_KEY'
  const currency = intl ? 'USD' : 'CNY'
  return { id: 'qwen', kind: 'api', currency, balance: { amount: null, status: 'unsupported', currency, updatedAt: Date.now() } }
}

const LEGACY_READERS = { deepseek, glm, kimi, openrouter, qwen }
const WINDOW_KEYS = new Set(['5h', 'week', 'month'])

function normalizeWindows(windows) {
  if (!Array.isArray(windows)) return []
  const out = []
  const seen = new Set()
  for (const item of windows) {
    if (item === null || item === undefined || !WINDOW_KEYS.has(item.key) || seen.has(item.key)) continue
    const usedPercent = clampPercent(item.usedPercent)
    if (usedPercent === null) continue
    seen.add(item.key)
    out.push({ ...item, usedPercent })
  }
  return out
}

/** 通用 preflight：凭据存在才拼 query；异常返回空串，不阻断主请求。 */
async function sourceQuery(ctx, source) {
  if (source.preflight === undefined) return ''
  try {
    const hit = await resolveKey(ctx, source.preflight.refs ?? [])
    if (hit === undefined) return ''
    return `${source.preflight.param}=${encodeURIComponent(hit.value)}`
  } catch {
    return ''
  }
}

function withQuery(url, query) {
  if (query === '') return url
  return `${url}${url.includes('?') ? '&' : '?'}${query}`
}

/** 可选 usage 钩子：失败只留错误详情，绝不影响余额结果与账本。 */
async function readSourceUsage(source, hit) {
  if (source.usage === undefined) return { channel: undefined, error: undefined }
  try {
    const query = source.usage.range === undefined ? '' : `range=${encodeURIComponent(source.usage.range)}`
    const body = await requestJson(withQuery(source.usage.url, query), { authorization: `Bearer ${hit.value}` })
    const parsed = source.usage.parse(body)
    return { channel: parsed?.channel ?? undefined, error: undefined }
  } catch (error) {
    return { channel: undefined, error: errorDetail(error) }
  }
}

async function readDeclarativeSource(ctx, prefs, source, previous) {
  const hit = await resolveCredential(ctx, source.credential)
  if (hit === undefined) return null
  const subscription = source.kind === 'subscription'
  // mode 必须由 kind 派生：声明式订阅源才是订阅；写成常量会把 api 源固化成订阅（cost=0）
  const base = { id: source.id, name: providerLabel(source.id), kind: source.kind, mode: subscription ? 'subscription' : 'api', currency: source.currency }
  const query = await sourceQuery(ctx, source)
  let body
  try {
    try {
      body = await requestJson(withQuery(source.quota.url, query), { authorization: `Bearer ${hit.value}` })
    } catch (error) {
      if (source.quota.fallbackUrl === undefined || (error.status !== 404 && error.status !== 405)) throw error
      body = await requestJson(withQuery(source.quota.fallbackUrl, query), { authorization: `Bearer ${hit.value}` })
    }
  } catch (error) {
    const detail = errorDetail(error)
    // 限流复用上一份快照，避免卡片在 429 时闪成「查询失败」；退避由缓存 until 承担
    if (error.status === 429 && previous !== null && previous !== undefined) {
      return { ...previous, _quotaError: detail, _rateLimited: true, fetchedAt: Date.now() }
    }
    const status = error.status === 401 ? 'unconfigured' : 'error'
    return {
      ...base,
      windows: [],
      ...(subscription ? {} : { balance: { amount: null, status, currency: source.currency, updatedAt: Date.now() } }),
      _quotaError: detail,
    }
  }
  const parsed = source.quota.parse(body)
  const windows = normalizeWindows(Array.isArray(parsed) ? parsed : parsed?.windows)
  const balance = Array.isArray(parsed) ? undefined : parsed?.balance
  const usage = await readSourceUsage(source, hit)
  const extra = {
    ...(balance === undefined ? {} : { balance }),
    ...(usage.channel === undefined ? {} : { channel: usage.channel }),
    ...(usage.error === undefined ? {} : { _channelError: usage.error }),
  }
  if (windows.length === 0 && balance === undefined) return { ...base, windows: [], _quotaError: { kind: 'parse' }, ...extra }
  return { ...base, windows, ...extra }
}

async function readSource(ctx, prefs, source, previous) {
  if (source.legacy !== undefined) {
    const reader = LEGACY_READERS[source.legacy]
    return reader(ctx, prefs)
  }
  return readDeclarativeSource(ctx, prefs, source, previous)
}

/** 订阅重查专用：Kimi 只查 Coding 配额，不请求 moonshot 余额。 */
async function readKimiSubscription(ctx, prefs) {
  const quota = await kimiCodingQuota(ctx, prefs)
  if (quota.state === 'ok') return quota.entry
  if (quota.state === 'fallback') return { id: 'moonshot', kind: 'api', mode: 'unknown', currency: 'CNY', _quotaError: quota.quotaError ?? null }
  return null
}

const TTL_OK = 60000
const TTL_FAIL = 10000

/** 限流条目按 Retry-After 延后重试，成功 60s / 失败 10s 的基线不变。 */
function cacheExpiry(data, now) {
  const retryAfter = data?._rateLimited === true ? Number(data?._quotaError?.retryAfter) : NaN
  if (Number.isFinite(retryAfter) && retryAfter > 0) return now + Math.max(TTL_FAIL, retryAfter * 1000)
  return now + (data === null || data?._rateLimited === true ? TTL_FAIL : TTL_OK)
}

async function readCachedSource(ctx, prefs, source, cache) {
  const now = Date.now()
  const cached = cache.get(source.id)
  if (cached !== undefined && cached.promise === null && now < (cached.until ?? now)) return cached.data
  if (cached?.promise !== undefined && cached.promise !== null) return cached.promise
  const promise = readSource(ctx, prefs, source, cached?.data ?? null)
    .then((data) => {
      const at = Date.now()
      cache.set(source.id, { at, ok: data !== null && data?._rateLimited !== true, data, promise: null, until: cacheExpiry(data, at) })
      return data
    })
    .catch((error) => {
      const at = Date.now()
      cache.set(source.id, { at, ok: false, data: null, promise: null, until: at + TTL_FAIL })
      throw error
    })
  cache.set(source.id, { at: cached?.at ?? 0, ok: cached?.ok === true, data: cached?.data ?? null, promise, until: cached?.until ?? null })
  return promise
}

function visibleEntry(entry, prefs) {
  return entry !== null && prefs?.billingModes?.[entry.id] !== 'hide'
}

/** Adapter → VM boundary: normalize ad-hoc adapter rows into ProviderSnapshot. */
export function toSnapshot(entry) {
  const error = entry.error ?? entry._error ?? null
  const quotaError = entry.quotaError ?? entry._quotaError ?? null
  const balance = entry.balance ?? null
  const status = error !== null
    ? 'error'
    : balance?.status === 'unconfigured'
      ? 'unconfigured'
      : balance?.status === 'error'
        ? 'error'
        : 'ok'
  return {
    id: entry.id,
    name: entry.name,
    kind: entry.kind === 'subscription' ? 'subscription' : 'api',
    currency: entry.currency,
    status,
    balance,
    // 渠道侧只读用量与限流标记：仅展示用，不参与计价（REQ-04）
    ...(entry.channel === undefined ? {} : { channel: entry.channel }),
    ...(entry._channelError === undefined ? {} : { channelError: entry._channelError }),
    rateLimited: entry._rateLimited === true,
    mode: entry.mode === 'subscription' || entry.mode === 'api' ? entry.mode : 'unknown',
    windows: Array.isArray(entry.windows) ? entry.windows : Array.isArray(entry.plans) ? entry.plans : [],
    error,
    quotaError,
    fetchedAt: entry.fetchedAt ?? Date.now(),
  }
}

/**
 * Query configured providers; each failure is isolated. Balance/credits are always requested
 * (P2 shows them regardless of the P1-only toggle, #31). 空档原因挂在返回数组的 `misses` 上：
 * `<id>:none` 未配置、`:error` 请求失败、`:hidden` 被计费模式隐藏。
 * 缓存按源保存在调用方传入的 Map 中：成功 60s、失败 10s，并发复用 promise。
 */
export async function readProviders(ctx, prefs, cache = new Map()) {
  const results = await Promise.allSettled(PROVIDER_SOURCES.map((source) => readCachedSource(ctx, prefs, source, cache)))
  const out = []
  const misses = []
  const failures = []
  results.forEach((result, index) => {
    const id = PROVIDER_SOURCES[index].id
    if (result.status !== 'fulfilled') {
      misses.push(`${id}:error`)
      failures.push({ id, error: errorDetail(result.reason) })
      return
    }
    if (result.value === null) { misses.push(`${id}:none`); return }
    if (visibleEntry(result.value, prefs) !== true) { misses.push(`${id}:hidden`); return }
    const value = result.value
    value.currency = value.currency ?? providerCurrency(normalizeProvider(value.id))
    out.push(toSnapshot(value))
  })
  out.misses = misses
  out.failures = failures
  return out
}

/**
 * P3「重新检测」专用：只重查订阅 provider 的配额，绕过缓存。
 * 仅返回 subscription 条目；无 Key 的 provider 不返回（由调用方从缓存移除）。
 */
export async function readSubscriptions(ctx, prefs) {
  const sources = PROVIDER_SOURCES.filter((source) => source.kind === 'subscription')
  const results = await Promise.allSettled(sources.map((source) => (
    source.legacy === 'kimi' ? readKimiSubscription(ctx, prefs) : readSource(ctx, prefs, source)
  )))
  const out = []
  const failures = []
  results.forEach((result, index) => {
    if (result.status !== 'fulfilled') {
      failures.push({ id: sources[index].id, error: errorDetail(result.reason) })
      return
    }
    if (result.value === null) return
    // 旧源（GLM / Kimi）配额失败时可能回落 API 条目，保留旧行为；新源只保留订阅条目。
    const legacy = sources[index].legacy !== undefined
    if (result.value.kind !== 'subscription' && legacy !== true) return
    if (visibleEntry(result.value, prefs) !== true) return
    out.push(toSnapshot(result.value))
  })
  out.failures = failures
  return out
}

/** #46/#47：按 §2.5 adapter.* 事件表记侦测结果与错误原因——只记状态/计数/错误分类，不记 Key/响应体（脱敏约束）。 */
export function logAdapterEvents(log, providers) {
  const info = (module, event, meta) => log.info(module, event, meta)
  // 错误详情合并进 meta：kind=http 时带 status，便于报障还原原因
  const errorMeta = (detail) => (detail === null || detail === undefined
    ? {}
    : detail.kind === 'http'
      ? { errorKind: detail.kind, httpStatus: detail.status, ...(detail.retryAfter === undefined ? {} : { retryAfter: detail.retryAfter }) }
      : { errorKind: detail.kind })
  for (const item of providers) {
    if (item.id === 'deepseek-official') {
      if (item.balance?.status === 'ok') info('adapter.deepseek', 'balance.ok', { amount: item.balance.amount })
      else if (item.balance?.status === 'unconfigured') info('adapter.deepseek', 'balance.auth', errorMeta(item.error))
      else if (item.balance !== undefined) info('adapter.deepseek', 'balance.error', { status: item.balance.status, ...errorMeta(item.error ?? item.balance._error) })
      continue
    }
    if (item.id === 'zhipu' || item.id === 'moonshot') {
      const module = item.id === 'zhipu' ? 'adapter.glm' : 'adapter.kimi'
      if (item.kind === 'subscription') {
        const windows = (item.windows ?? []).length
        if (windows > 0) info(module, 'quota.ok', { windows })
        else if (item.quotaError?.kind === 'parse') info(module, 'quota.parse', {})
        else info(module, 'quota.fail', { windows: 0, ...errorMeta(item.quotaError) })
      } else if (item.quotaError !== undefined && item.quotaError !== null) {
        info(module, 'quota.fail', { ...errorMeta(item.quotaError) })
      } else {
        info(module, 'quota.miss', {})
      }
      if (item.id === 'moonshot' && item.balance?.status === 'ok') info('adapter.kimi', 'balance.ok', { amount: item.balance.amount })
      if (item.id === 'moonshot' && item.balance?.status === 'error') info('adapter.kimi', 'balance.error', { status: 'error', ...errorMeta(item.error ?? item.balance._error) })
      continue
    }
    if (item.id === 'openrouter') {
      if (item.balance?.status === 'ok') info('adapter.openrouter', 'credits.ok', { amount: item.balance.amount })
      else if (item.balance !== undefined) info('adapter.openrouter', 'credits.error', { status: item.balance.status, ...errorMeta(item.error ?? item.balance._error) })
      continue
    }
    if (item.id === 'qwen') {
      info('adapter.qwen', item.currency === 'USD' ? 'currency.usd' : 'detected', {})
      continue
    }
    if (item.id === 'opencode-go' || item.id === 'command-code') {
      const module = item.id === 'opencode-go' ? 'adapter.opencode' : 'adapter.commandcode'
      const windows = (item.windows ?? []).length
      if (windows > 0) info(module, 'quota.ok', { windows })
      else if (item.quotaError?.kind === 'parse') info(module, 'quota.parse', {})
      else info(module, 'quota.fail', { windows: 0, ...errorMeta(item.quotaError) })
      if (item.balance?.status === 'ok') info(module, 'credits.ok', { amount: item.balance.amount })
      continue
    }
    if (item.id === 'ollama') {
      const balance = item.balance
      if (balance?.status === 'ok') info('adapter.ollama', 'quota.ok', { amount: balance.amount, purchased: balance.purchased ?? 0, legacy: balance.legacy === true })
      else if (balance?.status === 'unconfigured') info('adapter.ollama', 'quota.auth', {})
      else info('adapter.ollama', 'quota.fail', { status: balance?.status ?? 'error', ...errorMeta(item.quotaError ?? item.error) })
      if (item.channel !== undefined) info('adapter.ollama', 'usage', { range: item.channel.range, usageUsd: item.channel.usageUsd })
      else if (item.channelError !== undefined) info('adapter.ollama', 'usage.fail', errorMeta(item.channelError))
    }
  }
}

const FAILURE_MODULES = {
  'deepseek-official': 'adapter.deepseek',
  zhipu: 'adapter.glm',
  moonshot: 'adapter.kimi',
  openrouter: 'adapter.openrouter',
  qwen: 'adapter.qwen',
  'opencode-go': 'adapter.opencode',
  'command-code': 'adapter.commandcode',
}

/**
 * 探测结果签名：miss 清单不变时无需重复记日志，避免每轮刷新刷屏。
 * 返回 `id:none,id:hidden,...` 的稳定字符串；无 miss 时为空串。
 */
export function missSignature(providers) {
  return (providers?.misses ?? []).join(',')
}

/** Promise.allSettled 的拒绝项没有 entry，单独补 adapter.<id> 失败日志。 */
export function logAdapterFailures(log, failures = []) {
  for (const item of failures) {
    const module = FAILURE_MODULES[item.id] ?? `adapter.${item.id}`
    const error = item.error ?? { kind: 'network' }
    log.warn(module, 'detect.fail', {
      errorKind: error.kind,
      ...(error.status === undefined ? {} : { httpStatus: error.status }),
      ...(error.upstream === true ? { upstream: true } : {}),
    })
  }
}

export { KIMI_USAGES, GLM_QUOTA, KIMI_BALANCE, OPENROUTER_CREDITS }
