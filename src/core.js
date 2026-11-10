/**
 * Pure aggregation: day/month keys, provider/model buckets, budgets, currencies.
 * No file or clock reads; `now` is injected.
 */
import { explainPriceMiss, resolvePrice } from './pricing.js'
import {
  canBeSubscription,
  defaultModelFor,
  modelLabel,
  normalizeModel,
  normalizeProvider,
  pricingLinks,
  providerCurrency,
  providerFromModel,
  providerKind,
  providerLabel,
} from './providers.js'

export function num(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

export function localDayKey(ts) {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function localMonthKey(ts) {
  return localDayKey(ts).slice(0, 7)
}

/** Kept for compatibility; priceFor handles peak/off-peak internally. */
export function isPeak(ts) {
  const date = new Date(ts + 8 * 60 * 60 * 1000)
  const hour = date.getUTCHours()
  const weekday = date.getUTCDay()
  if (weekday === 0 || weekday === 6) return false
  return (hour >= 9 && hour < 12) || (hour >= 14 && hour < 18)
}

export { normalizeProvider, providerLabel, normalizeModel, resolvePrice }
export const displayModel = modelLabel

export function priceForRecord(model, provider, ts) {
  return resolvePrice(model, provider, ts)
}

/** Undefined price returns 0; the caller marks `priced=false`. */
export function costOf(record) {
  const price = resolvePrice(record.model, record.provider ?? 'unknown', record.ts)
  if (price === null) return 0
  return (
    (num(record.input) * price.input +
      num(record.cacheRead) * price.cacheRead +
      num(record.cacheWrite) * price.cacheWrite +
      num(record.output) * price.output) /
    1e6
  )
}

export function emptyState() {
  return {
    version: 1,
    costVersion: 4,
    days: {},
    watermarks: {},
    headers: {},
    currentProvider: null,
    providerKinds: {},
  }
}

function dayStartTs(dayKey) {
  const [year, month, day] = String(dayKey).split('-').map(Number)
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  return new Date(year, month - 1, day).getTime()
}

/**
 * 旧计价模型的成本在入账时写死；定价修复后按日级 token 与当日 00:00 价目重算。
 * 日级聚合没有单条记录时间，峰谷只能按 00:00（闲时）代表，结果属于估算。
 * 重算同样走「形态先于计价 + 币种不匹配不计价」，订阅行与零消耗行保持原状态。
 */
export function repriceState(state, kindOf = (id) => providerKind(id)) {
  if (state.costVersion === 4) return { repriced: false, rows: 0 }
  let rows = 0
  for (const [dayKey, bucket] of Object.entries(state.days ?? {})) {
    const ts = dayStartTs(dayKey)
    if (ts === null) continue
    for (const [providerId, providerBucket] of Object.entries(bucket?.providers ?? {})) {
      for (const [model, row] of Object.entries(providerBucket?.models ?? {})) {
        // unknown 行只影响计价归属；展示层仍按模型前缀归因
        const owner = providerId === 'unknown' ? providerFromModel(model) : providerId
        // 形态先于计价：订阅 provider 的行保持原值，重算不得写成金额
        if (owner !== null && kindOf(owner) !== 'api') continue
        const empty = num(row.input) + num(row.cacheRead) + num(row.cacheWrite) + num(row.output) === 0
        const price = owner === null ? null : resolvePrice(model, owner, ts)
        const missing = price === null || price.mismatch === true || price.input === null || price.output === null
        row.cost = missing || empty
          ? 0
          : costOf({ ts, provider: owner ?? providerId, model, input: row.input, cacheRead: row.cacheRead, cacheWrite: row.cacheWrite, output: row.output })
        if (empty) {
          row.priced = 'empty'
          delete row.reason
        } else if (missing) {
          row.priced = false
          row.reason = price === null ? explainPriceMiss(model) : 'currency-mismatch'
        } else {
          row.priced = true
          delete row.reason
        }
        rows += 1
      }
    }
  }
  state.costVersion = 4
  return { repriced: true, rows }
}

function dayBucket(state, dayKey) {
  state.days[dayKey] ??= { models: {} }
  return state.days[dayKey]
}

/** Only attribute old unknown rows when a model appeared under exactly one provider. */
export function reattributeUnknown(state, providerByModel) {
  for (const bucket of Object.values(state.days ?? {})) {
    const unknown = bucket?.providers?.unknown?.models
    if (unknown === undefined) continue
    for (const [model, row] of Object.entries(unknown)) {
      const providers = providerByModel.get(model)
      if (providers === undefined || providers.size !== 1) continue
      const provider = normalizeProvider([...providers][0])
      if (provider === 'unknown') continue
      const targetBucket = (bucket.providers[provider] ??= { models: {} })
      const target = targetBucket.models[model]
      if (target === undefined) {
        targetBucket.models[model] = row
      } else {
        target.input += num(row.input)
        target.cacheRead += num(row.cacheRead)
        target.cacheWrite += num(row.cacheWrite)
        target.output += num(row.output)
        target.requests += num(row.requests)
        target.cost += num(row.cost)
        target.priced = target.priced !== false && row.priced !== false
      }
      delete unknown[model]
    }
    if (Object.keys(unknown).length === 0) delete bucket.providers.unknown
  }
}

export function addRecord(state, record, kindOf = (id) => providerKind(id)) {
  const day = localDayKey(record.ts)
  const bucket = dayBucket(state, day)
  if (bucket.providers === undefined) {
    bucket.providers = { unknown: { models: bucket.models ?? {} } }
    delete bucket.models
  }
  const provider = normalizeProvider(record.provider)
  const providerBucket = (bucket.providers[provider] ??= { models: {} })
  const model = normalizeModel(record.model)
  const row = (providerBucket.models[model] ??= {
    input: 0,
    cacheRead: 0,
    cacheWrite: 0,
    output: 0,
    requests: 0,
    cost: 0,
    priced: true,
  })
  row.input += num(record.input)
  row.cacheRead += num(record.cacheRead)
  row.cacheWrite += num(record.cacheWrite)
  row.output += num(record.output)
  row.requests += 1
  // 形态先于计价：订阅套餐按套餐结算，套模型价会把 USD 订阅算成 RMB 用量费（REQ-12）。
  if (kindOf(provider) === 'subscription') {
    row.priced = 'subscription'
    delete row.reason
  } else {
    const price = resolvePrice(model, provider, record.ts)
    // 币种不匹配按未定价处理：宁可空着，也不把 CNY 报价写进 USD 桶（REQ-03）
    if (price === null || price.mismatch === true) {
      row.priced = false
      row.reason = price === null ? explainPriceMiss(model) : 'currency-mismatch'
    } else {
      row.priced = true
      delete row.reason
      row.cost += (
        num(record.input) * price.input +
        num(record.cacheRead) * price.cacheRead +
        num(record.cacheWrite) * price.cacheWrite +
        num(record.output) * price.output
      ) / 1e6
    }
  }
  // 零消耗行与"真缺价"必须可区分：最后写，覆盖上面两种结果（REQ-10）。
  if (row.input + row.cacheRead + row.cacheWrite + row.output === 0) row.priced = 'empty'
  state.currentProvider = provider
}

/**
 * 只补 `priced === false` 的行；`true` / `'subscription'` / `'empty'` 一律不动。
 * `unknown` 桶按模型前缀归因，避免"展示有归属、补算却跳过"。
 */
export function repriceUnpriced(state, scope, kindOf = (id) => providerKind(id)) {
  const month = typeof scope?.month === 'string' && /^\d{4}-\d{2}$/.test(scope.month) ? scope.month : null
  const result = { scope: scope?.month ?? 'all', rows: 0, skipped: { 'no-owner': 0, kind: 0, 'no-price': 0, currency: 0 } }
  for (const [dayKey, bucket] of Object.entries(state.days ?? {})) {
    if (month !== null && !dayKey.startsWith(`${month}-`)) continue
    const ts = dayStartTs(dayKey)
    if (ts === null) continue
    for (const [providerId, providerBucket] of Object.entries(bucket?.providers ?? {})) {
      for (const [rawModel, row] of Object.entries(providerBucket?.models ?? {})) {
        if (row?.priced !== false) continue
        const model = normalizeModel(rawModel)
        const owner = providerId === 'unknown' ? providerFromModel(model) : providerId
        if (owner === null) {
          result.skipped['no-owner'] += 1
          continue
        }
        if (kindOf(owner) !== 'api') {
          result.skipped.kind += 1
          continue
        }
        const price = resolvePrice(model, owner, ts)
        if (price === null) {
          result.skipped['no-price'] += 1
          continue
        }
        // 币种不符的行保持未定价，只把原因改写清楚，等用户补 USD 单价后再补算
        if (price.mismatch === true) {
          result.skipped.currency += 1
          row.reason = 'currency-mismatch'
          continue
        }
        row.cost = (
          num(row.input) * price.input +
          num(row.cacheRead) * price.cacheRead +
          num(row.cacheWrite) * price.cacheWrite +
          num(row.output) * price.output
        ) / 1e6
        row.priced = true
        delete row.reason
        result.rows += 1
      }
    }
  }
  return result
}

/** 未填写时的默认预算，按 provider 币种；只在 VM 内生效，不写盘。 */
export const DEFAULT_BUDGET = 100

function budgetFor(prefs, providerId, currency) {
  const map = prefs?.budgets?.[providerId]
  const explicitZero = map?.amount === 0
  let amount = num(map?.amount)
  let state = 'unset'
  // 未填写（新装、新增 provider、老用户无显式配置）统一按 100；显式 0 才是"未设置"
  if (amount <= 0 && !explicitZero) amount = DEFAULT_BUDGET
  if (explicitZero) amount = 0
  return {
    amount,
    used: 0,
    remaining: 0,
    percent: 0,
    state,
    // 预算币种只跟 provider 当前币种，落盘的 budgets[id].currency 不参与计算
    currency: currency === 'USD' ? 'USD' : 'CNY',
  }
}

function providerEmpty(providerId, kind = 'api') {
  return {
    id: providerId,
    name: providerLabel(providerId),
    kind,
    canSubscribe: canBeSubscription(providerId),
    currency: providerCurrency(providerId),
    usage: { todayTokens: 0, monthTokens: 0, todayCost: 0, monthCost: 0, requests: 0 },
    models: [],
    windows: [],
  }
}

function normalizeProviderInfo(input) {
  if (Array.isArray(input)) return input
  if (input === null || typeof input !== 'object') return []
  return Object.entries(input).map(([id, value]) => ({ id, ...(value ?? {}) }))
}

const BILLING_MODES = new Set(['api', 'subscription'])

function emptyTotals() {
  return { cost: 0, requests: 0, input: 0, cacheRead: 0, cacheWrite: 0, output: 0, hitRate: null }
}

/** 行内与 0 桶共用：声明 > 快照 > registry，不写死 CNY。 */
function usageCurrency(providerId, meta, prefs) {
  const declared = prefs?.providerCurrency?.[providerId]
  if (declared === 'USD' || declared === 'CNY') return declared
  if (meta?.currency === 'USD') return 'USD'
  if (meta?.currency === 'CNY') return 'CNY'
  return providerCurrency(providerId)
}

/** 币种来源只影响展示文案，不参与计算（BND-10）。 */
function currencySourceOf(prefs, providerId, meta) {
  const declared = prefs?.providerCurrency?.[providerId]
  if (declared === 'USD' || declared === 'CNY') return 'prefs'
  if (meta?.currency === 'USD' || meta?.currency === 'CNY') return 'snapshot'
  return 'community'
}

/**
 * prefs 显式覆盖 > 快照确定的 mode > 历史固化值 > registry 静态声明 > api。
 * `meta.kind` 是 adapter 规整后的回声值（非订阅一律 `api`），不能当作"探测到了 api"的证据。
 */
export function resolveProviderKind(state, prefs, providerId, meta) {
  const id = normalizeProvider(providerId)
  const explicit = prefs?.billingModes?.[id]
  if (BILLING_MODES.has(explicit)) return explicit
  if (BILLING_MODES.has(meta?.mode)) return meta.mode
  const stamped = state?.providerKinds?.[id]
  if (BILLING_MODES.has(stamped)) return stamped
  return providerKind(id)
}

/** 只固化"探测确定"的形态；unknown 不覆盖历史，返回是否有变化。 */
export function stampProviderKinds(state, snapshots) {
  state.providerKinds ??= {}
  let changed = false
  for (const item of snapshots ?? []) {
    const id = normalizeProvider(item?.id ?? item?.provider)
    if (id === 'unknown' || !BILLING_MODES.has(item?.mode)) continue
    if (state.providerKinds[id] === item.mode) continue
    state.providerKinds[id] = item.mode
    changed = true
  }
  return changed
}

/**
 * Range-only aggregation for P2. Unlike buildSummary this never adds
 * "configured but unused" default rows, and it does not touch month budgets.
 */
export function buildUsage(state, prefs, range, now, providerInfoInput) {
  const allowed = new Set(['today', '7d', '30d', 'all'])
  const selected = allowed.has(range) ? range : 'today'
  const todayKey = localDayKey(now)
  const dayKeys = Object.keys(state.days ?? {}).filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key)).sort()
  const startKey = selected === 'all'
    ? (dayKeys[0] ?? todayKey)
    : localDayKey(now - (selected === '30d' ? 29 : selected === '7d' ? 6 : 0) * 86400000)
  const hidden = new Set(
    Object.entries(prefs?.billingModes ?? {})
      .filter(([, mode]) => mode === 'hide')
      .map(([id]) => normalizeProvider(id)),
  )
  const info = new Map()
  for (const item of normalizeProviderInfo(providerInfoInput)) {
    const id = normalizeProvider(item.id ?? item.provider)
    if (id === 'unknown') continue
    info.set(id, item)
  }
  const models = new Map()
  const totals = {}
  const add = (providerId, modelId, row) => {
    if (hidden.has(providerId)) return
    const meta = info.get(providerId)
    const kind = resolveProviderKind(state, prefs, providerId, meta)
    const billable = kind === 'api'
    const currency = usageCurrency(providerId, meta, prefs)
    const key = `${providerId}:${modelId}`
    const entry = models.get(key) ?? {
      providerId,
      providerName: meta?.name ?? providerLabel(providerId),
      modelId,
      displayName: modelLabel(modelId),
      kind,
      currency,
      billable,
      requests: 0,
      input: 0,
      cacheRead: 0,
      cacheWrite: 0,
      output: 0,
      cost: 0,
      priced: true,
    }
    entry.requests += num(row.requests)
    entry.input += num(row.input)
    entry.cacheRead += num(row.cacheRead)
    entry.cacheWrite += num(row.cacheWrite)
    entry.output += num(row.output)
    entry.billable = billable
    // 订阅模型按目录价算出的 cost 不是真实支出，VM 内归零，保证费用框与 Tokens 框同一集合
    entry.cost += billable ? num(row.cost) : 0
    if (row.priced === false) entry.priced = false
    if (row.priced === 'empty') entry.emptyRows = (entry.emptyRows ?? 0) + 1
    entry.rows = (entry.rows ?? 0) + 1
    entry.kind = kind
    entry.currency = currency
    entry.currencySource = currencySourceOf(prefs, providerId, meta)
    models.set(key, entry)
  }

  for (const dayKey of dayKeys) {
    if (dayKey < startKey || dayKey > todayKey) continue
    const bucket = state.days[dayKey]
    const providers = bucket.providers ?? { unknown: { models: bucket.models ?? {} } }
    for (const [rawProvider, providerBucket] of Object.entries(providers)) {
      const providerId = normalizeProvider(rawProvider)
      if (providerId === 'unknown') {
        for (const [rawModel, row] of Object.entries(providerBucket.models ?? {})) {
          const owner = providerFromModel(rawModel)
          if (owner !== null) add(owner, normalizeModel(rawModel), row)
        }
        continue
      }
      for (const [rawModel, row] of Object.entries(providerBucket.models ?? {})) {
        add(providerId, normalizeModel(rawModel), row)
      }
    }
  }

  const rows = [...models.values()].map((entry) => {
    const total = entry.input + entry.cacheRead + entry.cacheWrite + entry.output
    const denominator = entry.input + entry.cacheRead + entry.cacheWrite
    return {
      ...entry,
      tokens: {
        input: entry.input,
        cacheRead: entry.cacheRead,
        cacheWrite: entry.cacheWrite,
        output: entry.output,
        cache: entry.cacheRead + entry.cacheWrite,
        total,
      },
      hitRate: denominator > 0 ? entry.cacheRead / denominator : null,
      cost: round2(entry.cost),
      approximate: entry.billable && resolvePrice(entry.modelId, entry.providerId, now)?.approximate === true,
      priced: entry.priced !== false
        ? (entry.rows > 0 && (entry.emptyRows ?? 0) < entry.rows ? true : 'empty')
        : false,
      rows: undefined,
      emptyRows: undefined,
    }
  })
  rows.sort((a, b) => b.cost - a.cost)

  // 已检测 provider 先占位 0 桶：范围无消耗（或只有订阅）时两格卡仍要显示 ¥0.00 而不是空白
  for (const [providerId, meta] of info) {
    if (hidden.has(providerId)) continue
    totals[usageCurrency(providerId, meta)] ??= emptyTotals()
  }
  if (Object.keys(totals).length === 0) totals.CNY = emptyTotals()
  for (const row of rows) {
    if (row.billable !== true) continue
    const bucket = totals[row.currency] ?? emptyTotals()
    bucket.cost += row.cost
    bucket.requests += row.requests
    bucket.input += row.input
    bucket.cacheRead += row.cacheRead
    bucket.cacheWrite += row.cacheWrite
    bucket.output += row.output
    totals[row.currency] = bucket
  }
  for (const bucket of Object.values(totals)) {
    bucket.cost = round2(bucket.cost)
    const denominator = bucket.input + bucket.cacheRead + bucket.cacheWrite
    bucket.hitRate = denominator > 0 ? bucket.cacheRead / denominator : null
  }

  const total = rows.reduce((sum, row) => ({
    tokens: sum.tokens + row.tokens.total,
    input: sum.input + row.input,
    cacheRead: sum.cacheRead + row.cacheRead,
    cacheWrite: sum.cacheWrite + row.cacheWrite,
    cache: sum.cache + row.tokens.cache,
    output: sum.output + row.output,
    requests: sum.requests + num(row.requests),
  }), { tokens: 0, input: 0, cacheRead: 0, cacheWrite: 0, cache: 0, output: 0, requests: 0 })
  total.hitRate = total.input + total.cacheRead + total.cacheWrite > 0
    ? total.cacheRead / (total.input + total.cacheRead + total.cacheWrite)
    : null

  return {
    range: selected,
    startAt: dayStartTs(startKey) ?? now,
    endAt: now,
    startKey,
    endKey: todayKey,
    totals,
    total,
    models: rows,
  }
}

export function buildSummary(state, prefs, now, providerInfoInput) {
  const month = localMonthKey(now)
  const todayKey = localDayKey(now)
  const providerMap = new Map()
  const modelsMap = new Map()
  const providerInfo = normalizeProviderInfo(providerInfoInput)
  // billingModes[id] === 'hide' 的 provider 整体不出现在 VM（卡片、费用表、用量表）。
  const hidden = new Set(
    Object.entries(prefs?.billingModes ?? {})
      .filter(([, mode]) => mode === 'hide')
      .map(([id]) => normalizeProvider(id)),
  )

  for (const item of providerInfo) {
    // mode 是快照内部字段，剥离后不进入 VM
    const { plans: legacyPlans, mode: _mode, ...info } = item
    const id = normalizeProvider(info.id ?? info.provider)
    if (id === 'unknown' || hidden.has(id)) continue
    const kind = resolveProviderKind(state, prefs, id, item)
    const currency = usageCurrency(id, item, prefs)
    const base = providerMap.get(id) ?? providerEmpty(id, kind)
    providerMap.set(id, {
      ...base,
      ...info,
      id,
      name: info.name ?? providerLabel(id),
      kind,
      canSubscribe: canBeSubscription(id),
      currency,
      currencySource: currencySourceOf(prefs, id, item),
      usage: { ...base.usage, ...(info.usage ?? {}) },
      balance: info.balance ?? base.balance,
      windows: info.windows ?? legacyPlans ?? base.windows ?? [],
    })
  }

  // #41/#42：unknown 行按模型名前缀视图层归因（不改 daily.json）；models 与 provider.usage 均为当月口径（#42 回退跨月累计）
  const unpriced = []
  const accumulate = (providerId, modelId, row, isToday) => {
    const meta = providerInfo.find((item) => normalizeProvider(item.id ?? item.provider) === providerId)
    const kind = resolveProviderKind(state, prefs, providerId, meta)
    const provider = providerMap.get(providerId) ?? providerEmpty(providerId, kind)
    providerMap.set(providerId, provider)
    const key = `${providerId}:${modelId}`
    const entry = modelsMap.get(key) ?? {
      name: modelId,
      modelId,
      providerId,
      providerName: providerLabel(providerId),
      displayName: modelLabel(modelId),
      kind,
      currency: provider.currency,
      currencySource: provider.currencySource,
      priced: true,
      approximate: false,
      reason: null,
      requests: 0,
      input: 0,
      cacheRead: 0,
      cacheWrite: 0,
      output: 0,
      cost: 0,
      rows: 0,
    }
    entry.requests += num(row.requests)
    entry.input += num(row.input)
    entry.cacheRead += num(row.cacheRead)
    entry.cacheWrite += num(row.cacheWrite)
    entry.output += num(row.output)
    entry.rows += 1
    // 订阅行按套餐结算：历史里存下的目录价不算支出（REQ-12）
    const billable = kind === 'api'
    entry.cost += billable ? num(row.cost) : 0
    if (row.priced === false) {
      entry.priced = false
      entry.reason ??= row.reason ?? 'no-model-price'
    }
    if (row.priced === 'empty') entry.emptyRows = (entry.emptyRows ?? 0) + 1
    if (billable && row.priced === false) {
      unpriced.push({
        modelId,
        providerId,
        tokens: num(row.input) + num(row.cacheRead) + num(row.cacheWrite) + num(row.output),
        requests: num(row.requests),
        reason: row.reason ?? 'no-model-price',
      })
    }
    const price = resolvePrice(modelId, providerId, now)
    if (price?.approximate === true) entry.approximate = true
    modelsMap.set(key, entry)
    const tokens = num(row.input) + num(row.cacheRead) + num(row.cacheWrite) + num(row.output)
    provider.usage.monthTokens += tokens
    provider.usage.monthCost += billable ? num(row.cost) : 0
    provider.usage.requests += num(row.requests)
    if (isToday) {
      provider.usage.todayTokens += tokens
      provider.usage.todayCost += billable ? num(row.cost) : 0
    }
    provider.models.push(entry.modelId)
  }

  for (const [dayKey, bucket] of Object.entries(state.days ?? {})) {
    if (!dayKey.startsWith(`${month}-`)) continue
    const isToday = dayKey === todayKey
    const providers = bucket.providers ?? { unknown: { models: bucket.models ?? {} } }
    for (const [rawProvider, providerBucket] of Object.entries(providers)) {
      const providerId = normalizeProvider(rawProvider)
      if (providerId === 'unknown') {
        for (const [rawModel, row] of Object.entries(providerBucket.models ?? {})) {
          const owner = providerFromModel(rawModel)
          if (owner === null || hidden.has(owner)) continue
          accumulate(owner, normalizeModel(rawModel), row, isToday)
        }
        continue
      }
      if (hidden.has(providerId)) continue
      for (const [rawModel, row] of Object.entries(providerBucket.models ?? {})) {
        accumulate(providerId, normalizeModel(rawModel), row, isToday)
      }
    }
  }

  // #44/#45：已配置 provider 本月无真实模型行时补默认模型行（数值 0）——"配置即可见"，
  // 与严格本月口径兼容（不引入跨月数据）；真实行优先不重复补；
  // '-' 占位（中转无默认模型）在该 provider 出现任何真实模型行后不再补
  for (const info of providerInfo) {
    const id = normalizeProvider(info.id ?? info.provider)
    if (id === 'unknown' || hidden.has(id)) continue
    const fallbackModel = defaultModelFor(id)
    if (fallbackModel === undefined) continue
    const key = `${id}:${fallbackModel}`
    // provider 已有任意真实模型行时不再补默认行（含 '-' 占位语义）
    if ([...modelsMap.keys()].some((k) => k.startsWith(`${id}:`))) continue
    const provider = providerMap.get(id)
    modelsMap.set(key, {
      name: fallbackModel,
      modelId: fallbackModel,
      providerId: id,
      providerName: providerLabel(id),
      displayName: modelLabel(fallbackModel),
      kind: provider?.kind === 'subscription' ? 'subscription' : 'api',
      currency: provider?.currency ?? providerCurrency(id),
      currencySource: provider?.currencySource ?? 'community',
      priced: 'empty',
      approximate: false,
      reason: null,
      requests: 0,
      input: 0,
      cacheRead: 0,
      cacheWrite: 0,
      output: 0,
      cost: 0,
      rows: 0,
    })
  }

  const models = [...modelsMap.values()].map((entry) => {
    const tokens = entry.input + entry.cacheRead + entry.cacheWrite + entry.output
    entry.tokens = { input: entry.input, cacheRead: entry.cacheRead, output: entry.output, total: tokens }
    entry.hitRate = entry.input + entry.cacheWrite + entry.cacheRead > 0
      ? entry.cacheRead / (entry.input + entry.cacheWrite + entry.cacheRead)
      : null
    entry.cost = round2(entry.cost)
    entry.share = 0
    // 四态收敛：任一行真缺价 → false；全是零消耗行 → 'empty'；其余 true
    if (entry.priced !== false) {
      entry.priced = entry.rows > 0 && (entry.emptyRows ?? 0) < entry.rows ? true : 'empty'
    }
    if (entry.priced !== false) entry.reason = null
    delete entry.rows
    delete entry.emptyRows
    return entry
  })
  models.sort((a, b) => b.cost - a.cost)

  const providers = [...providerMap.values()].map((provider) => {
    const budget = provider.kind === 'api' ? budgetFor(prefs, provider.id, provider.currency) : undefined
    if (budget !== undefined) {
      budget.used = round2(provider.usage.monthCost)
      budget.remaining = round2(Math.max(0, budget.amount - budget.used))
      budget.percent = budget.amount > 0 ? Math.min(9.99, budget.used / budget.amount) : 0
      budget.state = budget.amount <= 0 ? 'unset' : budget.percent >= 1 ? 'over' : budget.percent >= 0.8 ? 'warn' : 'ok'
    }
    provider.usage.todayCost = round2(provider.usage.todayCost)
    provider.usage.monthCost = round2(provider.usage.monthCost)
    return { ...provider, budget }
  })
  providers.sort((a, b) => {
    if (a.id === state.currentProvider) return -1
    if (b.id === state.currentProvider) return 1
    return b.usage.todayCost - a.usage.todayCost
  })

  const modelsByCurrency = new Map()
  for (const row of models) {
    if (row.kind !== 'api') continue
    const bucket = modelsByCurrency.get(row.currency) ?? { total: 0 }
    bucket.total += row.cost
    modelsByCurrency.set(row.currency, bucket)
  }
  for (const row of models) {
    if (row.kind !== 'api') continue
    const total = modelsByCurrency.get(row.currency)?.total ?? 0
    row.share = total > 0 ? Math.min(1, row.cost / total) : 0
  }

  const apiTotals = {}
  for (const provider of providers) {
    if (provider.kind !== 'api') continue
    const currency = provider.currency
    const total = apiTotals[currency] ?? { today: 0, month: 0, budget: 0, remaining: 0 }
    total.today += provider.usage.todayCost
    total.month += provider.usage.monthCost
    total.budget += provider.budget?.amount ?? 0
    total.remaining += provider.budget?.remaining ?? 0
    apiTotals[currency] = total
  }
  for (const total of Object.values(apiTotals)) {
    total.today = round2(total.today)
    total.month = round2(total.month)
    total.budget = round2(total.budget)
    total.remaining = round2(total.remaining)
  }

  const totalCost = round2(models.reduce((sum, row) => sum + (row.kind === 'api' ? row.cost : 0), 0))
  const unpricedModels = models.filter((row) => row.priced === false).map((row) => `${row.providerId}:${row.modelId}`)
  const totals = models.reduce((out, row) => ({
    input: out.input + row.input,
    cacheRead: out.cacheRead + row.cacheRead,
    cacheWrite: out.cacheWrite + row.cacheWrite,
    output: out.output + row.output,
    requests: out.requests + row.requests,
  }), { input: 0, cacheRead: 0, cacheWrite: 0, output: 0, requests: 0 })
  const totalTokens = totals.input + totals.cacheRead + totals.cacheWrite + totals.output
  const hitRate = totals.input + totals.cacheWrite + totals.cacheRead > 0
    ? totals.cacheRead / (totals.input + totals.cacheWrite + totals.cacheRead)
    : null
  const today = providers.reduce((sum, provider) => ({
    tokens: sum.tokens + provider.usage.todayTokens,
    cost: sum.cost + provider.usage.todayCost,
    requests: sum.requests + provider.usage.requests,
  }), { tokens: 0, cost: 0, requests: 0 })
  const current = state.currentProvider ?? providers[0]?.id ?? null

  return {
    month,
    tokens: {
      input: totals.input,
      cacheRead: totals.cacheRead,
      cacheWrite: totals.cacheWrite,
      output: totals.output,
      total: totalTokens,
      hitRate,
    },
    cost: { estimated: totalCost, currency: 'CNY', unpricedModels, unpriced },
    today: { tokens: today.tokens, cost: round2(today.cost), requests: today.requests },
    requests: { month: totals.requests, today: today.requests },
    providers,
    apiTotals,
    currentProviderId: current,
    breakdown: { models },
    pricingLinks: pricingLinks(),
    showBalance: prefs?.showBalance !== false,
    updatedAt: now,
    stale: false,
  }
}

export function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}
