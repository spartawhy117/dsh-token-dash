import test from 'node:test'
import assert from 'node:assert/strict'
import { redact, hasSecret, createLogger, exportLog, pruneLogs, KEEP_DAYS, MAX_TOTAL } from '../../src/diagnostics.js'
import { mkdtempSync, rmSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

test('redacts keys, bearer and secret fields', () => {
  const text = redact('Authorization: Bearer sk-1234567890\n"apiKey":"abcdefgh"\nCookie=session=1')
  assert.ok(!text.includes('sk-1234567890'))
  assert.ok(!text.includes('abcdefgh'))
  assert.ok(text.includes('[REDACTED]'))
  assert.equal(hasSecret('sk-1234567890'), true)
  assert.equal(hasSecret('normal message'), false)
})

test('logger writes module JSONL and export contains header', () => {
  const dir = mkdtempSync(join(tmpdir(), 'token-dash-log-'))
  try {
    const logger = createLogger({ dir, level: 'debug', version: '0.2.0' })
    logger.info('adapter.glm', 'quota.ok', { windows: 2 })
    const exported = exportLog(dir, logger)
    assert.ok(exported.content.includes('"module":"adapter.glm"'))
  assert.ok(exported.content.includes('"prefix":"[TD:adapter.glm]"'))
    assert.ok(exported.content.includes('"type":"header"'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// —— 日志保留策略（订阅估算 Issue #3 BND-04）——

const day = (yyyyMMdd) => new Date(Number(yyyyMMdd.slice(0, 4)), Number(yyyyMMdd.slice(4, 6)) - 1, Number(yyyyMMdd.slice(6, 8))).getTime()
const makeDir = () => mkdtempSync(join(tmpdir(), 'td-prune-'))

test('pruneLogs 按天数删除，且永不删除活动文件', () => {
  const dir = makeDir()
  try {
    const now = day('20261120')
    for (const stamp of ['20261101', '20261110', '20261119', '20261120']) {
      writeFileSync(join(dir, `dsh-token-dash-${stamp}.log`), 'x')
    }
    writeFileSync(join(dir, 'unrelated.log'), 'keep me')
    const active = join(dir, 'dsh-token-dash-20261101.log')
    const result = pruneLogs({ dir, activeFile: active, now })
    // 11-01 已超 14 天但它是活动文件，仍保留；11-10 起都在窗口内
    assert.equal(result.removed, 0)
    assert.deepEqual(readdirSync(dir).sort(), [
      'dsh-token-dash-20261101.log', 'dsh-token-dash-20261110.log',
      'dsh-token-dash-20261119.log', 'dsh-token-dash-20261120.log', 'unrelated.log',
    ])
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('pruneLogs 删除超期文件并跳过非本插件文件', () => {
  const dir = makeDir()
  try {
    const now = day('20261120')
    for (const stamp of ['20261001', '20261110', '20261119']) {
      writeFileSync(join(dir, `dsh-token-dash-${stamp}.log`), 'x')
    }
    writeFileSync(join(dir, 'other-dsh.log'), 'x')
    const result = pruneLogs({ dir, activeFile: join(dir, 'dsh-token-dash-20261119.log'), now })
    assert.equal(result.removed, 1)
    assert.equal(readdirSync(dir).includes('dsh-token-dash-20261001.log'), false)
    assert.equal(readdirSync(dir).includes('other-dsh.log'), true)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('pruneLogs 按总量删最旧，覆盖轮转文件 .1/.2', () => {
  const dir = makeDir()
  try {
    const now = day('20261120')
    // 同日三份轮转文件，各 400B；总量上限设 500B → 只留最新（活动）文件
    const active = join(dir, 'dsh-token-dash-20261120.log')
    writeFileSync(active, 'a'.repeat(400))
    writeFileSync(join(dir, 'dsh-token-dash-20261120.1.log'), 'b'.repeat(400))
    writeFileSync(join(dir, 'dsh-token-dash-20261120.2.log'), 'c'.repeat(400))
    const result = pruneLogs({ dir, activeFile: active, totalBytes: 500, now })
    assert.equal(result.removed, 2)
    assert.deepEqual(readdirSync(dir), ['dsh-token-dash-20261120.log'])
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('保留策略默认值符合 BND-04', () => {
  assert.equal(KEEP_DAYS, 14)
  assert.equal(MAX_TOTAL, 20 * 1024 * 1024)
})
