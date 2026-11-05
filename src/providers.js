/**
 * Provider registry: identity, billing mode, currency, default model,
 * model ownership/labels and official pricing links. Pure data + lookups.
 */

const ALIASES = {
  'deepseek-account': 'deepseek-official',
  'deepseek-official': 'deepseek-official',
  deepseek: 'deepseek-official',
  glm: 'zhipu',
  zhipu: 'zhipu',
  'z.ai': 'zhipu',
  'zai-coding': 'zhipu',
  'zai-coding-cn': 'zhipu',
  kimi: 'moonshot',
  moonshot: 'moonshot',
  'kimi-coding': 'moonshot',
  qwen: 'qwen',
  dashscope: 'qwen',
  aliyun: 'qwen',
  tongyi: 'qwen',
  openrouter: 'openrouter',
  opencode: 'opencode-go',
  'opencode-go': 'opencode-go',
  commandcode: 'command-code',
  'command-code': 'command-code',
}

/** Display order is also the P3 pricing-link order. */
export const PROVIDER_ORDER = ['deepseek-official', 'zhipu', 'moonshot', 'openrouter', 'qwen', 'opencode-go', 'command-code']

const PROVIDERS = {
  'deepseek-official': {
    id: 'deepseek-official',
    label: 'DeepSeek',
    currency: 'CNY',
    subscription: false,
    defaultModel: 'deepseek-v4.1-flash',
    prefixes: [/^deepseek/],
    modelLabels: {
      'deepseek-flash': 'DeepSeek-V4.1-Flash',
      'deepseek-v4.1-flash': 'DeepSeek-V4.1-Flash',
      'deepseek-v4-flash': 'DeepSeek-V4.1-Flash',
      'deepseek-pro': 'DeepSeek-V4.1-Pro',
      'deepseek-v4-pro': 'DeepSeek-V4.1-Pro',
    },
    pricingUrl: 'https://api-docs.deepseek.com/quick_start/pricing',
  },
  zhipu: {
    id: 'zhipu',
    label: 'Zhipu AI',
    currency: 'CNY',
    subscription: true,
    defaultModel: 'glm-5.3',
    prefixes: [/^glm/],
    modelLabels: {
      'glm-5.3': 'GLM-5.3',
      'glm-5.3-flash': 'GLM-5.3-Flash',
    },
    pricingUrl: 'https://docs.bigmodel.cn/cn/guide/start/pricing',
  },
  moonshot: {
    id: 'moonshot',
    label: 'Kimi',
    currency: 'CNY',
    subscription: true,
    defaultModel: 'kimi-k3',
    prefixes: [/^kimi/, /^moonshot/],
    modelLabels: {
      'kimi-k3': 'Kimi K3',
      'kimi-k3.1-pro': 'Kimi K3.1 Pro',
      'kimi-k2.7-code': 'Kimi K2.7 Code',
    },
    pricingUrl: 'https://platform.moonshot.cn/docs/pricing/chat',
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    currency: 'USD',
    subscription: false,
    defaultModel: '-',
    prefixes: [],
    modelLabels: {},
    pricingUrl: 'https://openrouter.ai/models',
  },
  qwen: {
    id: 'qwen',
    label: 'Qwen',
    currency: 'CNY',
    subscription: false,
    defaultModel: 'qwen3.8-max',
    prefixes: [/^qwen/],
    modelLabels: {
      'qwen3.8-max': 'Qwen3.8-Max',
      'qwen3.8-flash': 'Qwen3.8-Flash',
    },
    pricingUrl: 'https://help.aliyun.com/zh/model-studio/billing-for-alibaba-cloud-model-studio',
  },
  'opencode-go': {
    id: 'opencode-go',
    label: 'OpenCode Go',
    currency: 'USD',
    subscription: true,
    defaultModel: '-',
    prefixes: [/^opencode/],
    modelLabels: {},
    pricingUrl: 'https://opencode.ai/',
  },
  'command-code': {
    id: 'command-code',
    label: 'Command Code',
    currency: 'CNY',
    subscription: true,
    defaultModel: '-',
    prefixes: [],
    modelLabels: {},
    pricingUrl: 'https://commandcode.ai/',
  },
}

export function normalizeProvider(raw) {
  const id = String(raw ?? '').trim().toLowerCase()
  if (id === '') return 'unknown'
  return ALIASES[id] ?? id
}

/** Registry lookup; unknown ids return null. */
export function providerDescriptor(raw) {
  return PROVIDERS[normalizeProvider(raw)] ?? null
}

export function providerLabel(raw) {
  const id = normalizeProvider(raw)
  return PROVIDERS[id]?.label ?? id
}

export function isSupportedProvider(raw) {
  return providerDescriptor(raw) !== null
}

export function providerCurrency(raw) {
  return providerDescriptor(raw)?.currency ?? 'CNY'
}

export function canBeSubscription(raw) {
  return providerDescriptor(raw)?.subscription === true
}

export function providerKind(raw, mode) {
  const id = normalizeProvider(raw)
  if (mode === 'api' || mode === 'subscription') return mode
  return canBeSubscription(id) ? 'subscription' : 'api'
}

/** Configured provider default model; '-' means a placeholder row (OpenRouter). */
export function defaultModelFor(raw) {
  return providerDescriptor(raw)?.defaultModel
}

/** Derived compatibility export for callers that still read the table. */
export const DEFAULT_MODELS = Object.fromEntries(
  PROVIDER_ORDER.map((id) => [id, PROVIDERS[id].defaultModel]),
)

/** Model-name prefixes → provider attribution when DSH events carry no provider. */
export function providerFromModel(modelId) {
  const id = normalizeModel(modelId)
  if (id === 'unknown') return null
  for (const providerId of PROVIDER_ORDER) {
    if (PROVIDERS[providerId].prefixes.some((pattern) => pattern.test(id))) return providerId
  }
  return null
}

export function modelLabel(raw) {
  const id = normalizeModel(raw)
  for (const providerId of PROVIDER_ORDER) {
    const label = PROVIDERS[providerId].modelLabels[id]
    if (label !== undefined) return label
  }
  return id
}

/** Five official pricing pages, in display order; UI consumes this via the VM. */
export function pricingLinks() {
  return PROVIDER_ORDER
    .map((id) => ({ id, label: PROVIDERS[id].label, url: PROVIDERS[id].pricingUrl }))
    .filter((link) => typeof link.url === 'string' && link.url !== '')
}

/** Only folds casing/provider prefix/date suffixes; never merges generations. */
export function normalizeModel(raw) {
  let name = String(raw ?? '').trim().toLowerCase()
  if (name === '') return 'unknown'
  name = name.replace(/^[^/]+\//, '')
  name = name.replace(/@/g, '-')
  name = name.replace(/-free\b/g, '')
  name = name.replace(/-\d{4}-\d{2}-\d{2}\b/g, '')
  name = name.replace(/-\d{8}\b/g, '')
  name = name.replace(/\s+/g, '-')
  return name === '' ? 'unknown' : name
}
