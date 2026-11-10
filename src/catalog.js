/**
 * Price catalog normalization: model-only entries, no provider dimension.
 * Community feed / bundled catalog / OpenRouter router prices all normalize here
 * so `match.js` only ever sees one shape.
 */
import { normalizeModel } from './providers.js'

const NUMERIC_NOISE = /^\d{3,}$/

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

function firstNumber(...values) {
  for (const value of values) {
    const parsed = finite(value)
    if (parsed !== null) return parsed
  }
  return null
}

function pricesOf(raw) {
  return {
    input: firstNumber(raw?.input, raw?.inputCostPerMillion),
    cacheRead: firstNumber(raw?.cacheRead, raw?.cacheReadCostPerMillion) ?? 0,
    cacheWrite: firstNumber(raw?.cacheWrite, raw?.cacheCreationCostPerMillion) ?? 0,
    output: firstNumber(raw?.output, raw?.outputCostPerMillion),
  }
}

function complete(prices) {
  return prices !== null && prices.input !== null && prices.output !== null
}

/**
 * Community feed expresses peak/off-peak through `dailySlots`; only the standard
 * weekday windows (09:00-12:00 / 14:00-18:00) are recognized, everything else
 * stays flat instead of pretending to be tiered.
 */
export function tieredPrices(raw) {
  const slots = Array.isArray(raw?.dailySlots) ? raw.dailySlots : []
  const slot = slots.find((item) => Array.isArray(item?.windows) && item.windows.length === 2)
  if (slot === undefined) return null
  const windows = slot.windows.map((item) => [Number(item?.startMinute), Number(item?.endMinute)])
  const standard = windows[0][0] === 540 && windows[0][1] === 720 && windows[1][0] === 840 && windows[1][1] === 1080
  const days = Array.isArray(slot.daysOfWeek) ? slot.daysOfWeek.map(Number) : [1, 2, 3, 4, 5]
  const weekdays = days.length === 5 && [1, 2, 3, 4, 5].every((day) => days.includes(day))
  if (!standard || !weekdays) return null
  const peak = pricesOf(slot)
  const offPeak = pricesOf(raw)
  if (!complete(peak) || !complete(offPeak)) return null
  return { peak, offPeak }
}

/** Already-normalized `peak` / `offPeak` blocks (bundled catalog, tests). */
function explicitTiers(raw) {
  if (raw?.peak == null || raw?.offPeak == null) return null
  const peak = pricesOf(raw.peak)
  const offPeak = pricesOf(raw.offPeak)
  return complete(peak) && complete(offPeak) ? { peak, offPeak } : null
}

function toEntry(raw, source) {
  const modelId = normalizeModel(raw?.modelId ?? raw?.model)
  if (modelId === 'unknown') return null
  const tiers = tieredPrices(raw) ?? explicitTiers(raw)
  const flat = pricesOf(raw?.prices !== undefined ? raw.prices : raw)
  if (tiers === null && !complete(flat)) return null
  const aliases = Array.isArray(raw?.aliases) ? raw.aliases.map((alias) => normalizeModel(alias)) : []
  // Pre-compile once: one malformed pattern must not disable the rest.
  const regexps = []
  for (const pattern of Array.isArray(raw?.aliasPatterns) ? raw.aliasPatterns : []) {
    if (typeof pattern !== 'string') continue
    try {
      regexps.push(new RegExp(pattern, 'i'))
    } catch {
      // dropped on purpose; reported by the caller through catalogInfo/logs
    }
  }
  return {
    modelId,
    displayName: String(raw?.displayName ?? raw?.modelId ?? raw?.model ?? modelId),
    family: String(raw?.family ?? ''),
    aliases: aliases.filter((alias) => alias !== 'unknown' && alias !== modelId),
    regexps,
    parsed: null,
    source,
    prices: tiers === null ? flat : null,
    peak: tiers?.peak ?? null,
    offPeak: tiers?.offPeak ?? null,
    currency: raw?.currency === 'USD' ? 'USD' : 'CNY',
  }
}

/**
 * Normalize one source into `{ entries, currency, updatedAt, source }`.
 * Entries are deduped by `modelId` so `find` never depends on array order.
 */
export function loadCatalog(raw, source = 'community') {
  const entries = []
  const seen = new Set()
  let dropped = 0
  for (const item of Array.isArray(raw?.models) ? raw.models : []) {
    const entry = toEntry(item, source)
    if (entry === null) {
      dropped += 1
      continue
    }
    if (seen.has(entry.modelId)) {
      dropped += 1
      continue
    }
    seen.add(entry.modelId)
    entries.push(entry)
  }
  return {
    entries,
    dropped,
    currency: raw?.currency === 'USD' ? 'USD' : 'CNY',
    updatedAt: raw?.updatedAt === undefined ? null : String(raw.updatedAt),
    source,
  }
}

/** Router prices arrive per-token; fold into the same per-million shape. */
export function routerModels(raw) {
  const models = []
  for (const item of Array.isArray(raw?.data) ? raw.data : []) {
    const input = Number(item?.pricing?.prompt)
    const output = Number(item?.pricing?.completion)
    if (!Number.isFinite(input) || !Number.isFinite(output)) continue
    models.push({
      modelId: normalizeModel(item.id),
      displayName: String(item.name ?? item.id),
      family: String(item.id).split('/')[0] ?? '',
      input: input * 1_000_000,
      cacheRead: Number(item?.pricing?.input_cache_read ?? 0) * 1_000_000,
      cacheWrite: Number(item?.pricing?.input_cache_write ?? 0) * 1_000_000,
      output: output * 1_000_000,
      currency: 'USD',
    })
  }
  return models
}

export { NUMERIC_NOISE }
