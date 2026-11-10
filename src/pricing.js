/**
 * Pricing: catalog I/O + table selection + peak/off-peak + override short-circuit.
 * Matching itself lives in `match.js`; shape normalization lives in `catalog.js`.
 * This module never sees credentials and never asks who the provider is.
 */
import { readFileSync } from 'node:fs'
import { loadCatalog, routerModels } from './catalog.js'
import { explainMiss, resolveMatch } from './match.js'
import { normalizeModel, normalizeProvider, providerCurrency } from './providers.js'

const BUNDLED = JSON.parse(readFileSync(new URL('./catalog.json', import.meta.url), 'utf8'))
const GITEE = 'https://gitee.com/oyw125/model-price-table/raw/master/model_pricing.json'
const GITHUB = 'https://raw.githubusercontent.com/LaoYueHanNi/model-price-table/master/model_pricing.json'
const GITEE_PAGE = 'https://gitee.com/oyw125/model-price-table'
const GITHUB_PAGE = 'https://github.com/LaoYueHanNi/model-price-table'
const ROUTER = 'https://openrouter.ai/api/v1/models'

let catalog = loadCatalog(BUNDLED, 'bundled')
let routerCatalog = { entries: [], currency: 'USD', source: 'router', updatedAt: null }
let catalogUrl = null
let communityCache = { at: 0, value: null }
/** `provider:model` / `model` → normalized override quote (set by `configurePricing`). */
let overrides = new Map()
/** `(providerId) => 'CNY' | 'USD'`; declared prefs first, registry as fallback. */
let currencyOf = (providerId) => providerCurrency(providerId)

/** Prices are per million tokens in both the community feed and the bundled catalog. */
function effectivePrices(entry, ts) {
  if (entry.peak !== null && entry.offPeak !== null) {
    // Beijing workdays 09:00-12:00 / 14:00-18:00 are peak; weekends are off-peak.
    const date = new Date(ts + 8 * 60 * 60 * 1000)
    const hour = date.getUTCHours()
    const weekday = date.getUTCDay()
    const workday = weekday >= 1 && weekday <= 5
    const peak = workday && ((hour >= 9 && hour < 12) || (hour >= 14 && hour < 18))
    return peak ? entry.peak : entry.offPeak
  }
  return entry.prices
}

function overrideQuote(modelId, providerId) {
  if (overrides.size === 0) return null
  const byProvider = overrides.get(`${providerId}:${modelId}`)
  if (byProvider !== undefined) return byProvider
  return overrides.get(modelId) ?? null
}

/**
 * Only `USD` providers may use router prices; everything else stays on the
 * community table so a CNY number never wears a `$`.
 */
function selectTable(entry, currency) {
  if (currency === 'USD') {
    const routed = routerCatalog.entries.find((item) => item.modelId === entry.modelId)
    if (routed !== undefined) {
      return { name: 'router', entry: routed, currency: 'USD' }
    }
  }
  return { name: entry.source === 'bundled' ? 'bundled' : 'community', entry, currency: entry.currency }
}

/**
 * Resolve one line item. Override wins and short-circuits table selection: the
 * price and the currency must come from the same place.
 */
export function resolvePrice(model, provider, ts = Date.now()) {
  const modelId = normalizeModel(model)
  if (modelId === 'unknown') return null
  const providerId = normalizeProvider(provider)

  const override = overrideQuote(modelId, providerId)
  if (override !== null) {
    return {
      input: override.input,
      cacheRead: override.cacheRead,
      cacheWrite: override.cacheWrite,
      output: override.output,
      currency: override.currency,
      confidence: 'override',
      approximate: false,
      catalogModel: modelId,
      table: 'override',
      source: 'override',
    }
  }

  const matched = resolveMatch(modelId, catalog.entries)
  if (matched === null) return null
  const table = selectTable(matched.entry, currencyOf(providerId))
  const prices = effectivePrices(table.entry, ts)
  if (prices === null || prices.input === null || prices.output === null) return null
  return {
    input: prices.input,
    cacheRead: prices.cacheRead,
    cacheWrite: prices.cacheWrite,
    output: prices.output,
    currency: table.currency,
    confidence: matched.confidence,
    approximate: matched.confidence === 'fuzzy',
    catalogModel: table.entry.modelId,
    table: table.name,
    source: catalog.source,
  }
}

/** Same failure taxonomy as the plan's `reason` field, for unpriced rows. */
export function explainPriceMiss(model) {
  return explainMiss(model, catalog.entries)
}

/**
 * Inject prefs-derived inputs. `overrides` keys may be `provider:model` or
 * `model`; both sides are normalized here so callers stay dumb.
 */
export function configurePricing(input = {}) {
  const next = new Map()
  for (const [key, value] of Object.entries(input.overrides ?? {})) {
    const quote = normalizeOverride(value)
    if (quote === null) continue
    const [left, right] = String(key).split(':')
    const normalized = right === undefined
      ? normalizeModel(left)
      : `${normalizeProvider(left)}:${normalizeModel(right)}`
    if (normalized === 'unknown' || normalized.endsWith(':unknown')) continue
    next.set(normalized, quote)
  }
  overrides = next
  if (typeof input.currencyOf === 'function') currencyOf = input.currencyOf
}

function normalizeOverride(raw) {
  const input = Number(raw?.input)
  const output = Number(raw?.output)
  if (!Number.isFinite(input) || input < 0) return null
  if (!Number.isFinite(output) || output < 0) return null
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

export function catalogInfo() {
  return {
    version: catalog.version ?? null,
    source: catalog.source,
    updatedAt: catalog.updatedAt,
    url: catalogUrl,
    models: catalog.entries.length,
    routerModels: routerCatalog.entries.length,
    overrides: overrides.size,
  }
}

/** Tests: replace the community catalog wholesale (provider fields are ignored). */
export function setCatalogForTests(models, source = 'test') {
  catalog = loadCatalog({ models }, source)
  routerCatalog = { entries: [], currency: 'USD', source: 'router', updatedAt: null }
  catalogUrl = null
  communityCache = { at: 0, value: null }
}

function fetchJson(url, timeoutMs = 6000) {
  return fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) }).then((response) => {
    if (!response.ok) throw new Error(`http-${response.status}`)
    return response.json()
  })
}

/** Community catalog: Gitee first, GitHub second, bundled as last resort. Never throws. */
export async function loadCommunityPricing({ force = false } = {}) {
  if (!force && communityCache.value !== null && Date.now() - communityCache.at < 24 * 3600 * 1000) return communityCache.value
  for (const [url, source, page] of [[GITEE, 'community-gitee', GITEE_PAGE], [GITHUB, 'community-github', GITHUB_PAGE]]) {
    try {
      const raw = await fetchJson(url)
      const parsed = loadCatalog(raw, source)
      if (parsed.entries.length === 0) throw new Error('empty-catalog')
      catalog = parsed
      catalogUrl = page
      communityCache = { at: Date.now(), value: catalogInfo() }
      return catalogInfo()
    } catch {
      // try next mirror, then keep the bundled catalog
    }
  }
  return catalogInfo()
}

/** OpenRouter public prices; only consulted for providers declared as USD. */
export async function loadRouterPricing() {
  try {
    const raw = await fetchJson(ROUTER)
    const parsed = loadCatalog({ models: routerModels(raw), currency: 'USD' }, 'router')
    if (parsed.entries.length > 0) {
      routerCatalog = parsed
      return true
    }
  } catch {
    // keep whatever we had
  }
  return false
}

export function resetPricingForTests() {
  catalog = loadCatalog(BUNDLED, 'bundled')
  routerCatalog = { entries: [], currency: 'USD', source: 'router', updatedAt: null }
  catalogUrl = null
  communityCache = { at: 0, value: null }
  overrides = new Map()
  currencyOf = (providerId) => providerCurrency(providerId)
}
