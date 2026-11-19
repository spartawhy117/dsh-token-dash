import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('../../client.js', import.meta.url), 'utf8')

/**
 * client.js 是宿主加载的 bundle，内部函数不导出。
 * 这里按源码切片取出 trendAxisTicks 的依赖（格式化函数）+ 本体，在本进程里重建一份，
 * 用来锁定刻度档位与取值规则——只验证纯计算，不涉及渲染。
 */
function loadTrendAxisTicks(formatters) {
  const start = source.indexOf('function trendAxisTicks(')
  assert.notEqual(start, -1, 'trendAxisTicks must exist in client.js')
  const end = source.indexOf('\n    }', start)
  const body = source.slice(start, end + 6)
  const factory = new Function(
    'fmtAxisMetric',
    `${body}\nreturn trendAxisTicks`,
  )
  return factory(formatters.fmtAxisMetric)
}

// 与 client.js 同口径的最小实现：只关心「档位数量与取值」，格式用可读替身
const stub = { fmtAxisMetric: (value, metric) => `${metric}:${value}` }
const trendAxisTicks = loadTrendAxisTicks(stub)

test('trendAxisTicks: 下限为 0 时只出上 / 中两档', () => {
  const ticks = trendAxisTicks({ floor: 0, max: 100, metric: 'tokens' })
  assert.deepEqual(ticks.map((tick) => tick.key), ['top', 'mid'])
  assert.equal(ticks[0].text, 'tokens:100')
  assert.equal(ticks[1].text, 'tokens:50')
})

test('trendAxisTicks: 下限不为 0 时补出底部档（命中率轴）', () => {
  const ticks = trendAxisTicks({ floor: 0.95, max: 1, metric: 'hitRate' })
  assert.deepEqual(ticks.map((tick) => tick.key), ['top', 'mid', 'bottom'])
  assert.equal(ticks[2].text, 'hitRate:0.95')
  assert.equal(ticks[1].text, 'hitRate:0.975')
})

test('trendAxisTicks: 全零数据不产生 NaN，上中两档都是 0', () => {
  const ticks = trendAxisTicks({ floor: 0, max: 0, metric: 'tokens' })
  assert.equal(ticks.length, 2)
  assert.equal(ticks[0].text, 'tokens:0')
  assert.equal(ticks[1].text, 'tokens:0')
})

test('trendAxisTicks: max 小于 floor 时按 floor 夹紧（避免负柱高）', () => {
  const ticks = trendAxisTicks({ floor: 0.9, max: 0.5, metric: 'hitRate' })
  assert.equal(ticks[0].text, 'hitRate:0.9')
  assert.equal(ticks[1].text, 'hitRate:0.9')
})

test('trendAxisTicks: 非数值输入按 0 处理，不抛错', () => {
  const ticks = trendAxisTicks({ floor: Number.NaN, max: undefined, metric: 'cost', currency: 'USD' })
  assert.equal(ticks.length, 2)
  assert.equal(ticks[0].text, 'cost:0')
})

test('趋势图渲染点：三档刻度带固定 data-testid，网格线恢复', () => {
  assert.ok(source.includes("'data-testid': `token-dash-trend-axis-${tick.key}`"))
  assert.ok(source.includes('{ ...styles.trendGrid, top: 0 }'))
  assert.ok(source.includes("{ ...styles.trendGrid, top: '50%' }"))
  assert.ok(source.includes('{ ...styles.trendGrid, bottom: 18 }'))
})

test('轴宽自适应：柱区 paddingLeft 与悬停层都用 axisPad，不再硬编码 34', () => {
  assert.ok(source.includes('paddingLeft: axisPad'))
  assert.ok(!source.includes('left: `calc(34px + (100% - 34px)'))
})
