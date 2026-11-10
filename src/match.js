/**
 * Model-name matching: pure functions over catalog entries.
 * Knows nothing about providers, credentials or overrides — those belong to
 * `pricing.js` (which has the provider string) and `core.js` (which decides
 * whether a row is billable at all).
 */
import { normalizeModel } from './providers.js'

/** Words that change the price tier: never stripped, never matched loosely. */
const SIGNIFICANT = new Set([
  'flash', 'pro', 'max', 'mini', 'air', 'plus', 'turbo', 'lite',
  'coder', 'code', 'reasoner', 'chat', 'vision',
])

/** Deployment noise: stripped for fuzzy matching, kept as evidence in logs. */
const NOISE = new Set([
  'ioa', 'exp', 'experimental', 'preview', 'beta', 'alpha', 'rc', 'dev', 'test',
  'latest', 'stable', 'prod', 'production', 'free', 'ga',
])

/** A bare `v` left over after removing the version segment is a marker, not a family word. */
const VERSION_MARK = 'v'

/** Non-leading digit runs of 3+ chars are dates / build ids, not family names. */
function isNumericNoise(part) {
  return /^\d{3,}$/.test(part)
}

/**
 * Split a model id into `{ version, family, tags }`.
 * `deepseek-v4.1-flash-ioa` → version `4.1`, family `deepseek`, tags `{flash, ioa}`.
 */
export function parseModelId(raw) {
  const id = normalizeModel(raw)
  if (id === 'unknown') return null
  const version = id.match(/\d+(?:\.\d+)*/)?.[0] ?? null
  const rest = version === null ? id : id.replace(version, '|')
  const parts = rest.split(/[-_|]/).filter((part) => part !== '')
  const family = []
  const tags = new Set()
  parts.forEach((part) => {
    if (part === VERSION_MARK) return
    if (SIGNIFICANT.has(part) || NOISE.has(part) || isNumericNoise(part)) {
      tags.add(part)
      return
    }
    family.push(part)
  })
  return { version, family: family.join('-'), tags }
}

/** Table-provided regexes are pre-compiled in `catalog.js`. */
function patternByModel(modelId, entries) {
  for (const entry of entries) {
    for (const regexp of entry.regexps) {
      if (regexp.test(modelId)) return entry
    }
  }
  return null
}

function parsedOf(entry) {
  entry.parsed ??= parseModelId(entry.modelId)
  return entry.parsed
}

/**
 * Fuzzy candidates: same version segment, same family, candidate tags covered by
 * the request, every extra request tag either significant-free or known noise.
 */
function fuzzyCandidates(modelId, entries) {
  const req = parseModelId(modelId)
  if (req === null) return []
  return entries.filter((entry) => {
    const parsed = parsedOf(entry)
    if (parsed === null) return false
    if (parsed.version !== req.version || parsed.family !== req.family) return false
    for (const tag of parsed.tags) {
      if (!req.tags.has(tag)) return false
    }
    for (const tag of req.tags) {
      if (!parsed.tags.has(tag) && !NOISE.has(tag)) return false
    }
    return true
  })
}

/**
 * Four-level short-circuit: exact → alias → pattern → fuzzy.
 * Returns `{ entry, confidence, deltaTags }` or null; never guesses on ties.
 */
export function resolveMatch(model, entries) {
  const modelId = normalizeModel(model)
  if (modelId === 'unknown') return null

  const exact = entries.find((entry) => entry.modelId === modelId)
  if (exact !== undefined) return { entry: exact, confidence: 'exact', deltaTags: [] }

  const alias = entries.find((entry) => entry.aliases.includes(modelId))
  if (alias !== undefined) return { entry: alias, confidence: 'alias', deltaTags: [] }

  const pattern = patternByModel(modelId, entries)
  if (pattern !== null) return { entry: pattern, confidence: 'pattern', deltaTags: [] }

  const candidates = fuzzyCandidates(modelId, entries)
  if (candidates.length !== 1) return null
  const entry = candidates[0]
  const reqTags = parseModelId(modelId)?.tags ?? new Set()
  const entryTags = parsedOf(entry)?.tags ?? new Set()
  const deltaTags = [...reqTags].filter((tag) => !entryTags.has(tag))
  return { entry, confidence: 'fuzzy', deltaTags }
}

/** Why did `resolveMatch` fail? `ambiguous` vs `no-model-price` (for `reason`). */
export function explainMiss(model, entries) {
  const modelId = normalizeModel(model)
  if (modelId === 'unknown') return 'invalid-model'
  return fuzzyCandidates(modelId, entries).length > 1 ? 'ambiguous' : 'no-model-price'
}
