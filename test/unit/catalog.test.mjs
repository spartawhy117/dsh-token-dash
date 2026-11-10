import test from 'node:test'
import assert from 'node:assert/strict'
import { loadCatalog } from '../../src/catalog.js'

test('社区行归一：不因 provider 缺失丢弃，纯模型维度入表', () => {
  const { entries } = loadCatalog({
    models: [
      { modelId: 'deepseek-v4.1-flash', family: 'deepseek', inputCostPerMillion: 1, outputCostPerMillion: 4, cacheReadCostPerMillion: 0.02 },
      { modelId: 'glm-5.3', family: 'glm', inputCostPerMillion: 8, outputCostPerMillion: 28 },
      { modelId: '', inputCostPerMillion: 1, outputCostPerMillion: 1 },
      { modelId: 'no-price-model', family: 'x' },
    ],
  }, 'community')
  assert.deepEqual(entries.map((entry) => entry.modelId), ['deepseek-v4.1-flash', 'glm-5.3'])
  assert.equal(entries[0].currency, 'CNY')
})

test('按 modelId 去重，先到先得', () => {
  const { entries, dropped } = loadCatalog({
    models: [
      { modelId: 'glm-5.3', input: 8, output: 28 },
      { modelId: 'GLM-5.3', input: 9, output: 30 },
    ],
  }, 'community')
  assert.equal(entries.length, 1)
  assert.equal(entries[0].prices.input, 8)
  assert.equal(dropped, 1)
})

test('aliasPatterns 预编译，单条非法只丢该条', () => {
  const { entries } = loadCatalog({
    models: [{
      modelId: 'claude-sonnet-4.5',
      input: 21,
      output: 105,
      aliasPatterns: ['^claude-sonnet-4-5$', '([bad', '^claude-sonnet-4-5-thinking$'],
    }],
  }, 'community')
  assert.equal(entries[0].regexps.length, 2)
  assert.equal(entries[0].regexps[0].test('claude-sonnet-4-5'), true)
})

test('dailySlots 只在标准工作日窗口下转峰谷，其余保持平坦价', () => {
  const { entries } = loadCatalog({
    models: [
      {
        modelId: 'a-standard',
        inputCostPerMillion: 1,
        outputCostPerMillion: 4,
        dailySlots: [{
          windows: [{ startMinute: 540, endMinute: 720 }, { startMinute: 840, endMinute: 1080 }],
          daysOfWeek: [1, 2, 3, 4, 5],
          inputCostPerMillion: 2,
          outputCostPerMillion: 8,
        }],
      },
      {
        modelId: 'b-odd-window',
        inputCostPerMillion: 1,
        outputCostPerMillion: 4,
        dailySlots: [{
          windows: [{ startMinute: 0, endMinute: 60 }, { startMinute: 840, endMinute: 1080 }],
          daysOfWeek: [1, 2, 3, 4, 5],
          inputCostPerMillion: 2,
          outputCostPerMillion: 8,
        }],
      },
    ],
  }, 'community')
  const standard = entries.find((entry) => entry.modelId === 'a-standard')
  assert.notEqual(standard.peak, null)
  assert.equal(standard.peak.input, 2)
  assert.equal(standard.prices, null)
  const odd = entries.find((entry) => entry.modelId === 'b-odd-window')
  assert.equal(odd.peak, null)
  assert.equal(odd.prices.input, 1)
})
