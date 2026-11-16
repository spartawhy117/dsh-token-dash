import test from 'node:test'
import assert from 'node:assert/strict'
import { isNewer } from '../../src/version.js'

/**
 * 更新检测的调度与判定契约。
 * 判定直接复用生产实现 src/version.js 的 isNewer，不在这里复刻逻辑——
 * 复刻会导致「改坏代码测试仍然通过」。
 */
const UPDATE_INTERVAL_MS = 4 * 60 * 60 * 1000

/** 与 client.js · apply 内 isDue 同构：距上次检测是否已满一个周期。 */
const isDue = (lastAt, now) => now - (Number(lastAt) || 0) >= UPDATE_INTERVAL_MS

test('真实版本场景：2.1.0 能看到已发布的 2.2.0', () => {
  assert.equal(isNewer('2.2.0', '2.1.0'), true, '旧版本必须判定为可更新')
  assert.equal(isNewer('2.2.0', '2.2.0'), false, '同版本不提示')
  assert.equal(isNewer('2.2.0', '2.2.1'), false, '更高版本不提示降级')
})

test('local 版本与正式版的比较', () => {
  assert.equal(isNewer('2.2.0', '2.2.1-local.4'), false, 'local 高于同 base 正式版')
  assert.equal(isNewer('2.3.0', '2.2.1-local.4'), true, '更高 base 的正式版应提示')
})

test('到期判定：未满 4h 不放行，满 4h 放行', () => {
  const now = 1_800_000_000_000
  assert.equal(isDue(now - 60 * 60 * 1000, now), false, '1 小时不放行')
  assert.equal(isDue(now - (UPDATE_INTERVAL_MS - 1), now), false, '差 1ms 不放行')
  assert.equal(isDue(now - UPDATE_INTERVAL_MS, now), true, '满 4h 放行')
})

test('到期判定去重：检测后刷新时间戳，同一窗口内不再放行', () => {
  // 模拟 interval 与 visibilitychange 同时到期的场景：第一次放行后写入时间戳，第二次必须被拦下
  let lastAt = 0
  const now = 1_800_000_000_000
  assert.equal(isDue(lastAt, now), true, '首次到期应放行')
  lastAt = now // checkForUpdate 完成后 markUpdateCheckedAt 写入
  assert.equal(isDue(lastAt, now), false, '同一时刻第二次判定必须被拦下')
  assert.equal(isDue(lastAt, now + 1000), false, '1 秒后仍不放行')
  assert.equal(isDue(lastAt, now + UPDATE_INTERVAL_MS), true, '满 4h 后放行')
})

test('周期常量：4h', () => {
  assert.equal(UPDATE_INTERVAL_MS, 14_400_000, '周期必须是 4 小时')
})

test('非法时间戳按「从未检测」处理，不会卡死补检', () => {
  const now = 1_800_000_000_000
  assert.equal(isDue('not-a-number', now), true)
  assert.equal(isDue(NaN, now), true)
  assert.equal(isDue('', now), true)
})
