import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const version = JSON.parse(readFileSync('package.json', 'utf8')).version
const isLocal = version.includes('-local.')

test('release notes 提取当前版本完整块', { skip: isLocal ? '本地构建不使用 Release notes' : false }, () => {
  const output = execFileSync(process.execPath, ['scripts/release-notes.mjs', version], { encoding: 'utf8' })
  // 2.0.2 起 CHANGELOG 改为「### 中文 / #### 修改」双语块，小节层级同步放宽
  assert.match(output, /^#{3,4} (新增|修改)$/m)
  assert.match(output, /^- /m)
  assert.ok(!output.includes('## ['), 'body 不应包含版本标题')
})

test('release notes 缺少版本块时失败', () => {
  assert.throws(() => execFileSync(process.execPath, ['scripts/release-notes.mjs', '0.0.0-missing'], { stdio: 'pipe' }))
})

test('local 版本不能用于 Release notes', () => {
  assert.throws(() => execFileSync(process.execPath, ['scripts/release-notes.mjs', '1.0.6-local.1'], { stdio: 'pipe' }))
})

test('CHANGELOG 保留正式历史且不残留已消费的本地版本', () => {
  const text = readFileSync('CHANGELOG.md', 'utf8')
  assert.match(text, /## \[1\.0\.0\]/)
  assert.match(text, /## \[1\.0\.2\]/)
  assert.match(text, /## \[1\.0\.5\]/)
  // 活跃的 -local.N 草稿允许存在；已消费的 1.0.3/1.0.4 不应留在正式历史
  assert.ok(!/^## \[1\.0\.[34]\]/m.test(text), '已并入正式版的本地构建版本不应残留')
})
