/**
 * Diagnostic JSONL log: module prefixes, redaction, rotation and export.
 * Never writes credentials, prompts, bodies or full URLs.
 */
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const MAX_FILE = 2 * 1024 * 1024
export const MAX_EXPORT = 10 * 1024 * 1024
const KEEP_FILES = 2

const SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9_-]{8,}/g,
  /Bearer\s+[^\s"']+/gi,
  /("?(?:api[_-]?key|authorization|cookie|token|secret)"?\s*[:=]\s*")[^"]+"/gi,
]

export function redact(value) {
  let text = String(value ?? '')
  for (const pattern of SECRET_PATTERNS) text = text.replace(pattern, (match, prefix) => prefix === undefined ? '[REDACTED]' : `${prefix}[REDACTED]"`)
  return text
}

export function hasSecret(value) {
  return SECRET_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0
    return pattern.test(String(value ?? ''))
  })
}

function pad(value) {
  return String(value).padStart(2, '0')
}

export function logFileFor(ts, dir) {
  const d = new Date(ts)
  return join(dir, `dsh-token-dash-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.log`)
}

function rotate(file) {
  try {
    if (!existsSync(file) || statSync(file).size < MAX_FILE) return
    const base = file.replace(/\.log$/, '')
    for (let index = KEEP_FILES - 1; index >= 1; index -= 1) {
      const from = index === 1 ? file : `${base}.${index - 1}.log`
      const to = `${base}.${index}.log`
      if (existsSync(from)) writeFileSync(to, readFileSync(from))
    }
    writeFileSync(file, '')
  } catch {
    // logging must never break the plugin
  }
}

/** 保留策略：先按天删，再按总量删最旧；永不删除当前活动文件。 */
export const KEEP_DAYS = 14
export const MAX_TOTAL = 20 * 1024 * 1024

const LOG_NAME = /^dsh-token-dash-(\d{8})(?:\.\d+)?\.log$/

/**
 * 清理旧日志：天数与总量双上限，取更严的一侧；`activeFile` 无论多旧都不删。
 * 失败只返回已完成的量，绝不抛出——日志治理不能拖垮插件。
 */
export function pruneLogs({ dir, activeFile, days = KEEP_DAYS, totalBytes = MAX_TOTAL, now = Date.now() } = {}) {
  let removed = 0
  let bytes = 0
  if (dir === undefined) return { removed, bytes }
  const drop = (item) => {
    try {
      unlinkSync(item.full)
      removed += 1
      bytes += item.size
    } catch { /* 单个文件删不掉不影响其余 */ }
  }
  try {
    const entries = readdirSync(dir)
      .map((name) => {
        const matched = LOG_NAME.exec(name)
        if (matched === null) return null
        const full = join(dir, name)
        const stamp = matched[1]
        const day = new Date(Number(stamp.slice(0, 4)), Number(stamp.slice(4, 6)) - 1, Number(stamp.slice(6, 8))).getTime()
        let size = 0
        try { size = statSync(full).size } catch { return null }
        return { full, day, size }
      })
      .filter((item) => item !== null)
      .sort((a, b) => a.day - b.day)
    const cutoff = now - days * 86400_000
    const kept = []
    for (const item of entries) {
      if (item.full === activeFile) { kept.push(item); continue }
      if (item.day < cutoff) { drop(item); continue }
      kept.push(item)
    }
    let total = kept.reduce((sum, item) => sum + item.size, 0)
    for (const item of kept) {
      if (total <= totalBytes) break
      if (item.full === activeFile) continue
      drop(item)
      total -= item.size
    }
  } catch { /* 目录不可读时按无操作处理 */ }
  return { removed, bytes }
}
export function createLogger({ dir, level = 'info', version = '0.2.0', dshVersion = '0.2.1-rc.5' } = {}) {
  if (dir === undefined) return { log() {}, info() {}, warn() {}, error() {}, file: null }
  mkdirSync(dir, { recursive: true })
  const file = logFileFor(Date.now(), dir)
  const header = {
    type: 'header',
    plugin: 'dsh-token-dash',
    version,
    dshVersion,
    platform: process.platform,
    exportedAt: new Date().toISOString(),
  }
  let wroteHeader = false
  const write = (module, event, fields = {}, levelName = 'info') => {
    if (level !== 'debug' && levelName === 'debug') return
    try {
      rotate(file)
      if (!wroteHeader) {
        appendFileSync(file, `${JSON.stringify(header)}\n`, 'utf8')
        wroteHeader = true
      }
      const line = {
        ts: new Date().toISOString(),
        level: levelName,
        module,
        prefix: `[TD:${module}]`,
        event,
        ...Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, typeof value === 'string' ? redact(value) : value])),
      }
      appendFileSync(file, `${JSON.stringify(line)}\n`, 'utf8')
    } catch {
      // ignore
    }
  }
  return {
    file,
    log: write,
    info: (module, event, fields) => write(module, event, fields, 'info'),
    warn: (module, event, fields) => write(module, event, fields, 'warn'),
    error: (module, event, fields) => write(module, event, fields, 'error'),
    debug: (module, event, fields) => write(module, event, fields, 'debug'),
  }
}

export function exportLog(dir, logger) {
  const file = logger?.file ?? (dir === undefined ? null : logFileFor(Date.now(), dir))
  if (file === null || !existsSync(file)) {
    return { file, content: `${JSON.stringify({ type: 'header', plugin: 'dsh-token-dash', exportedAt: new Date().toISOString() })}\n`, bytes: 0 }
  }
  let content = readFileSync(file, 'utf8')
  if (Buffer.byteLength(content, 'utf8') > MAX_EXPORT) content = content.slice(-MAX_EXPORT)
  const redacted = redact(content)
  if (hasSecret(content)) return { file, content: redacted, bytes: Buffer.byteLength(redacted, 'utf8'), redacted: true }
  return { file, content, bytes: Buffer.byteLength(content, 'utf8'), redacted: false }
}

export function clearLog(dir, logger) {
  const file = logger?.file ?? (dir === undefined ? null : logFileFor(Date.now(), dir))
  if (file !== null && existsSync(file)) writeFileSync(file, '')
}
