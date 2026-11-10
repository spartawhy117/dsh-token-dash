/**
 * Declarative quota/balance sources. Endpoints and credential refs only;
 * request execution lives in adapters.js so this file stays pure data + parsing.
 */

const TIMEOUT = 6000

export const OPENCODE_USAGE = 'https://opencode.ai/zen/go/v1/usage'
export const OPENCODE_USAGE_FALLBACK = 'https://opencode.ai/api/v1/usage'
export const COMMAND_CODE_CREDITS = 'https://api.commandcode.ai/alpha/billing/credits'
export const OLLAMA_BALANCE = 'https://ollama.com/api/balance'
export const OLLAMA_USAGE = 'https://ollama.com/api/usage'

function clampPercent(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(100, n))
}

function pickNumber(...values) {
  for (const value of values) {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return null
}

/** 容错解析单个窗口：usedPercent / used_ratio / percentage / used+limit。 */
export function parseWindow(raw, key) {
  if (raw === null || raw === undefined || typeof raw !== 'object') return null
  const direct = pickNumber(raw.usedPercent, raw.used_percent, raw.percentage, raw.percent)
  let percent = direct
  if (percent === null && raw.used_ratio !== undefined) percent = Number(raw.used_ratio) * 100
  if (percent === null) {
    const used = pickNumber(raw.used, raw.current, raw.consumed)
    const limit = pickNumber(raw.limit, raw.total, raw.max)
    if (used !== null && limit !== null && limit > 0) percent = (used / limit) * 100
  }
  if (percent === null) return null
  const resetAt = pickNumber(raw.resetAt, raw.reset_at, raw.resetTime, raw.reset_time, raw.nextResetTime, raw.next_reset_time)
  const usedPercent = clampPercent(percent)
  return { key, usedPercent: usedPercent === null ? null : Math.round(usedPercent * 100) / 100, resetAt: resetAt ?? undefined, source: 'official' }
}

function collectFromMap(source, map) {
  const windows = []
  for (const [key, names] of Object.entries(map)) {
    for (const name of names) {
      const parsed = parseWindow(source?.[name], key)
      if (parsed !== null) { windows.push(parsed); break }
    }
  }
  return windows
}

/**
 * OpenCode Go：兼容 `usage` / `data` 下的 fiveHour / weekly / monthly，
 * 以及数组形式的 windows / limits。无法识别的窗口不补占位。
 */
export function parseOpenCodeUsage(body) {
  const data = body?.data ?? body
  const usage = data?.usage ?? data
  const windows = collectFromMap(usage, {
    '5h': ['fiveHour', 'five_hour', 'fiveHourWindow', '5h'],
    week: ['weekly', 'week', 'weekWindow'],
    month: ['monthly', 'month', 'monthWindow'],
  })
  const rows = Array.isArray(usage?.windows) ? usage.windows : Array.isArray(usage?.limits) ? usage.limits : []
  for (const row of rows) {
    const name = String(row?.key ?? row?.type ?? row?.name ?? '').toLowerCase()
    const key = name.includes('5') || name.includes('five') ? '5h'
      : name.includes('week') ? 'week'
        : name.includes('month') ? 'month' : null
    if (key === null || windows.some((item) => item.key === key)) continue
    const parsed = parseWindow(row, key)
    if (parsed !== null) windows.push(parsed)
  }
  return windows
}

/** Command Code：credits（数字或对象）+ windowLimits.fiveHour / weekly。 */
export function parseCommandCodeCredits(body) {
  const data = body?.data ?? body
  const rawCredits = data?.credits ?? data?.credit ?? data?.balance
  const amount = pickNumber(
    typeof rawCredits === 'object' && rawCredits !== null ? rawCredits.amount : rawCredits,
    typeof rawCredits === 'object' && rawCredits !== null ? rawCredits.balance : undefined,
    typeof rawCredits === 'object' && rawCredits !== null ? rawCredits.value : undefined,
  )
  const limits = data?.windowLimits ?? data?.window_limits ?? data?.limits ?? data
  const windows = []
  const five = parseWindow(limits?.fiveHour ?? limits?.five_hour, '5h')
  const week = parseWindow(limits?.weekly ?? limits?.week, 'week')
  if (five !== null) windows.push(five)
  if (week !== null) windows.push(week)
  const balance = amount === null
    ? null
    : { amount, status: 'ok', currency: 'CNY', updatedAt: Date.now() }
  return { windows, balance }
}

function round2(value) {
  return Math.round(value * 100) / 100
}

function round6(value) {
  return Math.round(value * 1e6) / 1e6
}

/** 旧套餐窗口：只有剩余百分比与重置时间，没有金额。 */
function legacyWindow(key, raw) {
  if (raw === null || raw === undefined || typeof raw !== 'object') return null
  const remaining = pickNumber(raw.remaining_percent)
  if (remaining === null) return null
  const resetAt = Date.parse(raw.resets_at)
  return {
    key,
    usedPercent: round2(clampPercent(100 - remaining)),
    resetAt: Number.isFinite(resetAt) ? resetAt : undefined,
    source: 'official',
  }
}

/**
 * Ollama Cloud：`included` 是 oneOf 二态——金额态（balance_usd / allowance_usd / period）
 * 与旧套餐态（session / weekly 百分比）。`purchased` 恒有，只含未过期额度。
 * 金额态 `amount` = 套餐剩余 + 购买余额，`used` 只用于套餐进度，不做分母混用。
 */
export function parseOllamaBalance(body) {
  const data = body?.data ?? body
  const included = data?.included
  const purchased = pickNumber(data?.purchased?.balance_usd)
  const updatedAt = Date.now()
  if (included === null || included === undefined || typeof included !== 'object') {
    return { windows: [], balance: { amount: null, status: 'error', currency: 'USD', updatedAt, _error: { kind: 'parse' } } }
  }
  if (included.session !== undefined || included.weekly !== undefined) {
    const windows = []
    const session = legacyWindow('session', included.session)
    const weekly = legacyWindow('week', included.weekly)
    if (session !== null) windows.push(session)
    if (weekly !== null) windows.push(weekly)
    return {
      windows,
      balance: {
        amount: purchased ?? 0,
        ...(purchased === null ? {} : { purchased }),
        legacy: true,
        status: 'ok',
        currency: 'USD',
        updatedAt,
      },
    }
  }
  const left = pickNumber(included.balance_usd)
  const allowance = pickNumber(included.allowance_usd)
  if (left === null || allowance === null) {
    return { windows: [], balance: { amount: null, status: 'error', currency: 'USD', updatedAt, _error: { kind: 'parse' } } }
  }
  const periodEnd = Date.parse(included.period?.until)
  return {
    windows: [],
    balance: {
      amount: round6(left + (purchased ?? 0)),
      packageLeft: left,
      allowance,
      used: round6(Math.max(0, allowance - left)),
      ...(purchased === null ? {} : { purchased }),
      ...(Number.isFinite(periodEnd) ? { periodEnd } : {}),
      status: 'ok',
      currency: 'USD',
      updatedAt,
    },
  }
}

/** `/api/usage` 只读参考：仅取 totals，缺失字段留 null，不参与任何计价。 */
export function parseOllamaUsage(body) {
  const totals = body?.totals
  if (totals === null || totals === undefined || typeof totals !== 'object') return {}
  return {
    channel: {
      range: typeof body?.range === 'string' ? body.range : null,
      usageUsd: pickNumber(totals.usage_usd),
      requests: pickNumber(totals.request_count),
      inputTokens: pickNumber(totals.input_tokens),
      cachedInputTokens: pickNumber(totals.cached_input_tokens),
      outputTokens: pickNumber(totals.output_tokens),
    },
  }
}

export const PROVIDER_SOURCES = [
  { id: 'deepseek-official', kind: 'api', currency: 'CNY', legacy: 'deepseek' },
  { id: 'zhipu', kind: 'subscription', currency: 'CNY', legacy: 'glm' },
  { id: 'moonshot', kind: 'subscription', currency: 'CNY', legacy: 'kimi' },
  { id: 'openrouter', kind: 'api', currency: 'USD', legacy: 'openrouter' },
  { id: 'qwen', kind: 'api', currency: 'CNY', legacy: 'qwen' },
  {
    id: 'opencode-go',
    kind: 'subscription',
    currency: 'USD',
    credential: { type: 'bearer', refs: ['OPENCODE_GO_API_KEY'] },
    quota: { url: OPENCODE_USAGE, fallbackUrl: OPENCODE_USAGE_FALLBACK, parse: parseOpenCodeUsage },
  },
  {
    id: 'command-code',
    kind: 'subscription',
    currency: 'CNY',
    credential: { type: 'bearer', refs: ['COMMAND_CODE_API_KEY'] },
    preflight: { refs: ['COMMAND_CODE_ORG_ID'], param: 'orgId' },
    quota: { url: COMMAND_CODE_CREDITS, parse: parseCommandCodeCredits },
  },
  {
    id: 'ollama',
    kind: 'api',
    currency: 'USD',
    credential: { type: 'bearer', refs: ['OLLAMA_API_KEY'] },
    quota: { url: OLLAMA_BALANCE, parse: parseOllamaBalance },
    usage: { url: OLLAMA_USAGE, range: '30d', parse: parseOllamaUsage },
  },
]

export { TIMEOUT }
