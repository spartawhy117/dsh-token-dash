import test from 'node:test'
import assert from 'node:assert/strict'
import { loadCatalog } from '../../src/catalog.js'
import { explainMiss, parseModelId, resolveMatch } from '../../src/match.js'

const { entries } = loadCatalog({
  models: [
    { modelId: 'deepseek-v4.1-flash', family: 'deepseek', aliases: ['deepseek-flash'], input: 1, output: 4 },
    { modelId: 'deepseek-v4.1-pro', family: 'deepseek', aliases: ['deepseek-pro'], input: 4.5, output: 13.5 },
    { modelId: 'deepseek-chat', family: 'deepseek', input: 1.89, output: 7.7 },
    { modelId: 'glm-5.3', family: 'glm', input: 8, output: 28 },
    { modelId: 'glm-5.3-flash', family: 'glm', input: 0.8, output: 2.8 },
    { modelId: 'kimi-k3-air-ioa', family: 'kimi', input: 2, output: 8 },
    { modelId: 'kimi-k3-air-preview', family: 'kimi', input: 2, output: 8 },
  ],
}, 'test')

test('parseModelId：版本、族名、档位与噪声分离', () => {
  assert.deepEqual(parseModelId('deepseek-v4.1-flash-ioa'), {
    version: '4.1',
    family: 'deepseek',
    tags: new Set(['flash', 'ioa']),
  })
  assert.equal(parseModelId('deepseek-v41-flash-1017').version, '41')
  assert.equal(parseModelId('deepseek-v41-flash-1017').family, 'deepseek')
  assert.equal(parseModelId(''), null)
})

test('四级优先级：exact > alias > pattern > fuzzy', () => {
  assert.equal(resolveMatch('deepseek-v4.1-flash', entries).confidence, 'exact')
  assert.equal(resolveMatch('deepseek-flash', entries).confidence, 'alias')
  const fuzzy = resolveMatch('deepseek-v4.1-flash-ioa', entries)
  assert.equal(fuzzy.confidence, 'fuzzy')
  assert.equal(fuzzy.entry.modelId, 'deepseek-v4.1-flash')
  assert.deepEqual(fuzzy.deltaTags, ['ioa'])
})

test('版本段与档位强约束：不跨版本、不剥档位词', () => {
  assert.equal(resolveMatch('deepseek-chat', entries).entry.modelId, 'deepseek-chat')
  assert.equal(resolveMatch('deepseek-v4.1-flash-pro', entries), null)
  assert.equal(resolveMatch('glm-5.3-pro', entries), null)
  assert.equal(resolveMatch('glm-5.2', entries), null)
})

test('多候选不猜，并给出 ambiguous 归因', () => {
  // 两条仅差噪声词的条目同时满足结构化条件 → 不猜
  assert.equal(resolveMatch('kimi-k3-air-ioa-preview', entries), null)
  assert.equal(explainMiss('kimi-k3-air-ioa-preview', entries), 'ambiguous')
  assert.equal(explainMiss('mystery-model', entries), 'no-model-price')
  assert.equal(explainMiss('', entries), 'invalid-model')
})
