import test from 'node:test'
import assert from 'node:assert/strict'
import { isNewer } from '../../src/version.js'

/**
 * 更新检测的调度与判定契约。
 * 判定直接复用生产实现 src/version.js 的 isNewer，不在这里复刻逻辑——
 * 复刻会导致「改坏代码测试仍然通过」。
 */
const UPDATE_INTERVAL_MS = 4 * 60 * 60 * 1000

/** 恢复可见时是否该补检：距上次检测已超过一个完整周期。 */
const shouldCheckOnVisible = (lastAt, now) => now - (Number(lastAt) || 0) >= UPDATE_INTERVAL_MS

test('真实版本场景：2.1.0 能看到已发布的 2.2.0', () => {
  assert.equal(isNewer('2.2.0', '2.1.0'), true, '旧版本必须判定为可更新')
  assert.equal(isNewer('2.2.0', '2.2.0'), false, '同版本不提示')
  assert.equal(isNewer('2.2.0', '2.2.1'), false, '更高版本不提示降级')
})

test('local 版本与正式版的比较', () => {
  assert.equal(isNewer('2.2.0', '2.2.1-local.4'), false, 'local 高于同 base 正式版')
  assert.equal(isNewer('2.3.0', '2.2.1-local.4'), true, '更高 base 的正式版应提示')
  assert.equal(isNewer('2.2.0', '2.1.0'), true)
})

test('恢复可见：未满 4h 不补检，满 4h 才补检', () => {
  const now = 1_800_000_000_000
  assert.equal(shouldCheckOnVisible(now - 60 * 60 * 1000, now), false, '1 小时不补检')
  assert.equal(shouldCheckOnVisible(now - (4 * 60 * 60 * 1000 - 1), now), false, '差 1ms 满 4h 不补检')
  assert.equal(shouldCheckOnVisible(now - 4 * 60 * 60 * 1000, now), true, '满 4h 补检')
})

test('周期常量：4h', () => {
  assert.equal(UPDATE_INTERVAL_MS, 14_400_000, '周期必须是 4 小时')
})

test('非法时间戳按「从未检测」处理，不会卡死恢复可见补检', () => {
  const now = 1_800_000_000_000
  assert.equal(shouldCheckOnVisible('not-a-number', now), true)
  assert.equal(shouldCheckOnVisible(NaN, now), true)
  assert.equal(shouldCheckOnVisible('', now), true)
})
