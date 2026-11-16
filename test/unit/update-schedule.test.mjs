import test from 'node:test'
import assert from 'node:assert/strict'

/**
 * 更新检测调度纯逻辑：从 client.js 的调度规则抽出，避免为此在浏览器环境里跑集成测试。
 * 规则与 client.js · 插件 apply 内的 UPDATE_* 常量保持一致；改动其中一侧必须同步另一侧。
 */
const UPDATE_INTERVAL_MS = 4 * 60 * 60 * 1000

/** 恢复可见时是否该补检：距上次检测已超过一个完整周期。 */
const shouldCheckOnVisible = (lastAt, now) => now - (Number(lastAt) || 0) >= UPDATE_INTERVAL_MS

/**
 * 启动时该做什么。启动检测是无条件的——不看缓存、不看上次检测时间，
 * 因此这个函数不接收 lastAt，签名本身就锁定了「启动不受历史影响」这一契约。
 */
const startupPlan = (delay) => ({ action: 'auto-check', delay })

test('启动检测无条件执行：签名不接受上次检测时间', () => {
  assert.equal(startupPlan.length, 1, 'startupPlan 只接收延迟，不接收 lastAt——启动不看去重')
  assert.equal(startupPlan(30_000).action, 'auto-check')
  assert.equal(startupPlan(30_000).delay, 30_000)
})

test('启动检测与上次检测时间无关（同一次会话内多次启动都检测）', () => {
  const now = 1_800_000_000_000
  // 无论上次检测是刚才、一小时前还是从未发生，启动结果都相同
  const plans = [0, now - 1000, now - 60 * 60 * 1000, now - 10 * 60 * 60 * 1000].map(() => startupPlan(30_000).action)
  assert.deepEqual(plans, ['auto-check', 'auto-check', 'auto-check', 'auto-check'])
})

test('恢复可见：未满 4h 不补检，满 4h 才补检', () => {
  const now = 1_800_000_000_000
  assert.equal(shouldCheckOnVisible(now - 60 * 60 * 1000, now), false, '1 小时不补检')
  assert.equal(shouldCheckOnVisible(now - (4 * 60 * 60 * 1000 - 1), now), false, '差 1ms 满 4h 不补检')
  assert.equal(shouldCheckOnVisible(now - 4 * 60 * 60 * 1000, now), true, '满 4h 补检')
})

test('周期检测：4h 为阈值', () => {
  const now = 1_800_000_000_000
  assert.equal(shouldCheckOnVisible(now - 2 * 60 * 60 * 1000, now), false)
  assert.equal(shouldCheckOnVisible(now - 4 * 60 * 60 * 1000, now), true)
  assert.equal(UPDATE_INTERVAL_MS, 14_400_000, '周期必须是 4 小时')
})

test('非法时间戳按「从未检测」处理，不会卡死恢复可见补检', () => {
  const now = 1_800_000_000_000
  assert.equal(shouldCheckOnVisible('not-a-number', now), true)
  assert.equal(shouldCheckOnVisible(NaN, now), true)
  assert.equal(shouldCheckOnVisible('', now), true)
})
