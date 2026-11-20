import test from 'node:test'
import assert from 'node:assert/strict'
import { compareVersions, isNewer, sameBase } from '../../src/version.js'

test('版本比较：base 优先，local 是同 base 的预发布', () => {
  assert.equal(compareVersions('1.0.7', '1.0.7-local.1'), 1)
  assert.equal(compareVersions('1.0.7-local.1', '1.0.7'), -1)
  assert.equal(compareVersions('1.0.7-local.1', '1.0.7-local.1'), 0)
  assert.equal(compareVersions('1.0.7-local.2', '1.0.7-local.1'), 1)
  assert.equal(compareVersions('1.0.7-local.10', '1.0.7-local.2'), 1)
  assert.equal(compareVersions('1.0.8-local.1', '1.0.7'), 1)
  assert.equal(compareVersions('1.0.6', '1.0.7-local.1'), -1)
})

test('isNewer：local 可升级到同 base 正式版', () => {
  assert.equal(isNewer('1.0.7', '1.0.7-local.1'), true)
  assert.equal(isNewer('1.0.7', '1.0.7-local.9'), true)
  assert.equal(isNewer('1.0.7-local.2', '1.0.7-local.1'), true)
  assert.equal(isNewer('1.0.6', '1.0.7-local.1'), false)
  assert.equal(isNewer('1.0.7', '1.0.7'), false)
  assert.equal(isNewer('1.0.7', '1.0.8-local.1'), false)
})

// —— 本地构建的更新提示（REQ-09）——

test('sameBase：忽略 local 后缀只比 X.Y.Z', () => {
  assert.equal(sameBase('2.3.1', '2.3.1-local.6'), true)
  assert.equal(sameBase('2.3.1-local.6', '2.3.1'), true)
  assert.equal(sameBase('2.3.2', '2.3.1-local.6'), false)
  assert.equal(sameBase('2.4.0', '2.3.9'), false)
})

test('同 base 的本地包不应提示更新', () => {
  const shouldPrompt = (latest, current) => isNewer(latest, current) && !sameBase(latest, current)
  // npm 上是 2.3.1，本地跑 2.3.1-local.6：代码更新，装正式版反而会退回 → 不提示
  assert.equal(shouldPrompt('2.3.1', '2.3.1-local.6'), false)
  // 正式版之间的正常升级仍要提示
  assert.equal(shouldPrompt('2.3.1', '2.3.0'), true)
  // 新 base 发布时本地包也要提示
  assert.equal(shouldPrompt('2.3.2', '2.3.1-local.6'), true)
})
