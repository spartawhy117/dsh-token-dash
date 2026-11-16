import test from 'node:test'
import assert from 'node:assert/strict'

/**
 * 更新检测调度纯逻辑：从 client.js 的调度规则抽出，避免为此在浏览器环境里跑集成测试。
 * 规则与 client.js · 插件 apply 内的 UPDATE_* 常量保持一致；改动其中一侧必须同步另一侧。
 */
const UPDATE_INTERVAL_MS = 4 * 60 * 60 * 1000
const UPDATE_MIN_STARTUP_AGE = 60 * 60 * 1000

/** 启动时是否该补检：距上次检测 >= 1h，或从未检测过。 */
const shouldCheckOnStartup = (lastAt, now) => now - (Number(lastAt) || 0) >= UPDATE_MIN_STARTUP_AGE

/** 恢复可见时是否该补检：距上次检测已超过一个完整周期。 */
const shouldCheckOnVisible = (lastAt, now) => now - (Number(lastAt) || 0) >= UPDATE_INTERVAL_MS

/** 周期检测是否到期。 */
const isIntervalDue = (lastAt, now) => now - (Number(lastAt) || 0) >= UPDATE_INTERVAL_MS

test('启动补检：从未检测过（lastAt=0）时必定检测', () => {
  assert.equal(shouldCheckOnStartup(0, 1_000_000_000_000), true)
  assert.equal(shouldCheckOnStartup(undefined, 1_000_000_000_000), true)
  assert.equal(shouldCheckOnStartup(null, 1_000_000_000_000), true)
})

test('启动补检：距上次不足 1h 跳过，避免频繁重启反复请求 registry', () => {
  const now = 1_800_000_000_000
  assert.equal(shouldCheckOnStartup(now - 10 * 60 * 1000, now), false, '10 分钟前检测过应跳过')
  assert.equal(shouldCheckOnStartup(now - 59 * 60 * 1000, now), false, '59 分钟前应跳过')
  assert.equal(shouldCheckOnStartup(now - 60 * 60 * 1000, now), true, '整 1 小时应检测')
  assert.equal(shouldCheckOnStartup(now - 3 * 60 * 60 * 1000, now), true, '3 小时前应检测')
})

test('恢复可见：未满 4h 不补检，满 4h 才补检', () => {
  const now = 1_800_000_000_000
  assert.equal(shouldCheckOnVisible(now - 60 * 60 * 1000, now), false, '1 小时不补检')
  assert.equal(shouldCheckOnVisible(now - (4 * 60 * 60 * 1000 - 1), now), false, '差 1ms 满 4h 不补检')
  assert.equal(shouldCheckOnVisible(now - 4 * 60 * 60 * 1000, now), true, '满 4h 补检')
})

test('周期检测：4h 为阈值', () => {
  const now = 1_800_000_000_000
  assert.equal(isIntervalDue(now - 2 * 60 * 60 * 1000, now), false)
  assert.equal(isIntervalDue(now - 4 * 60 * 60 * 1000, now), true)
  assert.equal(UPDATE_INTERVAL_MS, 14_400_000, '周期必须是 4 小时')
  assert.equal(UPDATE_MIN_STARTUP_AGE, 3_600_000, '启动去重阈值必须是 1 小时')
})

test('非法时间戳按「从未检测」处理，不会卡死检测', () => {
  const now = 1_800_000_000_000
  assert.equal(shouldCheckOnStartup('not-a-number', now), true)
  assert.equal(shouldCheckOnStartup(NaN, now), true)
  assert.equal(shouldCheckOnVisible('', now), true)
})
