import { addRecord, normalizeModel, num, reattributeUnknown } from './core.js'

const USAGE_TYPES = new Set(['assistant/message', 'compaction/summary'])

export function recordFromEvent(event) {
  if (event === null || typeof event !== 'object') return undefined
  if (!USAGE_TYPES.has(event.type)) return undefined
  const usage = event.data?.usage
  if (usage === null || typeof usage !== 'object') return undefined
  const source = event.data?.message?.source ?? event.data ?? {}
  return {
    ts: num(event.time) || Date.now(),
    sessionId: '',
    provider: typeof source.provider === 'string' ? source.provider : 'unknown',
    model: source.model ?? '',
    input: num(usage.inputTokens),
    cacheRead: num(usage.cacheReadTokens),
    cacheWrite: num(usage.cacheWriteTokens),
    output: num(usage.outputTokens),
  }
}

/** #43：request/header 的请求头配置——message.source 缺失时的归属回退层（形状参考 dsh-ui-usage-billing aggregate）。 */
export function headerFromEvent(event) {
  if (event?.type !== 'request/header') return undefined
  const config = event.data?.header?.config ?? event.data?.config
  const provider = typeof config?.provider === 'string' && config.provider !== '' ? config.provider : undefined
  const model = typeof config?.model === 'string' && config.model !== '' ? config.model : undefined
  if (provider === undefined && model === undefined) return undefined
  return { provider, model }
}

/** 入账一条事件；返回记录或 undefined。`kindOf` 缺省时 `addRecord` 走 registry 兜底。 */
export function ingest(state, sessionId, event, seedFloor = 0, kindOf) {
  const seq = num(event?.seq)
  const mark = num(state.watermarks[sessionId])
  if (seq > 0 && seq <= mark) return undefined
  if (seq > 0 && seq < num(seedFloor)) return undefined
  // #43：维护会话级 header 归属状态（backfill 顺序遍历天然重建）
  const header = headerFromEvent(event)
  if (header !== undefined) {
    state.headers[sessionId] = { ...(state.headers[sessionId] ?? {}), ...header }
  }
  const record = recordFromEvent(event)
  if (record === undefined) {
    if (seq > 0) state.watermarks[sessionId] = seq
    return undefined
  }
  record.sessionId = sessionId
  // #43：usage 事件无 message.source 时，回退最近一条 request/header 的归属
  if (record.provider === 'unknown' || record.model === '') {
    const fallback = state.headers[sessionId]
    if (fallback !== undefined) {
      if (record.provider === 'unknown' && fallback.provider !== undefined) record.provider = fallback.provider
      if (record.model === '' && fallback.model !== undefined) record.model = fallback.model
    }
  }
  addRecord(state, record, kindOf)
  if (seq > 0) state.watermarks[sessionId] = seq
  return record
}

export async function backfill(ctx, state, kindOf) {
  const persistence = ctx.get?.('sessionPersistence')
  if (persistence === undefined || typeof persistence.list !== 'function') {
    return { sessions: 0, records: 0, degraded: 'no-session-persistence' }
  }
  let sessions = 0
  let records = 0
  const providerByModel = new Map()
  const list = await persistence.list()
  for (const header of Array.isArray(list) ? list : []) {
    const id = header?.id
    if (typeof id !== 'string' || id === '') continue
    sessions += 1
    let handle
    try {
      handle = await persistence.open(id, 'read')
      const events = await handle.read(0, Number.MAX_SAFE_INTEGER)
      const seed = num(header.seedLength) || num(handle.inheritedEventCount)
      for (const event of Array.isArray(events) ? events : []) {
        const source = event?.data?.message?.source
        if (typeof source?.provider === 'string' && typeof source?.model === 'string') {
          const model = normalizeModel(source.model)
          const providers = providerByModel.get(model) ?? new Set()
          providers.add(source.provider)
          providerByModel.set(model, providers)
        }
        if (ingest(state, id, event, seed, kindOf) !== undefined) records += 1
      }
    } catch {
      // 单个会话失败不影响其余会话
    } finally {
      try {
        await handle?.close?.()
      } catch {
        // ignore
      }
    }
  }
  reattributeUnknown(state, providerByModel)
  return { sessions, records, degraded: null }
}
