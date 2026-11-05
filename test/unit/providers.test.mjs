import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_MODELS,
  canBeSubscription,
  defaultModelFor,
  modelLabel,
  normalizeProvider,
  pricingLinks,
  providerCurrency,
  providerDescriptor,
  providerFromModel,
  providerLabel,
} from '../../src/providers.js'

test('registry descriptors keep the seven-provider contract', () => {
  assert.deepEqual(pricingLinks().map((item) => item.id), ['deepseek-official', 'zhipu', 'moonshot', 'openrouter', 'qwen', 'opencode-go', 'command-code'])
  assert.deepEqual(pricingLinks().map((item) => item.label), ['DeepSeek', 'Zhipu AI', 'Kimi', 'OpenRouter', 'Qwen', 'OpenCode Go', 'Command Code'])
  assert.equal(pricingLinks().length, 7)
  assert.equal(providerLabel('deepseek-account'), 'DeepSeek')
  assert.equal(providerLabel('zai-coding'), 'Zhipu AI')
  assert.equal(providerLabel('opencode'), 'OpenCode Go')
  assert.equal(providerLabel('commandcode'), 'Command Code')
  assert.equal(providerCurrency('openrouter'), 'USD')
  assert.equal(providerCurrency('qwen'), 'CNY')
  assert.equal(providerCurrency('opencode-go'), 'USD')
  assert.equal(providerCurrency('command-code'), 'CNY')
  assert.equal(canBeSubscription('zhipu'), true)
  assert.equal(canBeSubscription('moonshot'), true)
  assert.equal(canBeSubscription('opencode-go'), true)
  assert.equal(canBeSubscription('command-code'), true)
  assert.equal(canBeSubscription('openrouter'), false)
  assert.equal(providerDescriptor('unknown'), null)
})

test('default models and compat table stay unchanged', () => {
  assert.deepEqual(DEFAULT_MODELS, {
    'deepseek-official': 'deepseek-v4.1-flash',
    zhipu: 'glm-5.3',
    moonshot: 'kimi-k3',
    openrouter: '-',
    qwen: 'qwen3.8-max',
    'opencode-go': '-',
    'command-code': '-',
  })
  for (const [id, model] of Object.entries(DEFAULT_MODELS)) {
    assert.equal(defaultModelFor(id), model)
  }
})

test('model ownership and labels come from descriptors', () => {
  assert.equal(providerFromModel('deepseek-v4.1-flash'), 'deepseek-official')
  assert.equal(providerFromModel('glm-5.3'), 'zhipu')
  assert.equal(providerFromModel('kimi-k3'), 'moonshot')
  assert.equal(providerFromModel('qwen3.8-max'), 'qwen')
  assert.equal(providerFromModel('unknown-model'), null)
  assert.equal(modelLabel('deepseek-flash'), 'DeepSeek-V4.1-Flash')
  assert.equal(modelLabel('glm-5.3'), 'GLM-5.3')
  assert.equal(modelLabel('kimi-k3.1-pro'), 'Kimi K3.1 Pro')
  assert.equal(modelLabel('qwen3.8-flash'), 'Qwen3.8-Flash')
  assert.equal(modelLabel('openrouter/auto'), 'auto')
  assert.equal(normalizeProvider('DEEPSEEK'), 'deepseek-official')
})
