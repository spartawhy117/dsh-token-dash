/**
 * dsh-token-dash — client half. P1 pill, P2 current-model popover, P3 full-page board.
 * The visual contract lives in docs/ui-design.md v3.1.
 */
window.__ModuleLoader__.load({
  id: 'dsh-token-dash',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useLayoutEffect, useRef, useState } = React

    const API = '/token-dash/api'
    const PKG = 'dsh-token-dash'
    const PAGE_ID = 'token-dash'
    const REPO_URL = 'https://github.com/spartawhy117/dsh-token-dash'
    const SUB_CRITICAL = 90
    const API_CRITICAL = 100
    const STALE_MS = 5000
    
    const RANGES = [
      ['today', '当天'],
      ['7d', '近7天'],
      ['30d', '近30天'],
      ['all', '全部'],
    ]
    const REFRESH_OPTIONS = [[30000, '30秒'], [60000, '1分钟'], [300000, '5分钟']]
    const PRICE_LABELS = { zhipu: 'GLM', qwen: 'Qwen' }
    const SPIN_CSS = '@keyframes td-spin{to{transform:rotate(360deg)}}'
    const TD_CSS = [
      SPIN_CSS,
      '@media (max-width:520px){[data-td-label]{display:none}}',
      '[data-td-pill]:hover{background:color-mix(in srgb,currentColor 8%,transparent)}',
      '[data-td-btn]:hover{background:color-mix(in srgb,var(--td-accent) 24%,transparent);border-color:color-mix(in srgb,var(--td-accent) 48%,transparent)}',
      '[data-td-btn]:active{background:color-mix(in srgb,var(--td-accent) 28%,transparent)}',
      '@media (max-width:560px){[data-td-cards]{grid-template-columns:minmax(0,1fr)}}',
      '[data-td-scroll]{overflow-x:auto}',
      '[data-td-scroll] > *{min-width:560px}',
      '[data-testid=token-dash-board-scroll]::-webkit-scrollbar{width:8px}',
      '[data-testid=token-dash-board-scroll]::-webkit-scrollbar-thumb{background:color-mix(in srgb,currentColor 28%,transparent);border-radius:4px}',
      '[data-testid=token-dash-board-scroll]::-webkit-scrollbar-track{background:transparent}',
    ].join('')
    const EN = {
      '当天': 'Today', '近7天': 'Last 7 days', '近30天': 'Last 30 days', '全部': 'All',
      '30秒': '30s', '1分钟': '1m', '5分钟': '5m',
      '社区': 'Community', '内置兜底': 'Built-in fallback',
      '查询失败': 'Query failed', '套餐查询失败': 'Quota query failed',
      '周': 'Week', '月': 'Month', '重置': 'Reset',
      'API 用量': 'API usage', '订阅': 'Subscription', '账户套餐': 'Account plan',
      '预算': 'Budget', '未设置': 'Not set', '今日 {value}': 'Today {value}',
      '余额': 'Balance', '余额 {value}': 'Balance {value}', '预算已用 {value}': 'Budget used {value}',
      '预算未设置': 'Budget not set', '收起': 'Collapse', '展开': 'Expand',
      'Token 看板': 'Token dashboard', '点击查看 Token 看板': 'Click to view Token dashboard',
      'Token 看板：{text}': 'Token dashboard: {text}',
      '当前模型': 'Current model', '全量看板': 'Full dashboard', '查看仓库': 'View repository',
      '查看支持的 API Key 范围': 'View supported API Key scope',
      '目前支持 DeepSeek / Kimi / GLM / OpenRouter / Qwen API Key': 'Supports DeepSeek / Kimi / GLM / OpenRouter / Qwen API Keys',
      '刷新': 'Refresh', '关闭': 'Close',
      '未定价': 'Unpriced', '请求': 'Req', '命中': 'Hit',
      'API 用量（按供应商）': 'API usage (by provider)',
      '订阅套餐（按供应商）': 'Subscription plans (by provider)',
      '名称': 'Name', '已用': 'Used', '已用 / 预算': 'Used / budget', '计划余额': 'Planned left', '真实余额': 'Real balance',
      '剩余 {value}': '{value} left', '本月已花': 'Spent this month',
      '今日': 'Today', '总费用': 'Total cost', '重试': 'Retry',
      '模型用量明细': 'Model usage details', '模型': 'Model', '共 {n} 个模型': 'Total {n} models', '窗': 'windows', '数据来源': 'Data source', '数据来自本机会话记录，费用与 Tokens 均在本地估算': 'Estimated locally from local session records', '范围与明细': 'Range & details', '输入': 'In', '缓存': 'Cache', '输出': 'Out', '费用': 'Cost',
      '费用（API 计价估算）': 'Cost (API estimate)',
      '重新检测订阅配额': 'Recheck subscription quota',
      '未检测到已配置供应商': 'No configured provider detected',
      '供应商探测失败': 'Provider probe failed',
      '时间范围': 'Time range',
      '刷新失败，保留上次数据': 'Refresh failed; keeping previous data',
      '范围数据加载失败': 'Range data failed to load',
      '范围数据加载中…': 'Loading range data…', '范围内暂无消耗': 'No usage in this range',
      'Tokens 括号说明': 'Tokens bracket legend',
      'Tokens 括号顺序：输入 / 缓存（读+写）/ 输出': 'Tokens bracket order: input / cache (read+write) / output',
      '真实 Tokens': 'Real Tokens',
      'Token 数据不可用': 'Token data unavailable', 'Token 数据加载中…': 'Loading Token data…',
      '设置加载失败': 'Failed to load settings', '已保存': 'Saved',
      '保存失败：{reason}': 'Save failed: {reason}', '请输入 0 或正数': 'Enter 0 or a positive number',
      '月度预算': 'Monthly budget', '账户余额': 'Account balance',
      '刷新间隔': 'Refresh interval', '立即刷新': 'Refresh now', '日志': 'Logs',
      '查看日志': 'View logs', '打开日志文件夹': 'Open log folder', '导出日志': 'Export logs',
      '价格与版本': 'Prices and version', '价格表': 'Price table',
      '已重新检测': 'Rechecked', '已打开日志文件夹': 'Log folder opened',
      '无法打开，已复制路径': 'Could not open; path copied', '打开日志失败': 'Failed to open logs',
      '日志已导出': 'Logs exported', '日志导出失败': 'Log export failed',
      '数据': 'Data', '备份与恢复': 'Backup and restore',
      '{n} 分钟后': 'in {n} min', '{n} 小时后': 'in {n} h', '{n} 天后': 'in {n} d',
      '导出数据': 'Export data', '导入数据': 'Import data', '版本': 'Version',
      '导入中…': 'Importing…', '数据已导出': 'Data exported', '数据导出失败': 'Data export failed',
      '已导入 {month} 数据': 'Imported {month} data', '导入失败：{reason}': 'Import failed: {reason}',
      '检查失败': 'Check failed', '未发布': 'Not published', '已是最新': 'Up to date',
      '发现 {version}': 'Found {version}', '更新': 'Update', '取消': 'Cancel',
      '复制命令': 'Copy command', '命令已复制': 'Command copied', '复制失败': 'Copy failed',
      '设置加载中…': 'Loading settings…', '检查更新': 'Check for updates',
      '更新失败（{reason}）': 'Update failed ({reason})',
      '已更新到 {version}，重启 DSH 后生效': 'Updated to {version}; restart DSH to apply',
      '已更新，重启 DSH 后生效': 'Updated; restart DSH to apply',
      '发现 {version}，点击更新': 'Found {version}; click to update',
      '版本 {version}': 'Version {version}',
      '{name} · {action} Token 看板': '{name} · {action} Token dashboard',
      '{name} 月度预算': '{name} monthly budget',
      '{name}，API 用量，{budget}，今日 {today}{balance}': '{name}, API usage, {budget}, today {today}{balance}',
      '{name}，订阅，账户套餐，{value}': '{name}, subscription, account plan, {value}',
      '更新于 {time}': 'Updated {time}', '数据来自本机会话记录': 'From local session records',
      '未配置凭据': 'No credentials', '刷新中': 'Refreshing',
      '编辑预算': 'Edit budget', '退出编辑': 'Exit editing',
      '设置与数据管理': 'Settings and data',
      '语言跟随DSH设置；当前仅中文/English，其他语言回退英文': 'Language follows DSH settings; Chinese/English only; other languages fall back to English',
      '账户真实余额，不受预算影响': 'Account balance; not affected by budget',
      '本月累计消耗，等于已用/预算 的分子': 'Month-to-date spend; numerator of used/budget',
      '提示': 'Note',
      '按社区表 CNY': 'Community table (CNY)',
      '价格取社区价目表（人民币），与渠道账单可能有差异': 'Priced from the community table (CNY); may differ from your provider bill',
      '无匹配价目': 'No matching price', '候选模型不唯一': 'Ambiguous model match',
      '模型名无效': 'Invalid model name', '订阅不计价': 'Subscription, not billed',
    }
    const ZH = Object.fromEntries(Object.keys(EN).map((key) => [key, key]))
    /** 未定价原因 → 可读文案；未知 reason 回退「未定价」。 */
    const REASON_TEXT = {
      'no-model-price': '无匹配价目',
      ambiguous: '候选模型不唯一',
      'invalid-model': '模型名无效',
      'kind-skip': '订阅不计价',
    }
    const MESSAGES = { zh: ZH, en: EN }
    let localeService = null
    let ctxRef = null
    let layoutRef = null
    let activeTranslate = (key, params) => {
      const template = ZH[key] ?? key
      if (!params) return template
      return template.replace(/\{(\w+)\}/g, (match, name) => name in params ? String(params[name]) : match)
    }
    const tr = (key, params) => activeTranslate(key, params)

    const T = {
      text: 'var(--dsw-alias-label-primary, var(--dsh-text, #eee))',
      muted: 'var(--dsw-alias-label-secondary, rgba(235,235,235,.65))',
      weak: 'var(--dsw-alias-label-tertiary, rgba(235,235,235,.45))',
      accent: 'var(--dsw-alias-state-business-primary, #6ea8ff)',
      warn: 'var(--dsw-alias-state-warn-primary, #f0a020)',
      over: 'var(--dsw-alias-state-error-primary, #e05a5a)',
      ok: 'var(--td-state-ok, var(--dsw-alias-state-success-primary, #4ed17e))',
      border: 'var(--dsw-alias-border-l2, rgba(128,128,128,.25))',
      section: 'color-mix(in srgb, var(--dsw-alias-label-primary, #eee) 3%, transparent)',
      tile: 'color-mix(in srgb, var(--dsw-alias-label-primary, #eee) 4%, transparent)',
      input: 'color-mix(in srgb, var(--dsw-alias-label-primary, #eee) 5%, transparent)',
      segment: 'var(--dsw-alias-bg-module-platform, rgba(127,127,127,.10))',
      segmentOn: 'var(--dsw-alias-button-elevated-fill, #fff)',
      tooltip: 'var(--dsw-alias-tooltip-bg, #333)',
      tooltipText: 'var(--dsw-alias-toast-label, #fff)',
      focus: 'var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary, #6ea8ff))',
    }

    const fmtMoney = (value, currency = 'CNY') => `${currency === 'USD' ? '$' : '¥'}${(Number(value ?? 0) || 0).toFixed(2)}`
    const fmtTokens = (value) => {
      const n = Math.max(0, Number(value) || 0)
      const trim = (text) => text.replace(/\.0$/, '')
      if (n < 1000) return String(Math.round(n))
      if (n < 1e6) return `${trim((n / 1e3).toFixed(1))}k`
      if (n < 1e9) return `${trim((n / 1e6).toFixed(1))}M`
      return `${trim((n / 1e9).toFixed(1))}B`
    }
    const fmtRatio = (value) => `${trimZeros((Math.max(0, Number(value) || 0) * 100).toFixed(1))}%`
    const fmtPercent = (value) => `${trimZeros((Number(value) || 0).toFixed(1))}%`
    const trimZeros = (text) => text.replace(/\.0$/, '')
    const fmtTime = (ts) => {
      if (!Number.isFinite(ts) || ts <= 0) return null
      const date = new Date(ts)
      const now = new Date()
      const pad = (value) => String(value).padStart(2, '0')
      const hm = `${pad(date.getHours())}:${pad(date.getMinutes())}`
      return date.toDateString() === now.toDateString() ? hm : `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${hm}`
    }
    /** 重置时间拆两段：相对量 <1h 分钟（最小 1）、<24h 小时、其余天；绝对时间 `MM-DD HH:mm`。 */
    function resetParts(ts, now = Date.now()) {
      if (!Number.isFinite(ts) || ts <= 0) return { relative: null, absolute: null }
      const date = new Date(ts)
      const pad = (value) => String(value).padStart(2, '0')
      const absolute = `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
      const minutes = Math.max(1, Math.round((Number(ts) - now) / 60000))
      const relative = minutes < 60
        ? tr('{n} 分钟后', { n: minutes })
        : minutes < 1440
          ? tr('{n} 小时后', { n: Math.round(minutes / 60) })
          : tr('{n} 天后', { n: Math.round(minutes / 1440) })
      return { relative, absolute }
    }
    const fmtReset = (ts) => {
      const { relative, absolute } = resetParts(ts)
      return relative === null ? null : `${relative} · ${absolute}`
    }
    const fmtClock = (ts) => {
      if (!Number.isFinite(ts) || ts <= 0) return null
      const date = new Date(ts)
      const pad = (value) => String(value).padStart(2, '0')
      return `${pad(date.getHours())}:${pad(date.getMinutes())}`
    }
    const budgetColor = (state) => (state === 'over' ? T.over : state === 'warn' ? T.warn : T.accent)
    /** 环状态：null 空环；≥critical 红；≥warn 黄；其余正常绿。 */
    const stateOf = (percent, critical = 100) => (percent === null || percent === undefined ? 'empty' : percent >= critical ? 'critical' : percent >= 80 ? 'warn' : 'normal')
    const ringState = stateOf
    const stateColor = (state) => (state === 'critical' ? T.over : state === 'warn' ? T.warn : state === 'empty' ? T.weak : T.ok)
    /** 数字色：与环同色，只表达告警。 */
    const percentColor = (value, critical = 100) => stateColor(stateOf(value, critical))
    const percentText = (value) => (value === null || value === undefined ? '—' : fmtPercent(value))
    const sourceLabel = (source) => String(source ?? '').includes('community') ? tr('社区') : tr('内置兜底')
    const linkLabel = (link) => PRICE_LABELS[link.id] ?? link.label
    const formatCatalogTime = (value) => {
      if (value === null || value === undefined || String(value).trim() === '') return '—'
      const text = String(value).trim()
      const pad = (number) => String(number).padStart(2, '0')
      if (/^\d{10}$/.test(text) || /^\d{13}$/.test(text)) {
        const stamp = Number(text) * (text.length === 10 ? 1000 : 1)
        const date = new Date(stamp)
        if (!Number.isFinite(date.getTime())) return '—'
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
      const date = new Date(text)
      if (!Number.isFinite(date.getTime())) return text
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
    }

    async function getJson(path) {
      const res = await fetch(`${API}${path}`, { headers: { accept: 'application/json' } })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || body?.ok !== true) throw new Error(body?.reason ?? `http-${res.status}`)
      return body.data
    }

    async function putPrefs(prefs) {
      const res = await fetch(`${API}/prefs`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(prefs),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || body?.ok !== true) throw new Error(body?.reason ?? `http-${res.status}`)
      return body.data
    }

    async function postJson(path, payload) {
      const res = await fetch(`${API}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || body?.ok !== true) throw new Error(body?.reason ?? `http-${res.status}`)
      return body.data
    }

    const updateListeners = new Set()
    let updateSnapshot = { phase: 'idle', text: null, latest: null, command: null }
    let updateRequest = null
    let updateResetTimer = null
    let autoUpdateChecked = false

    function emitUpdate(patch) {
      updateSnapshot = { ...updateSnapshot, ...patch }
      for (const listener of updateListeners) listener()
    }

    function resetUpdateLater() {
      if (updateResetTimer !== null) clearTimeout(updateResetTimer)
      updateResetTimer = setTimeout(() => {
        updateResetTimer = null
        if (updateSnapshot.phase === 'done') emitUpdate({ phase: 'idle', text: null, latest: null, command: null })
      }, 1600)
    }

    function useUpdateSnapshot() {
      const [snapshot, setSnapshot] = useState(updateSnapshot)
      useEffect(() => {
        const listener = () => setSnapshot(updateSnapshot)
        updateListeners.add(listener)
        return () => updateListeners.delete(listener)
      }, [])
      return snapshot
    }

    async function checkForUpdate({ manual = true } = {}) {
      if (updateSnapshot.phase === 'checking' || updateSnapshot.phase === 'installing') return
      if (updateRequest !== null) return updateRequest
      if (updateResetTimer !== null) { clearTimeout(updateResetTimer); updateResetTimer = null }
      emitUpdate({ phase: 'checking', text: null, command: null })
      updateRequest = (async () => {
        try {
          const data = await getJson('/update')
          if (data.published === false) {
            if (manual) { emitUpdate({ phase: 'done', text: tr('未发布') }); resetUpdateLater() }
            else emitUpdate({ phase: 'idle', text: null })
          } else if (data.hasUpdate) {
            emitUpdate({ phase: manual ? 'confirm' : 'available', latest: data.latest, text: null })
          } else if (manual) {
            emitUpdate({ phase: 'done', text: tr('已是最新') })
            resetUpdateLater()
          } else {
            emitUpdate({ phase: 'idle', text: null })
          }
        } catch {
          if (manual) emitUpdate({ phase: 'error', text: tr('检查失败') })
          else emitUpdate({ phase: 'idle', text: null })
        } finally {
          updateRequest = null
        }
      })()
      return updateRequest
    }

    async function installUpdateRequest() {
      if (updateSnapshot.phase === 'installing') return
      emitUpdate({ phase: 'installing', text: null })
      try {
        const res = await fetch(`${API}/update/install`, { method: 'POST', headers: { accept: 'application/json' } })
        const body = await res.json().catch(() => ({}))
        const data = body?.data
        if (body?.ok === true) {
          emitUpdate({ phase: 'done', text: data?.to ? tr('已更新到 {version}，重启 DSH 后生效', { version: data.to }) : tr('已更新，重启 DSH 后生效'), latest: null })
          resetUpdateLater()
        } else {
          emitUpdate({ phase: 'error', text: tr('更新失败（{reason}）', { reason: data?.reason ?? 'unknown' }), command: data?.command ?? null })
        }
      } catch (error) {
        emitUpdate({ phase: 'error', text: tr('更新失败（{reason}）', { reason: error.message }), command: null })
      }
    }

    const styles = {
      pill: {
        display: 'inline-flex', alignItems: 'center', gap: 6, height: 24, padding: '0 8px',
        borderRadius: 999, cursor: 'pointer', maxWidth: '100%', fontVariantNumeric: 'tabular-nums',
        border: `1px solid ${T.border}`, color: T.text,
      },
      pillWrap: { position: 'relative', display: 'inline-flex', alignItems: 'center', order: 10, marginLeft: 8 },
      pillHover: { background: 'color-mix(in srgb, currentColor 8%, transparent)' },
      hint: {
        position: 'absolute', right: 12, bottom: 30, padding: '5px 8px', borderRadius: 6,
        background: T.tooltip, color: T.tooltipText, border: `1px solid ${T.border}`,
        fontSize: 11, whiteSpace: 'nowrap', boxShadow: '0 4px 16px rgba(0,0,0,.25)',
      },
      chevron: { marginLeft: 2, display: 'inline-flex', alignItems: 'center', color: T.muted },
      num: { fontWeight: 600, fontVariantNumeric: 'tabular-nums' },
      panel: {
        position: 'absolute', bottom: 'calc(100% + 8px)', left: 0,
        width: 'min(380px, calc(100vw - 16px))', maxWidth: 'calc(100vw - 16px)',
        boxSizing: 'border-box', maxHeight: '70vh', transition: 'width 120ms ease-out',
        overflow: 'auto', zIndex: 9999, padding: 16, borderRadius: 12,
        background: 'var(--dsw-alias-bg-layer-2, var(--dsh-bg-elevated, #1f1f1f))', color: T.text,
        border: `1px solid ${T.border}`, boxShadow: '0 12px 40px rgba(0,0,0,.35)', fontSize: 13, outline: 'none',
      },
      header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 28 },
      headerTabs: { flex: 1, minWidth: 0 },
      headerActions: { display: 'flex', alignItems: 'center', gap: 4, flex: '0 0 auto' },
      row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
      rowStart: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
      muted: { color: T.muted, fontSize: 11 },
      weak: { color: T.weak, fontSize: 10.5 },
      title: { fontSize: 13, fontWeight: 600 },
      button: {
        boxSizing: 'border-box', border: '1px solid color-mix(in srgb, var(--td-accent) 32%, transparent)',
        background: 'color-mix(in srgb, var(--td-accent) 16%, transparent)',
        color: 'var(--td-accent)', borderRadius: 6, height: 22, minHeight: 22, padding: '0 7px',
        fontSize: 11, lineHeight: '20px', cursor: 'pointer', font: 'inherit',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      },
      iconButton: {
        width: 22, height: 22, minHeight: 22, boxSizing: 'border-box', padding: 0,
        borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto',
      },
      inlineInfoButton: {
        width: 20, height: 20, minHeight: 20, boxSizing: 'border-box', padding: 0, border: 'none',
        background: 'transparent', color: T.weak, borderRadius: 4, display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
      },
      section: { background: T.section, borderRadius: 10, padding: 10, marginTop: 10, display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', alignContent: 'start', gap: 6, minWidth: 0 },
      sectionHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, minHeight: 20 },
      budgetRow: { display: 'grid', gap: 4, padding: '3px 0', fontSize: 10.5 },
      budgetHead: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 34px minmax(0,1fr) 72px', alignItems: 'center', columnGap: 6 },
      budgetName: { fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      quotaRow: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minHeight: 22, fontSize: 11 },
      quotaName: { fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 88 },
      rangeCard: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 },
      tile: { background: T.tile, borderRadius: 8, padding: '8px 9px', minWidth: 0 },
      tileLabel: { color: T.muted, fontSize: 11 },
      tileValue: { fontSize: 17, fontWeight: 600, marginTop: 2, fontVariantNumeric: 'tabular-nums' },
      tileDetail: { color: T.muted, fontSize: 10.5, marginTop: 1, fontVariantNumeric: 'tabular-nums' },
      group: { marginTop: 9, display: 'grid', gap: 3 },
      groupName: { fontSize: 13, fontWeight: 600 },
      modelRow: { display: 'flex', alignItems: 'baseline', gap: 8, minHeight: 18 },
      modelName: { minWidth: 0, flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      modelCost: { fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' },
      usageLine: { display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0, whiteSpace: 'nowrap' },
      usagePrimary: { flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      usageMeta: { flex: '0 0 auto', whiteSpace: 'nowrap' },
      usageLabel: { color: T.muted, fontSize: 9.5, marginRight: 3 },
      usageValue: { fontWeight: 600, fontVariantNumeric: 'tabular-nums' },
      errorStrip: { display: 'flex', alignItems: 'center', gap: 6, color: T.over, fontSize: 11, marginTop: 6 },
      empty: { color: T.muted, fontSize: 11, padding: '10px 0' },
      input: {
        width: 72, height: 22, boxSizing: 'border-box', textAlign: 'right',
        background: T.input, color: T.text, border: `1px solid ${T.border}`,
        borderRadius: 6, padding: '0 5px', font: 'inherit', fontVariantNumeric: 'tabular-nums',
      },
      card: { background: T.section, borderRadius: 10, padding: 10, marginTop: 10, display: 'grid', gap: 8 },
      link: { color: T.text, textDecoration: 'underline', cursor: 'pointer' },
      status: { minHeight: 15, fontSize: 10.5, color: T.muted, textAlign: 'right' },
      summaryRow: { display: 'grid', gridTemplateColumns: 'auto minmax(120px,1.2fr) minmax(80px,1fr) minmax(0,1fr)', alignItems: 'center', columnGap: 12, minHeight: 24, fontSize: 12 },
      summaryCell: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, whiteSpace: 'nowrap' },
      summaryLabel: { color: T.muted, fontSize: 11 },
      summaryValue: { fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums' },
      providerLine: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minWidth: 0, minHeight: 24 },
      providerChip: { color: T.muted, fontSize: 12, whiteSpace: 'nowrap' },
      windowRow: { display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr', columnGap: 8, alignItems: 'center', minHeight: 24, fontSize: 13 },
      windowKey: { display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' },
      table: { display: 'grid', minWidth: 0 },
      tableHead: { display: 'grid', columnGap: 8, alignItems: 'center', color: T.weak, fontSize: 12, paddingBottom: 8, borderBottom: `1px solid ${T.border}` },
      tableRow: { display: 'grid', columnGap: 8, alignItems: 'baseline', minHeight: 28, padding: '4px 0', fontSize: 13, borderBottom: '1px solid color-mix(in srgb, currentColor 6%, transparent)' },
      cellNum: { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
      cellName: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      footer: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 12, minHeight: 22 },
      boardScroll: {
        width: '100%', height: '100%', overflowY: 'auto', overflowX: 'hidden',
        boxSizing: 'border-box', overscrollBehavior: 'contain',
        scrollbarWidth: 'thin',
        scrollbarColor: 'color-mix(in srgb, currentColor 28%, transparent) transparent',
      },
      board: {
        padding: 24, display: 'grid', gap: 24,
        color: T.text, fontSize: 13, minWidth: 0, width: '100%', maxWidth: 1000, margin: '0 auto', boxSizing: 'border-box',
      },
      boardHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' },
      boardTitleRow: { display: 'flex', alignItems: 'baseline', gap: 16, flex: '1 1 auto', minWidth: 0 },
      boardTitle: { fontSize: 18, fontWeight: 600, whiteSpace: 'nowrap' },
      boardMeta: { color: T.muted, fontSize: 12, whiteSpace: 'nowrap' },
      boardAction: {
        boxSizing: 'border-box', width: 44, height: 26, padding: 0, borderRadius: 6,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: T.accent, fontSize: 13, textDecoration: 'none', cursor: 'pointer',
        border: `1px solid color-mix(in srgb, ${T.accent} 32%, transparent)`,
        background: `color-mix(in srgb, ${T.accent} 16%, transparent)`,
      },
      boardSection: { display: 'grid', gap: 12, minWidth: 0 },
      boardSectionHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 24 },
      sectionTitle: { fontSize: 13, fontWeight: 600 },
      settingsHead: { display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, minWidth: 0 },
      settingsHint: { color: T.muted, fontSize: 11, lineHeight: '16px', minWidth: 0, overflowWrap: 'anywhere' },
      cardBox: {
        border: `1px solid ${T.border}`, borderRadius: 8, padding: 12, background: T.section,
        display: 'grid', gap: 4, minWidth: 0,
      },
      cards: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 },
      capsule: {
        padding: '4px 16px', marginBottom: 32, borderRadius: 10, display: 'grid', gap: 0,
        background: 'var(--dsw-alias-bg-layer-2, var(--dsh-bg-elevated, #1f1f1f))',
        border: `1px solid ${T.border}`,
      },
      settingsRow: {
        display: 'grid', gridTemplateColumns: '40px minmax(0,1fr)', alignItems: 'center', gap: 12,
        padding: '8px 0', minHeight: 24, borderTop: '1px solid color-mix(in srgb, currentColor 6%, transparent)',
      },
      settingsRowRefresh: { gridTemplateColumns: 'minmax(0,1fr) auto' },
      settingsGroup: { display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 },
      settingsGroupLeft: { justifySelf: 'start' },
      settingsGroupRight: { justifySelf: 'end' },
      settingsLabel: { color: T.weak, fontSize: 11 },
      repoChip: {
        display: 'inline-flex', alignItems: 'center', gap: 4, height: 24, padding: '0 8px', borderRadius: 999,
        border: `1px solid ${T.border}`, color: T.text, textDecoration: 'none', fontSize: 12, whiteSpace: 'nowrap',
      },
      inlineWrap: { display: 'inline-flex', alignItems: 'center', gap: 4 },
      gaugeMeta: { color: T.muted, fontSize: 11, lineHeight: '15px', whiteSpace: 'nowrap' },
      apiCards: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
      apiCard: {
        flex: '1 1 220px', maxWidth: 260, minWidth: 220, boxSizing: 'border-box',
        border: `1px solid ${T.border}`, borderRadius: 8, background: T.section, padding: 16,
        display: 'grid', gap: 8, alignContent: 'start',
      },
      apiCardHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minWidth: 0 },
      apiCardName: { fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      apiChip: { color: T.muted, fontSize: 11, whiteSpace: 'nowrap' },
      apiGaugeWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 },
      budgetLabel: { color: T.muted, fontSize: 11 },
      budgetInputWrap: {
        display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${T.border}`,
        borderRadius: 6, padding: '4px 8px', background: T.input,
      },
      budgetInput: {
        width: 72, border: 0, background: 'transparent', color: T.text, font: 'inherit',
        fontSize: 13, textAlign: 'right', outline: 'none', fontVariantNumeric: 'tabular-nums',
      },
      kvRow: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, fontSize: 12, minWidth: 0 },
      kvLabel: { color: T.muted, whiteSpace: 'nowrap' },
      kvValue: { color: T.text, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
      summaryBand: {
        display: 'grid', gridTemplateColumns: '1fr 1fr', border: `1px solid ${T.border}`,
        borderRadius: 8, overflow: 'hidden',
      },
      summaryHalf: { padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8, minWidth: 0 },
      summaryK: { color: T.muted, fontSize: 12 },
      summaryV: { display: 'flex', alignItems: 'baseline', justifyContent: 'center', flexWrap: 'wrap', gap: 8, fontSize: 26, fontWeight: 600, lineHeight: '30px', fontVariantNumeric: 'tabular-nums' },
      summarySub: { color: T.weak, fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' },
      rangeBox: {
        border: `1px solid ${T.border}`, borderRadius: 10, background: T.section,
        padding: 16, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0,
      },
      rangeHead: { display: 'flex', alignItems: 'center', justifyContent: 'flex-start', flexWrap: 'wrap', gap: 16 },
      rangeMeta: { color: T.weak, fontSize: 11 },
      detailWrap: { overflowX: 'auto', borderTop: `1px solid ${T.border}`, paddingTop: 12 },
      quotaCards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 },
      quotaCard: {
        border: `1px solid ${T.border}`, borderRadius: 8, background: T.section, padding: 16,
        display: 'grid', gap: 12, alignContent: 'start', minWidth: 0,
      },
      quotaWindows: { display: 'grid', gap: 12, minWidth: 0 },
      cardCaption: { color: T.weak, fontSize: 11, textAlign: 'center', marginTop: 4, whiteSpace: 'nowrap' },
      rangeCapsule: { width: '100%', minWidth: 0 },
    }
    styles.button['--td-accent'] = T.accent
    styles.iconButton = { ...styles.button, ...styles.iconButton, minHeight: 22, boxSizing: 'border-box' }
    styles.primary = {
      ...styles.button, color: T.accent,
      borderColor: 'color-mix(in srgb, var(--td-accent) 32%, transparent)',
      background: 'color-mix(in srgb, var(--td-accent) 16%, transparent)',
    }
    styles.ghost = { ...styles.button, color: T.accent, borderColor: 'transparent', background: 'transparent' }
    styles.outline = { ...styles.button, color: T.text, borderColor: T.border, background: 'transparent' }

    function Icon({ name, size = 14, style }) {
      const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, style }
      if (name === 'info') return h('svg', props, h('circle', { cx: 12, cy: 12, r: 9 }), h('path', { d: 'M12 11v5' }), h('path', { d: 'M12 8h.01' }))
      if (name === 'close') return h('svg', props, h('path', { d: 'M6 6l12 12M18 6L6 18' }))
      if (name === 'check') return h('svg', props, h('path', { d: 'M20 6L9 17l-5-5' }))
      if (name === 'chevron') return h('svg', props, h('path', { d: 'M6 9l6 6 6-6' }))
      if (name === 'download') return h('svg', props, h('path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }), h('path', { d: 'M7 10l5 5 5-5' }), h('path', { d: 'M12 15V3' }))
      if (name === 'loader') return h('svg', { ...props, style: { ...style, animation: 'td-spin 1s linear infinite' } }, h('path', { d: 'M21 12a9 9 0 1 1-6.2-8.56' }))
      return h('svg', props, h('path', { d: 'M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' }), h('path', { d: 'M3 3v5h5' }), h('path', { d: 'M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16' }), h('path', { d: 'M16 16h5v5' }))
    }

    function IconButton({ label, children, onClick, disabled = false, testid, dot = false, dotColor = T.warn }) {
      return h('button', {
        type: 'button', 'aria-label': label, title: label, disabled, onClick,
        'data-testid': testid,
        style: { ...styles.iconButton, position: 'relative', opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' },
      }, children, dot ? h('span', {
        'aria-hidden': true,
        style: { position: 'absolute', top: 2, right: 2, width: 4, height: 4, borderRadius: 999, background: dotColor },
      }) : null)
    }

    function Tooltip({ open, anchorRef, text, onClose }) {
      const tipRef = useRef(null)
      const [pos, setPos] = useState(null)

      const updatePosition = useCallback(() => {
        const anchor = anchorRef.current
        const tip = tipRef.current
        if (anchor === null || tip === null) return
        const rect = anchor.getBoundingClientRect()
        const tipRect = tip.getBoundingClientRect()
        const width = Math.max(1, tipRect.width)
        const height = Math.max(1, tipRect.height)
        const gap = 6
        const above = rect.top - gap - height
        const below = rect.bottom + gap
        const top = above >= 8
          ? above
          : Math.min(below, window.innerHeight - height - 8)
        const left = Math.min(
          Math.max(8, rect.left + rect.width / 2 - width / 2),
          window.innerWidth - width - 8,
        )
        setPos({ top, left })
      }, [anchorRef])

      useLayoutEffect(() => {
        if (!open) {
          setPos(null)
          return undefined
        }
        updatePosition()
        const raf = requestAnimationFrame(updatePosition)
        const close = () => onClose?.()
        const onDown = (event) => {
          if (anchorRef.current?.contains(event.target)) return
          if (tipRef.current?.contains(event.target)) return
          close()
        }
        window.addEventListener('resize', close)
        window.addEventListener('scroll', close, true)
        document.addEventListener('mousedown', onDown)
        return () => {
          cancelAnimationFrame(raf)
          window.removeEventListener('resize', close)
          window.removeEventListener('scroll', close, true)
          document.removeEventListener('mousedown', onDown)
        }
      }, [open, updatePosition, onClose, anchorRef])

      if (!open) return null
      return h('span', {
        ref: tipRef, role: 'tooltip',
        style: {
          position: 'fixed', top: pos?.top ?? 0, left: pos?.left ?? 0,
          width: 'max-content', maxWidth: 'min(220px, calc(100vw - 16px))',
          opacity: pos === null ? 0 : 1, zIndex: 10050,
          padding: '6px 7px', borderRadius: 6, background: T.tooltip, color: T.tooltipText,
          fontSize: 10.5, lineHeight: 1.35, boxShadow: '0 6px 20px rgba(0,0,0,.3)', whiteSpace: 'normal',
          pointerEvents: 'none',
        },
      }, text)
    }

    function InfoTip({ label, text, children, style, variant = 'header' }) {
      const [open, setOpen] = useState(false)
      const [hover, setHover] = useState(false)
      const triggerRef = useRef(null)
      const close = useCallback(() => setOpen(false), [])

      const inline = variant === 'inline'
      const triggerStyle = inline
        ? { ...styles.inlineInfoButton, ...(hover ? { background: 'color-mix(in srgb, currentColor 8%, transparent)' } : {}) }
        : styles.iconButton
      return h('span', {
        style: { position: 'relative', display: 'inline-flex', verticalAlign: 'middle', ...style },
        onMouseEnter: () => { setHover(true); setOpen(true) },
        onMouseLeave: () => { setHover(false); close() },
      }, h('button', {
        ref: triggerRef, type: 'button', 'aria-label': label, 'aria-expanded': open,
        onClick: () => setOpen((value) => !value),
        onFocus: () => setOpen(true), onBlur: close,
        onKeyDown: (event) => { if (event.key === 'Escape') close() },
        style: triggerStyle,
      }, children ?? h(Icon, { name: 'info', size: inline ? 11 : 12 })),
      h(Tooltip, { open, anchorRef: triggerRef, text, onClose: close }))
    }

    function Toggle({ checked, onChange, label }) {
      return h('button', {
        type: 'button', role: 'switch', 'aria-checked': checked, 'aria-label': label,
        onClick: () => onChange(!checked),
        style: {
          width: 28, height: 16, borderRadius: 999, border: 'none', padding: 2,
          display: 'flex', alignItems: 'center', cursor: 'pointer',
          background: checked ? T.accent : 'color-mix(in srgb, currentColor 25%, transparent)',
        },
      }, h('span', { style: {
        width: 12, height: 12, borderRadius: 999, background: '#fff',
        transform: `translateX(${checked ? 12 : 0}px)`, transition: 'transform .15s',
      } }))
    }

    function Segmented({ value, options, onChange, label, kind = 'tablist', fit = false }) {
      const itemRole = kind === 'radiogroup' ? 'radio' : 'tab'
      return h('div', {
        role: kind, 'aria-label': label,
        style: {
          display: 'flex', width: fit ? 'max-content' : '100%', height: 28, padding: 2,
          boxSizing: 'border-box', gap: 2, borderRadius: 8, background: T.segment,
        },
      }, options.map((option, index) => {
        const selected = option.value === value
        return h('button', {
          key: option.value, type: 'button', role: itemRole,
          'aria-selected': itemRole === 'tab' ? selected : undefined,
          'aria-checked': itemRole === 'radio' ? selected : undefined,
          tabIndex: selected ? 0 : -1,
          onClick: () => onChange(option.value),
          onKeyDown: (event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
            event.preventDefault()
            const direction = event.key === 'ArrowRight' ? 1 : -1
            onChange(options[(index + direction + options.length) % options.length].value)
          },
          style: {
            flex: fit ? '0 0 auto' : 1, minWidth: 0, height: 24, padding: '0 4px', borderRadius: 6, border: 'none',
            fontSize: 11, fontWeight: 500, cursor: 'pointer', font: 'inherit', whiteSpace: 'nowrap',
            background: selected ? T.segmentOn : 'transparent',
            color: selected ? T.text : T.muted,
            boxShadow: selected ? 'var(--dsw-shadow-lv1, 0 1px 2px rgba(0,0,0,.08))' : 'none',
            transition: 'background .15s, color .15s',
          },
        }, option.label)
      }))
    }

    /** 统一轮询：页面不可见暂停，恢复可见立即刷新并重排计时器。 */
    function usePolling(task, { refreshMs, enabled = true }) {
      const taskRef = useRef(task)
      taskRef.current = task
      useEffect(() => {
        if (!enabled || !Number.isFinite(refreshMs) || refreshMs <= 0) return undefined
        let timer = null
        const stop = () => { if (timer !== null) { clearInterval(timer); timer = null } }
        const start = () => {
          stop()
          timer = setInterval(() => { if (!document.hidden) taskRef.current?.() }, refreshMs)
        }
        const onVisibility = () => {
          if (document.hidden) { stop(); return }
          taskRef.current?.()
          start()
        }
        start()
        document.addEventListener('visibilitychange', onVisibility)
        return () => { stop(); document.removeEventListener('visibilitychange', onVisibility) }
      }, [refreshMs, enabled])
    }

    /** 进度环：空环 / 正常 / 临界三态，弧色只取宿主 token。 */
    function ProgressRing({ percent, state = 'normal', size = 14, stroke = 2 }) {
      const r = (size - stroke) / 2
      const c = 2 * Math.PI * r
      const ratio = Math.max(0, Math.min(100, Number(percent) || 0))
      const arc = stateColor(state)
      return h('svg', {
        viewBox: `0 0 ${size} ${size}`, width: size, height: size, 'aria-hidden': true,
        style: { flex: '0 0 auto', display: 'inline-block', verticalAlign: '-2px' },
      },
        h('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', stroke: T.border, strokeWidth: stroke }),
        state === 'empty' ? null : h('circle', {
          cx: size / 2, cy: size / 2, r, fill: 'none', stroke: arc, strokeWidth: stroke, strokeLinecap: 'round',
          transform: `rotate(-90 ${size / 2} ${size / 2})`,
          strokeDasharray: `${(c * ratio) / 100} ${c}`,
        }))
    }

    /** 百分比文本：只负责格式化与状态色，不管排版。 */
    function PercentValue({ percent, state = stateOf(percent), size = 12, testid }) {
      return h('b', {
        'data-testid': testid,
        style: { fontSize: size, fontWeight: 600, color: stateColor(state), fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
      }, percentText(percent))
    }

    /** 内联组合：环 + 右侧数字，P1 14/2、P2 20/2.5。 */
    function InlineRing({ percent, state = stateOf(percent), size = 14, stroke = 2, text, testid, percentTestid }) {
      return h('span', {
        'data-testid': testid,
        style: { display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0 },
      },
        h(ProgressRing, { percent, state, size, stroke }),
        text !== undefined
          ? h('b', { 'data-testid': percentTestid, style: { fontWeight: 600, color: stateColor(state) } }, text)
          : h(PercentValue, { percent, state, size: 12, testid: percentTestid }))
    }

    /** P3 组合：环心标签 + 环下百分比 + 三行辅助。 */
    function QuotaGauge({ label, percent, state = stateOf(percent), remaining, relative, absolute, size = 40, stroke = 4, testid, labelTestid, percentTestid, remainingTestid, relativeTestid, absoluteTestid }) {
      const aria = [label, percentText(percent), remaining, relative].filter((part) => part !== undefined && part !== null && part !== '').join('，')
      return h('div', {
        'data-testid': testid, role: 'group', 'aria-label': aria,
        style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 },
      },
        h('div', { style: { position: 'relative', width: size, height: size, flex: '0 0 auto' } },
          h(ProgressRing, { percent, state, size, stroke }),
          label === undefined || label === null || label === ''
            ? null
            : h('span', {
              'data-testid': labelTestid,
              style: {
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 600, color: T.muted, letterSpacing: '.2px',
              },
            }, label)),
        h('span', {
          'data-testid': percentTestid,
          style: { fontSize: 16, fontWeight: 600, lineHeight: '20px', color: stateColor(state), fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
        }, percentText(percent)),
        remaining === undefined ? null : h('span', { 'data-testid': remainingTestid, style: styles.gaugeMeta }, remaining),
        relative === undefined ? null : h('span', { 'data-testid': relativeTestid, style: styles.gaugeMeta }, relative),
        absolute === undefined ? null : h('span', { 'data-testid': absoluteTestid, style: styles.gaugeMeta }, absolute))
    }

    const TOKEN_COLS = 'minmax(0,1fr) auto auto auto'

    /** P2 用量表：四列全自适应，Tokens 按「单位 / `[` 交界」两段对齐。 */
    const TABLE_BORDER = '1px solid color-mix(in srgb, currentColor 6%, transparent)'

    function TokenTable({ rows, maxRows = 5, empty = tr('范围内暂无消耗') }) {
      if (rows.length === 0) return h('div', { style: styles.empty }, empty)
      const headCell = (text, align = 'right') => h('span', {
        role: 'columnheader',
        style: { color: T.weak, fontSize: 12, textAlign: align, paddingBottom: 6, borderBottom: `1px solid ${T.border}` },
      }, text)
      const cell = { padding: '5px 0', borderBottom: TABLE_BORDER, fontSize: 12, minWidth: 0 }
      return h('div', {
        'data-testid': 'token-dash-usage-table',
        role: 'table',
        style: { ...styles.table, gridTemplateColumns: TOKEN_COLS, columnGap: 8, maxHeight: maxRows * 32, overflowY: 'auto' },
      },
        h('div', { style: { display: 'contents' } },
          headCell(tr('模型'), 'left'), headCell('Tokens'), headCell(tr('请求')), headCell(tr('命中'))),
        ...rows.map((row) => h('div', {
          key: `${row.providerId}:${row.modelId}`,
          role: 'row',
          'data-testid': `token-dash-usage-row-${row.providerId}-${row.modelId}`,
          style: { display: 'contents' },
        },
          h('span', {
            role: 'cell',
            style: { ...styles.cellName, ...cell, maxWidth: 150 },
            title: row.displayName ?? row.modelId,
          }, row.displayName ?? row.modelId),
          h('span', {
            role: 'cell',
            'data-testid': 'token-dash-usage-line',
            style: {
              ...cell, display: 'inline-flex', alignItems: 'baseline', gap: 4,
              fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', justifySelf: 'end', textAlign: 'right',
            },
          },
            h('span', { style: { minWidth: '5ch', textAlign: 'right', fontWeight: 600 } }, fmtTokens(row.tokens?.total ?? 0)),
            h('span', { style: { color: T.muted, fontSize: 11 } }, `[${fmtTokens(row.tokens?.input ?? 0)}/${fmtTokens(row.tokens?.cache ?? 0)}/${fmtTokens(row.tokens?.output ?? 0)}]`)),
          h('span', { role: 'cell', style: { ...styles.cellNum, ...cell, textAlign: 'right' } }, row.requests),
          h('span', { role: 'cell', style: { ...styles.cellNum, ...cell, textAlign: 'right' } },
            row.hitRate === null || row.hitRate === undefined ? '—' : fmtRatio(row.hitRate)))))
    }

    const DETAIL_COLS = 'minmax(0, 240px) repeat(7, minmax(56px, 1fr))'

    /** P3 明细表：八列，费用只对 API 计价行展示。 */
    function DetailTable({ rows, providerNames = {} }) {
      if (rows.length === 0) return h('div', { style: styles.empty }, tr('范围内暂无消耗'))
      const headCell = (text, align = 'right') => h('span', {
        role: 'columnheader',
        style: { color: T.weak, fontSize: 11, textAlign: align, paddingBottom: 8, borderBottom: `1px solid ${T.border}` },
      }, text)
      const cell = { padding: '4px 0', borderBottom: TABLE_BORDER, fontSize: 13, minWidth: 0 }
      return h('div', { role: 'table', 'aria-label': tr('模型用量明细') },
        h('div', { 'data-testid': 'token-dash-detail-table', style: { ...styles.table, gridTemplateColumns: DETAIL_COLS, columnGap: 8, minWidth: 720 } },
        h('div', { style: { display: 'contents' } },
          headCell(tr('模型'), 'left'),
          headCell('Tokens'), headCell(tr('输入')), headCell(tr('缓存')), headCell(tr('输出')),
          headCell(tr('请求')), headCell(tr('命中')), headCell(tr('费用'))),
        ...rows.map((row) => h('div', {
          key: `${row.providerId}:${row.modelId}`,
          role: 'row',
          'data-testid': `token-dash-detail-row-${row.providerId}-${row.modelId}`,
          style: { display: 'contents' },
        },
          h('span', {
            role: 'cell',
            style: { ...styles.cellName, ...cell },
            title: [row.displayName ?? row.modelId, providerNames[row.providerId]].filter(Boolean).join(' · '),
          }, [row.displayName ?? row.modelId, providerNames[row.providerId]].filter(Boolean).join(' · ')),
          h('span', { role: 'cell', style: { ...styles.cellNum, ...cell, textAlign: 'right', fontWeight: 600 } }, fmtTokens(row.tokens?.total ?? 0)),
          h('span', { role: 'cell', style: { ...styles.cellNum, ...cell, textAlign: 'right' } }, fmtTokens(row.tokens?.input ?? 0)),
          h('span', { role: 'cell', style: { ...styles.cellNum, ...cell, textAlign: 'right' } }, fmtTokens(row.tokens?.cache ?? 0)),
          h('span', { role: 'cell', style: { ...styles.cellNum, ...cell, textAlign: 'right' } }, fmtTokens(row.tokens?.output ?? 0)),
          h('span', { role: 'cell', style: { ...styles.cellNum, ...cell, textAlign: 'right' } }, row.requests),
          h('span', { role: 'cell', style: { ...styles.cellNum, ...cell, textAlign: 'right' } },
            row.hitRate === null || row.hitRate === undefined ? '—' : fmtRatio(row.hitRate)),
          h('span', {
            role: 'cell',
            'data-testid': 'token-dash-detail-cost',
            title: row.kind !== 'api'
              ? tr('订阅不计价')
              : row.priced === false
                ? tr(REASON_TEXT[row.reason] ?? '未定价')
                : undefined,
            style: { ...styles.cellNum, ...cell, textAlign: 'right' },
          },
            row.kind !== 'api' || row.priced === 'empty'
              ? '—'
              : row.priced === false
                ? tr('未定价')
                : `${row.approximate === true ? '≈' : ''}${fmtMoney(row.cost, row.currency)}`)))))
    }

    /** P3 两格卡：总费用（多币种同行）与真实 Tokens。 */
    function RangeCards({ usage }) {
      const pending = usage === null
      const costEntries = Object.entries(usage?.totals ?? {})
      const total = usage?.total ?? null
      const costNodes = costEntries.map(([currency, value]) => h('span', { key: currency }, fmtMoney(value.cost, currency)))
      return h('div', { 'data-testid': 'token-dash-range-cards', 'data-td-cards': true, style: styles.summaryBand },
        h('div', { 'data-testid': 'token-dash-card-cost', style: styles.summaryHalf },
          h('div', { style: styles.summaryK }, tr('总费用')),
          h('div', { 'data-testid': 'token-dash-cost-values', style: styles.summaryV },
            pending ? '—' : (costNodes.length === 0 ? '—' : costNodes))),
        h('div', { 'data-testid': 'token-dash-card-tokens', style: styles.summaryHalf },
          h('div', { style: styles.summaryK },
            `${tr('真实 Tokens')} `,
            h(InfoTip, {
              label: tr('Tokens 括号说明'),
              text: tr('Tokens 括号顺序：输入 / 缓存（读+写）/ 输出'),
              variant: 'inline',
            }, h(Icon, { name: 'info', size: 11 }))),
          h('div', { style: styles.summaryV }, pending ? '—' : fmtTokens(total?.tokens ?? 0)),
          h('div', { style: styles.summarySub },
            pending ? '—' : `${fmtTokens(total?.input ?? 0)} · ${fmtTokens(total?.cache ?? 0)} · ${fmtTokens(total?.output ?? 0)}`)))
    }

    function MiniBar({ ratio = 0, neutral = false, stretch = false }) {
      return h('span', {
        style: { display: 'block', width: stretch ? '100%' : 48, height: 4, borderRadius: 999, overflow: 'hidden', background: 'color-mix(in srgb, var(--dsw-alias-label-primary, #eee) 10%, transparent)' },
      }, h('span', { style: {
        display: 'block', height: '100%', width: `${Math.max(0, Math.min(100, (Number(ratio) || 0) * 100))}%`,
        borderRadius: 999, background: neutral ? 'color-mix(in srgb, currentColor 30%, transparent)' : T.accent,
      } }))
    }

    function balanceText(provider, show = true) {
      if (show === false) return null
      const balance = provider.balance
      if (balance === undefined || balance === null) return '—'
      if (balance.status === 'ok') return Number.isFinite(balance.amount) ? fmtMoney(balance.amount, provider.currency) : tr('查询失败')
      if (balance.status === 'unconfigured' || balance.status === 'unsupported') return '—'
      return tr('查询失败')
    }

    function windowLabel(key) { return { '5h': '5h', week: tr('周'), month: tr('月') }[key] ?? key }

    function subscriptionText(provider) {
      const windows = Array.isArray(provider.windows) ? provider.windows : []
      if (windows.length === 0) return tr('套餐查询失败')
      return windows.slice(0, 3).map((plan) => `${windowLabel(plan.key)} ${fmtPercent(plan.usedPercent)}`).join(' · ')
    }

    /** P1 订阅窗口：短标签 + 环 + 百分比，最多三窗，不显示重置。 */
    function subscriptionNodes(provider) {
      const windows = Array.isArray(provider.windows) ? provider.windows : []
      if (windows.length === 0) return [h('span', { key: 'fail', style: styles.muted }, tr('套餐查询失败'))]
      const nodes = []
      for (const [index, plan] of windows.slice(0, 3).entries()) {
        if (index > 0) nodes.push(h('span', { key: `sep-${plan.key}`, style: { color: T.weak } }, ' · '))
        const percent = Number(plan.usedPercent)
        nodes.push(h('span', { key: plan.key, style: styles.inlineWrap },
          h('span', { 'data-td-label': true, style: styles.summaryLabel }, windowLabel(plan.key)),
          h(InlineRing, {
            percent, state: stateOf(percent, SUB_CRITICAL), size: 14, stroke: 2,
            testid: `token-dash-pill-ring-${plan.key}`,
          })))
      }
      return nodes
    }

    function LocaleRoot(props) {
      const [, setTick] = useState(0)
      useEffect(() => {
        if (localeService?.subscribe === undefined) return undefined
        return localeService.subscribe(() => setTick((value) => value + 1))
      }, [])
      return h(Pill, props)
    }

    const summaryPath = (active) => (typeof active === 'string' && active !== ''
      ? `/summary?active=${encodeURIComponent(active)}`
      : '/summary')

    /** 三级取值：投影 next / lastUsed → 宿主默认模型 → 账本（null 交给 currentProviderId）。 */
    function rawActiveProvider(props) {
      try {
        const projection = typeof props?.useProjection === 'function' ? props.useProjection('modelSelection') : null
        const picked = projection?.next ?? projection?.lastUsed
        const raw = typeof picked === 'string' ? picked : (picked?.provider ?? picked?.providerId ?? null)
        if (typeof raw === 'string' && raw !== '') return raw
      } catch { /* fall through */ }
      try {
        const service = typeof ctxRef?.get === 'function' ? ctxRef.get('agentDefaultModel') : null
        const picked = service?.currentSelection?.()
        const raw = typeof picked === 'string' ? picked : (picked?.provider ?? picked?.providerId ?? null)
        if (typeof raw === 'string' && raw !== '') return raw
      } catch { /* fall through */ }
      return null
    }

    function Pill(props) {
      const updateState = useUpdateSnapshot()
      const hasUpdate = updateState.phase === 'available' || updateState.phase === 'confirm'
      const active = rawActiveProvider(props)
      const [summary, setSummary] = useState(null)
      const [open, setOpen] = useState(false)
      const [error, setError] = useState(false)
      const [refreshMs, setRefreshMs] = useState(60000)
      const [refreshing, setRefreshing] = useState(false)
      const [hover, setHover] = useState(false)
      const [hint, setHint] = useState(false)
      const [panelMaxHeight, setPanelMaxHeight] = useState('70vh')
      const [panelShift, setPanelShift] = useState(0)
      const pillRef = useRef(null)
      const panelRef = useRef(null)
      const lastLoadAt = useRef(0)

      useEffect(() => {
        try { if (window.localStorage.getItem('token-dash-hint-seen') !== '1') setHint(true) } catch { /* ignore */ }
      }, [])

      const load = useCallback(async () => {
        lastLoadAt.current = Date.now()
        setRefreshing(true)
        try {
          const data = await getJson(summaryPath(active))
          setSummary(data)
          setError(false)
          if (Number.isFinite(data?.refreshMs) && data.refreshMs !== refreshMs) setRefreshMs(data.refreshMs)
        } catch {
          setError(true)
        } finally {
          setRefreshing(false)
        }
      }, [refreshMs, active])

      useEffect(() => {
        getJson('/prefs').then((prefs) => setRefreshMs(prefs.refreshMs ?? 60000)).catch(() => {})
      }, [])

      useEffect(() => { load() }, [load])
      // 展开即刷新：距上次拉取超过 2s 才发，避免开合抖动与 refreshMs 变化引起的重跑；可见期轮询缩到 10s
      useEffect(() => {
        if (!open) return
        if (Date.now() - lastLoadAt.current < 2000) return
        void load()
      }, [open, load])
      usePolling(load, { refreshMs: open ? Math.min(10_000, refreshMs) : refreshMs })

      const refreshSubs = useCallback(async () => {
        try { await fetch(`${API}/providers/refresh`, { method: 'POST', headers: { accept: 'application/json' } }) } catch { /* fall through */ }
        await load()
      }, [load])

      const dismissHint = () => {
        setHint(false)
        try { window.localStorage.setItem('token-dash-hint-seen', '1') } catch { /* ignore */ }
      }
      const closePanel = useCallback(() => {
        setOpen(false)
        setTimeout(() => pillRef.current?.focus(), 0)
      }, [])
      const measurePanel = useCallback(() => {
        const rect = pillRef.current?.getBoundingClientRect()
        if (rect === undefined) return
        const measured = panelRef.current?.getBoundingClientRect().width
        const width = Math.round(Number.isFinite(measured) && measured > 0
          ? measured
          : Math.min(480, window.innerWidth - 16))
        setPanelShift(Math.min(0, window.innerWidth - 8 - rect.left - width))
        const available = Math.round(rect.top) - 16
        setPanelMaxHeight(`${Math.max(200, Math.min(window.innerHeight * 0.7, available))}px`)
      }, [])
      useEffect(() => {
        if (!open) return undefined
        const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => measurePanel()) : null
        if (pillRef.current !== null) observer?.observe(pillRef.current)
        if (panelRef.current !== null) observer?.observe(panelRef.current)
        window.addEventListener('resize', measurePanel)
        const raf = requestAnimationFrame(measurePanel)
        const timer = setTimeout(measurePanel, 120)
        return () => {
          observer?.disconnect()
          window.removeEventListener('resize', measurePanel)
          cancelAnimationFrame(raf)
          clearTimeout(timer)
        }
      }, [open, summary, measurePanel])
      const toggle = () => {
        dismissHint()
        if (!open) {
          const updatedAt = Number(summary?.updatedAt)
          if (!Number.isFinite(updatedAt) || Date.now() - updatedAt > STALE_MS) void load()
          requestAnimationFrame(measurePanel)
        }
        setOpen((value) => !value)
      }

      const providers = summary?.providers ?? []
      const current = providers.find((provider) => provider.id === summary?.currentProviderId) ?? providers[0]
      let prefix = '[API]'
      let bodyNodes = [h('span', { key: 'unknown' }, '--')]
      let ariaText = tr('API 用量')
      if (current?.kind === 'subscription') {
        prefix = `[${tr('订阅')}]`
        bodyNodes = subscriptionNodes(current)
        ariaText = tr('{name}，订阅，账户套餐，{value}', { name: current.name, value: subscriptionText(current) })
      } else if (current !== undefined) {
        const budget = current.budget
        const hasBudget = budget !== undefined && budget.state !== 'unset' && budget.amount > 0
        const percent = hasBudget ? Number(budget.percent) * 100 : null
        const balance = balanceText(current, summary?.showBalance)
        bodyNodes = [
          h('span', { key: 'budget', style: styles.inlineWrap },
            h('span', { 'data-td-label': true, style: styles.summaryLabel }, tr('预算')),
            h(InlineRing, {
              percent: hasBudget ? percent : null,
              state: hasBudget ? stateOf(percent, API_CRITICAL) : 'empty',
              size: 14, stroke: 2,
              text: hasBudget ? fmtRatio(budget.percent) : tr('未设置'),
              testid: 'token-dash-pill-ring-budget',
            })),
          h('span', { key: 'today', style: styles.inlineWrap },
            h('span', { 'data-td-label': true, style: styles.summaryLabel }, tr('今日')),
            h('span', { style: styles.num }, fmtMoney(current.usage?.todayCost, current.currency))),
          balance === null ? null : h('span', { key: 'balance', style: styles.inlineWrap },
            h('span', { 'data-td-label': true, style: styles.summaryLabel }, tr('余额')),
            h('span', { style: styles.num }, balance)),
        ].filter(Boolean)
        ariaText = tr('{name}，API 用量，{budget}，今日 {today}{balance}', { name: current.name, budget: hasBudget ? tr('预算已用 {value}', { value: fmtRatio(budget.percent) }) : tr('预算未设置'), today: fmtMoney(current.usage?.todayCost, current.currency), balance: balance === null ? '' : `，${tr('余额 {value}', { value: balance })}` })
      }
      const hoverTitle = tr('{name} · {action} Token 看板', { name: current?.name ?? '', action: open ? tr('收起') : tr('展开') })

      return h('div', { style: styles.pillWrap },
        h('style', null, TD_CSS),
        hint && !open ? h('span', { style: styles.hint, role: 'status' }, tr('点击查看 Token 看板')) : null,
        h('span', {
          ref: pillRef, 'data-testid': 'token-dash-pill', 'data-td-pill': true,
          style: { ...styles.pill, ...(hover || open ? styles.pillHover : {}) },
          onClick: toggle, onMouseEnter: () => setHover(true), onMouseLeave: () => setHover(false),
          onFocus: () => setHover(true), onBlur: () => setHover(false),
          onKeyDown: (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle() } },
          role: 'button', tabIndex: 0, 'aria-expanded': open, 'aria-haspopup': 'dialog',
          'aria-label': tr('Token 看板：{text}', { text: ariaText }), title: hoverTitle,
        }, h('span', { key: 'prefix', style: styles.num }, prefix), ...bodyNodes,
          h('span', { key: 'chevron', style: styles.chevron },
            h(Icon, { name: 'chevron', size: 12, style: { transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 120ms' } }))),
        open ? h(Panel, {
          summary, error, refreshing, maxHeight: panelMaxHeight, left: panelShift, active,
          panelRef, onRefresh: load, onRefreshSubs: refreshSubs, onClose: closePanel,
        }) : null)
    }

    function PanelHeader({ onRefresh, refreshing, onClose, stale = false }) {
      return h('div', { style: styles.header },
        h('b', { style: styles.title }, tr('当前模型')),
        h('div', { style: { ...styles.headerActions, marginInlineEnd: -5 } },
          h(InfoTip, {
            label: tr('查看支持的 API Key 范围'),
            text: tr('目前支持 DeepSeek / Kimi / GLM / OpenRouter / Qwen API Key'),
          }),
          h(IconButton, {
            label: tr('刷新'), testid: 'token-dash-refresh', disabled: refreshing, onClick: onRefresh, dot: stale,
          }, h(Icon, { name: refreshing ? 'loader' : 'refresh', size: 13 })),
          h(IconButton, { label: tr('关闭'), testid: 'token-dash-close', onClick: onClose }, h(Icon, { name: 'close', size: 13 }))))
    }

    function Panel({ summary, error, refreshing, maxHeight, left = 0, panelRef, onRefresh, onClose }) {
      const [range, setRange] = useState('today')
      const [usage, setUsage] = useState(null)
      const [usageLoading, setUsageLoading] = useState(false)
      const [usageError, setUsageError] = useState(false)
      const [panelError, setPanelError] = useState(false)

      const usageSeq = useRef(0)
      const loadUsage = useCallback(async () => {
        const seq = ++usageSeq.current
        setUsageLoading(true)
        setUsageError(false)
        try {
          const data = await getJson(`/usage?range=${encodeURIComponent(range)}`)
          if (seq !== usageSeq.current) return
          setUsage(data)
        } catch {
          if (seq !== usageSeq.current) return
          setUsageError(true)
        } finally {
          if (seq === usageSeq.current) setUsageLoading(false)
        }
      }, [range])

      useEffect(() => { loadUsage() }, [loadUsage])
      useEffect(() => { setPanelError(error === true) }, [error])

      useEffect(() => {
        const onDown = (event) => {
          const node = panelRef?.current
          if (node === null || node === undefined || node.contains(event.target)) return
          const wrap = node.parentElement
          if (wrap !== null && wrap.contains(event.target)) return
          onClose()
        }
        document.addEventListener('mousedown', onDown)
        return () => document.removeEventListener('mousedown', onDown)
      }, [onClose, panelRef])

      useEffect(() => {
        const onKey = (event) => { if (event.key === 'Escape') onClose() }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
      }, [onClose])

      const refreshAll = useCallback(async () => {
        await onRefresh?.()
        await loadUsage()
      }, [onRefresh, loadUsage])

      const providers = summary?.providers ?? []
      const current = providers.find((provider) => provider.id === summary?.currentProviderId) ?? providers[0]
      const models = Array.isArray(usage?.models) ? usage.models : []
      const scoped = models.filter((model) => model.providerId === current?.id)
      const rows = scoped.length > 0 ? scoped : models
      const updated = fmtClock(summary?.updatedAt)
      const stale = Number.isFinite(summary?.updatedAt)
        && Date.now() - summary.updatedAt > (Number(summary?.refreshMs) || 60000) * 2
      // 布局服务可用就显示入口；注册时序可能导致 hasMainPanel 暂时为 false，点击时再判。
      const canOpen = layoutRef !== null

      const strip = error || usageError
        ? h('div', { style: styles.errorStrip, role: 'alert' },
          h('span', null, error ? tr('刷新失败，保留上次数据') : tr('范围数据加载失败')),
          h('button', { type: 'button', style: styles.button, onClick: refreshAll }, tr('重试')))
        : null

      let body
      if (summary === null) {
        body = h('div', { style: styles.empty }, panelError ? tr('Token 数据不可用') : tr('Token 数据加载中…'))
      } else if (current === undefined) {
        const degraded = summary?.providersDegraded === true
        body = h('div', { style: styles.empty },
          degraded ? tr('供应商探测失败') : tr('未检测到已配置供应商'),
          degraded ? h('button', { type: 'button', style: styles.button, onClick: refreshAll }, tr('重试')) : null)
      } else {
        body = h(React.Fragment, null,
          current.kind === 'subscription'
            ? h(P2Windows, { provider: current })
            : h(P2Summary, { provider: current, summary }),
          h('div', { style: { marginTop: 12, ...styles.rangeCapsule } }, h(Segmented, {
            value: range, onChange: setRange, label: tr('时间范围'),
            options: RANGES.map(([value, label]) => ({ value, label: tr(label) })),
          })),
          strip,
          usage === null && usageLoading
            ? h('div', { style: styles.empty }, tr('范围数据加载中…'))
            : h(TokenTable, { rows }),
          h('div', { style: styles.footer },
            h('span', { 'data-testid': 'token-dash-updated', style: { color: T.weak, fontSize: 12 } },
              updated === null ? '' : tr('更新于 {time}', { time: updated })),
            canOpen
              ? h('button', {
                type: 'button', 'data-td-btn': true, 'data-testid': 'token-dash-open-board',
                style: styles.button, onClick: openBoardPage,
              }, tr('全量看板'))
              : null))
      }

      return h('div', {
        ref: panelRef, tabIndex: -1, role: 'dialog', 'aria-label': tr('Token 看板'),
        'data-testid': 'token-dash-panel',
        style: { ...styles.panel, maxHeight, left },
      },
        h(PanelHeader, { onRefresh: refreshAll, refreshing: refreshing || usageLoading, onClose, stale }),
        body)
    }

    /** 重置时间标准块：P2 带「重置」，P3 传 suffix='' 只用两段。 */
    function ResetLabel({ ts, suffix = tr('重置'), style }) {
      const text = fmtReset(ts)
      if (text === null) return null
      return h('span', {
        'data-testid': 'token-dash-reset',
        style: style ?? { marginLeft: 'auto', color: T.weak, fontSize: 12 },
      }, suffix === '' ? text : `${text} ${suffix}`)
    }

    /** P2 API 主区：环+% / 已用·预算 / 真实余额；第四格留空。 */
    function P2Summary({ provider, summary }) {
      const budget = provider.budget
      const hasBudget = budget !== undefined && budget.state !== 'unset' && budget.amount > 0
      const percent = hasBudget ? Number(budget.percent) * 100 : null
      const balance = balanceText(provider, summary?.showBalance)
      return h(React.Fragment, null,
        h('div', { style: styles.providerLine },
          h('span', { style: styles.title, title: provider.name }, provider.name),
          h('span', { style: styles.providerChip }, `[ ${tr('API 用量')} ]`)),
        h('div', { 'data-testid': 'token-dash-summary-row', style: styles.summaryRow },
          h('span', { style: styles.summaryCell },
            h(InlineRing, {
              percent: hasBudget ? percent : null,
              state: hasBudget ? stateOf(percent, API_CRITICAL) : 'empty',
              size: 20, stroke: 2.5,
              testid: 'token-dash-summary-ring',
            })),
          h('span', { 'data-testid': 'token-dash-summary-used', style: styles.summaryCell },
            h('span', { style: styles.summaryLabel }, tr('已用 / 预算')),
            h('span', { style: styles.summaryValue },
              hasBudget ? `${fmtMoney(budget.used, provider.currency)} / ${fmtMoney(budget.amount, provider.currency)}` : '—')),
          h('span', {
            'data-testid': 'token-dash-summary-balance',
            style: {
              ...styles.summaryCell,
              gridColumn: '3 / 5',
              justifySelf: 'end',
              alignItems: 'flex-end',
              textAlign: 'right',
            },
            title: tr('账户真实余额，不受预算影响'),
          },
            h('span', { style: styles.summaryLabel }, tr('真实余额')),
            h('span', { style: styles.summaryValue }, balance ?? '—'))))
    }

    /** P2 订阅窗口行：两段数字 + 倒计时 + 绝对时间（无「重置」后缀）。 */
    function WindowRow({ providerId, plan, align = 'left' }) {
      const percent = plan === undefined || plan === null ? null : Number(plan.usedPercent)
      const hasValue = Number.isFinite(percent)
      const parts = hasValue ? resetParts(plan.resetAt) : { relative: null, absolute: null }
      const left = hasValue ? Math.max(0, Math.round(100 - percent)) : null
      const testKey = `${providerId}-${plan?.key ?? 'none'}`
      return h('div', {
        'data-testid': `token-dash-sub-window-${testKey}`,
        title: parts.absolute ?? undefined,
        style: {
          display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0,
          alignItems: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
          textAlign: align,
          justifySelf: align === 'right' ? 'end' : align === 'center' ? 'center' : 'start',
        },
      },
        h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' } },
          h('span', { style: styles.summaryLabel }, plan?.key ? windowLabel(plan.key) : '—'),
          h(InlineRing, {
            percent, state: hasValue ? stateOf(percent, SUB_CRITICAL) : 'empty', size: 20, stroke: 2.5,
          })),
        h('span', {
          'data-testid': `token-dash-sub-left-${testKey}`,
          style: { fontSize: 11, color: T.muted, whiteSpace: 'nowrap' },
        },
          left === null ? '—' : tr('剩余 {value}', { value: `${left}%` }),
          ' · ',
          h('span', { 'data-testid': `token-dash-sub-rel-${testKey}` }, parts.relative ?? '—')))
    }

    function P2Windows({ provider }) {
      const windows = Array.isArray(provider.windows) ? provider.windows : []
      return h(React.Fragment, null,
        h('div', { style: styles.providerLine },
          h('span', { style: styles.title, title: provider.name }, provider.name),
          h('span', { style: styles.providerChip }, `[ ${tr('订阅')} ]`)),
        windows.length === 0
          ? h('div', { style: styles.empty }, tr('套餐查询失败'))
          : h('div', {
            style: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 },
          }, windows.map((plan, index) => h(WindowRow, {
            key: plan.key,
            providerId: provider.id,
            plan,
            align: ['left', 'center', 'right'][index] ?? 'left',
          }))))
    }

    /** P3 底部胶囊：三行设置；prefs 由 BoardPage 持有。 */
    function SettingsRows({ summary, prefs, onSave, onRefresh, onRefreshSubs }) {
      const [status, setStatus] = useState(null)
      const [subRefreshing, setSubRefreshing] = useState(false)
      const update = useUpdateSnapshot()
      const [logMeta, setLogMeta] = useState(null)
      const [importing, setImporting] = useState(false)
      const fileRef = useRef(null)

      function flash(text, error = false) {
        setStatus({ text, error })
        if (error !== true) setTimeout(() => setStatus((current) => (current?.text === text ? null : current)), 1600)
      }

      async function savePrefs(patch) {
        const result = await onSave?.(patch)
        if (result?.ok !== true) {
          setStatus({ text: tr('保存失败：{reason}', { reason: result?.reason ?? 'unknown' }), error: true })
          return null
        }
        flash(tr('已保存'))
        return result.prefs
      }

      const retryPrefs = () => { void onRefresh?.() }

      async function refreshSubscriptions() {
        setSubRefreshing(true)
        try {
          await onRefreshSubs?.()
          flash(tr('已重新检测'))
        } finally {
          setSubRefreshing(false)
        }
      }

      async function openLogs() {
        try {
          const meta = logMeta ?? await getJson('/logs/meta')
          setLogMeta(meta)
          const app = /Mac|iPhone|iPad/.test(navigator.platform) ? 'finder' : /Linux/.test(navigator.platform) ? 'filemanager' : 'explorer'
          const response = await fetch('/open-in-app/open', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ app, path: meta.dir }),
          })
          if (!response.ok) throw new Error('open-failed')
          flash(tr('已打开日志文件夹'))
        } catch {
          try {
            const meta = logMeta ?? await getJson('/logs/meta')
            await navigator.clipboard.writeText(meta.dir)
            flash(tr('无法打开，已复制路径'))
          } catch {
            setStatus({ text: tr('打开日志失败'), error: true })
          }
        }
      }

      async function exportLogs() {
        try {
          const data = await getJson('/logs/export')
          const blob = new Blob([data.content], { type: 'text/plain;charset=utf-8' })
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = 'dsh-token-dash.log'
          link.click()
          URL.revokeObjectURL(url)
          flash(tr('日志已导出'))
        } catch {
          setStatus({ text: tr('日志导出失败'), error: true })
        }
      }

      async function exportData() {
        try {
          const data = await getJson('/export')
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = `dsh-token-dash-${data.month}.json`
          link.click()
          URL.revokeObjectURL(url)
          flash(tr('数据已导出'))
        } catch {
          setStatus({ text: tr('数据导出失败'), error: true })
        }
      }

      async function importData(file) {
        if (file === null || file === undefined) return
        setImporting(true)
        try {
          const bundle = JSON.parse(await file.text())
          const result = await postJson('/import', bundle)
          await onRefresh?.()
          flash(tr('已导入 {month} 数据', { month: result.month }))
        } catch (error) {
          setStatus({ text: tr('导入失败：{reason}', { reason: error.message }), error: true })
        } finally {
          setImporting(false)
          if (fileRef.current !== null) fileRef.current.value = ''
        }
      }

      const checkUpdate = () => { void checkForUpdate({ manual: true }) }
      const installUpdate = () => { void installUpdateRequest() }

      async function copyCommand() {
        try { await navigator.clipboard.writeText(update.command ?? ''); flash(tr('命令已复制')) } catch { setStatus({ text: tr('复制失败'), error: true }) }
      }

      if (prefs === null) {
        return h('div', { 'data-testid': 'token-dash-settings', style: { display: 'grid', gap: 10 } },
          h('div', { style: styles.empty }, status?.text ?? tr('设置加载中…')),
          status?.error === true ? h('button', { type: 'button', style: styles.button, onClick: retryPrefs }, tr('重试')) : null)
      }

      const version = summary?.version ?? ''
      const catalog = summary?.catalog

      let updateControl
      const updateBusy = update.phase === 'checking' || update.phase === 'installing'
      const updateAvailable = update.phase === 'available'
      const updateError = update.phase === 'error'
      if (update.phase === 'confirm') {
        updateControl = h('span', { style: styles.rowStart },
          h('span', { style: styles.muted }, tr('发现 {version}', { version: update.latest })),
          h('button', { type: 'button', style: styles.button, onClick: installUpdate }, tr('更新')),
          h('button', { type: 'button', style: styles.button, onClick: () => emitUpdate({ phase: 'idle', latest: null }) }, tr('取消')))
      } else {
        updateControl = h('span', { style: styles.rowStart },
          updateError && update.command
            ? h('button', { type: 'button', style: styles.button, onClick: copyCommand }, tr('复制命令'))
            : null,
          h(IconButton, {
            label: updateAvailable ? tr('发现 {version}，点击更新', { version: update.latest }) : tr('检查更新'),
            testid: 'token-dash-update', disabled: updateBusy,
            dot: updateAvailable || updateError,
            dotColor: updateError ? T.over : T.accent,
            onClick: () => {
              if (updateAvailable) emitUpdate({ phase: 'confirm', latest: update.latest })
              else checkUpdate()
            },
          }, h(Icon, {
            name: updateBusy ? 'loader' : update.phase === 'done' ? 'check' : 'download', size: 13,
          })))
      }

      const statusText = update.text ?? status?.text ?? ''
      return h('div', { 'data-testid': 'token-dash-settings', style: { display: 'grid', minWidth: 0 } },
        h('div', {
          'data-testid': 'token-dash-settings-row-1',
          style: { ...styles.settingsRow, ...styles.settingsRowRefresh },
        },
          h('div', {
            'data-testid': 'token-dash-settings-refresh-left',
            style: { ...styles.settingsGroup, ...styles.settingsGroupLeft },
          },
            h('span', { style: styles.settingsLabel }, tr('刷新间隔')),
            h('div', {
              'data-testid': 'token-dash-refresh-segment',
              style: { width: 168, flex: '0 1 168px', minWidth: 0 },
            }, h(Segmented, {
              value: prefs.refreshMs, onChange: (ms) => savePrefs({ refreshMs: ms }), label: tr('刷新间隔'),
              kind: 'radiogroup', options: REFRESH_OPTIONS.map(([value, label]) => ({ value, label: tr(label) })),
            }))),
          h('div', {
            'data-testid': 'token-dash-settings-refresh-right',
            style: { ...styles.settingsGroup, ...styles.settingsGroupRight },
          },
            h('span', { style: styles.settingsLabel }, tr('账户余额')),
            h(Toggle, { checked: prefs.showBalance, label: tr('账户余额'), onChange: (next) => savePrefs({ showBalance: next }) }))),
        h('div', { 'data-testid': 'token-dash-settings-row-2', style: styles.settingsRow },
          h('span', { style: styles.settingsLabel }, tr('日志')),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 } },
            h('button', { type: 'button', 'data-testid': 'token-dash-log-open', style: styles.ghost, onClick: openLogs }, tr('打开日志文件夹')),
            h('button', { type: 'button', 'data-testid': 'token-dash-log-export', style: styles.ghost, onClick: exportLogs }, tr('导出日志')),
            h('button', { type: 'button', 'data-testid': 'token-dash-data-export', style: styles.ghost, onClick: () => { void exportData() } }, tr('导出数据')),
            h('button', { type: 'button', 'data-testid': 'token-dash-data-import', disabled: importing, style: styles.ghost, onClick: () => fileRef.current?.click() }, importing ? tr('导入中…') : tr('导入数据')),
            h('input', { ref: fileRef, type: 'file', accept: 'application/json', style: { display: 'none' }, onChange: (event) => { void importData(event.target.files?.[0]) } }))),
        h('div', { 'data-testid': 'token-dash-settings-row-3', style: styles.settingsRow },
          h('span', { style: styles.settingsLabel }, tr('版本')),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 } },
            h('span', { style: { ...styles.muted, fontSize: 11 } },
              `v${version} · ${tr('价格表')} ${formatCatalogTime(catalog?.updatedAt)}`,
              catalog?.url
                ? h('a', { href: catalog.url, target: '_blank', rel: 'noopener', style: { ...styles.link, color: T.muted, marginLeft: 4 } }, tr('社区'))
                : h('span', { style: { marginLeft: 4 } }, sourceLabel(catalog?.source))),
            h('span', { style: { flex: 1 } }),
            h('span', {
              'data-testid': 'token-dash-settings-status', role: 'status', 'aria-live': 'polite',
              style: { ...styles.status, color: status?.error ? T.over : T.muted }, title: statusText,
            }, statusText),
            updateControl)))
    }

    /** P3 API 用量卡：每 provider 一张，竖排 Gauge + 常显预算输入 + 三行字段。 */
    function BudgetTable({ providers, prefs, onSave }) {
      const [errors, setErrors] = useState({})
      const [saving, setSaving] = useState(null)

      const commit = async (provider, raw, input) => {
        const text = String(raw ?? '').trim()
        if (text !== '' && (!/^\d+(?:\.\d{1,2})?$/.test(text) || Number(text) > 9999999.99)) {
          setErrors((prev) => ({ ...prev, [provider.id]: tr('请输入 0 或正数') }))
          return
        }
        const amount = text === '' ? 0 : Number(text)
        if (input !== undefined && input !== null) input.value = amount > 0 ? amount.toFixed(2) : ''
        const budgets = { ...(prefs?.budgets ?? {}) }
        budgets[provider.id] = { amount, currency: provider.currency }
        setSaving(provider.id)
        const result = await onSave?.({ budgets })
        setSaving(null)
        if (result?.ok !== true) {
          setErrors((prev) => ({ ...prev, [provider.id]: tr('保存失败：{reason}', { reason: result?.reason ?? 'unknown' }) }))
          return
        }
        setErrors((prev) => {
          const next = { ...prev }
          delete next[provider.id]
          return next
        })
        if (input !== undefined && input !== null) input.value = amount > 0 ? amount.toFixed(2) : ''
      }

      return h('div', { 'data-testid': 'token-dash-budget-table', style: styles.apiCards },
        ...providers.map((provider) => {
          const budget = provider.budget
          const hasBudget = budget !== undefined && budget.state !== 'unset' && budget.amount > 0
          const percent = hasBudget ? Number(budget.percent) * 100 : null
          const used = Number(budget?.used ?? 0)
          const plan = hasBudget ? Number(budget.amount) - used : null
          const balance = balanceText(provider, true)
          const entry = prefs?.budgets?.[provider.id]
          const initial = entry === undefined ? '' : (entry.amount > 0 ? entry.amount.toFixed(2) : '')
          const error = errors[provider.id]
          return h('div', {
            key: provider.id,
            'data-testid': `token-dash-budget-row-${provider.id}`,
            style: styles.apiCard,
          },
            h('div', { style: styles.apiCardHead },
              h('span', { style: styles.apiCardName, title: provider.name }, provider.name),
              h('span', { style: styles.apiChip }, `[ ${tr('API 用量')} ]`)),
            h('div', { style: styles.apiGaugeWrap },
              h(QuotaGauge, {
                label: tr('已用'), percent,
                state: hasBudget ? stateOf(percent, API_CRITICAL) : 'empty',
                size: 40, stroke: 4,
                labelTestid: `token-dash-budget-gauge-label-${provider.id}`,
                percentTestid: `token-dash-budget-used-${provider.id}`,
              }),
              h('span', { style: styles.budgetLabel }, tr('月度预算')),
              h('div', { style: styles.budgetInputWrap },
                h('span', { style: { fontSize: 12, color: T.weak } }, provider.currency === 'USD' ? '$' : '¥'),
                h('input', {
                  type: 'text', inputMode: 'decimal', disabled: saving === provider.id,
                  'data-testid': `token-dash-budget-input-${provider.id}`,
                  'aria-label': tr('{name} 月度预算', { name: provider.name }),
                  'aria-invalid': error !== undefined,
                  defaultValue: initial,
                  placeholder: tr('未设置'),
                  onBlur: (event) => { void commit(provider, event.currentTarget.value, event.currentTarget) },
                  onKeyDown: (event) => {
                    if (event.key === 'Escape') {
                      event.preventDefault()
                      event.currentTarget.value = initial
                      event.currentTarget.blur()
                      return
                    }
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      void commit(provider, event.currentTarget.value, event.currentTarget)
                      event.currentTarget.blur()
                    }
                  },
                  style: { ...styles.budgetInput, borderBottom: `1px solid ${error === undefined ? 'transparent' : T.over}` },
                })),
              error === undefined ? null : h('span', { style: { color: T.over, fontSize: 11 }, role: 'alert' }, error)),
            h('div', { style: styles.kvRow },
              h('span', { style: styles.kvLabel }, tr('计划余额')),
              h('span', {
                'data-testid': `token-dash-budget-plan-${provider.id}`,
                style: { ...styles.kvValue, color: plan !== null && plan < 0 ? T.over : T.text },
              }, plan === null ? '—' : `${plan < 0 ? '-' : ''}${fmtMoney(Math.abs(plan), provider.currency)}`)),
            h('div', { style: styles.kvRow },
              h('span', { style: styles.kvLabel }, tr('真实余额')),
              h('span', { 'data-testid': `token-dash-budget-balance-${provider.id}`, style: styles.kvValue }, balance ?? '—')),
            h('div', { style: styles.kvRow },
              h('span', { style: styles.kvLabel }, tr('本月已花')),
              h('span', {
                'data-testid': `token-dash-budget-month-${provider.id}`,
                style: { ...styles.kvValue, display: 'inline-flex', alignItems: 'baseline', gap: 4 },
              },
                fmtMoney(provider.usage?.monthCost, provider.currency),
                provider.currencySource === 'community' && provider.currency === 'CNY'
                  ? h('span', {
                    'data-testid': `token-dash-currency-source-${provider.id}`,
                    title: tr('价格取社区价目表（人民币），与渠道账单可能有差异'),
                    style: { fontSize: 10, color: T.weak },
                  }, tr('按社区表 CNY'))
                  : null)),
            h('div', { style: styles.cardCaption },
              `${hasBudget ? stateOf(percent, API_CRITICAL) : 'unset'} · ${hasBudget ? fmtRatio(budget.percent) : '—'}`))
        }))
    }

    function QuotaCell({ providerId, plan, windowKey }) {
      const percent = plan === undefined ? null : Number(plan.usedPercent)
      const hasValue = Number.isFinite(percent)
      const parts = hasValue ? resetParts(plan.resetAt) : { relative: null, absolute: null }
      const left = hasValue ? Math.max(0, Math.round(100 - percent)) : null
      const testKey = `${providerId}-${windowKey}`
      return h(QuotaGauge, {
        testid: `token-dash-quota-cell-${testKey}`,
        label: windowLabel(windowKey),
        percent,
        state: hasValue ? stateOf(percent, SUB_CRITICAL) : 'empty',
        remaining: left === null ? '—' : tr('剩余 {value}', { value: `${left}%` }),
        relative: parts.relative ?? '—',
        absolute: parts.absolute ?? '—',
        remainingTestid: `token-dash-quota-left-${testKey}`,
        relativeTestid: `token-dash-quota-rel-${testKey}`,
        absoluteTestid: `token-dash-quota-abs-${testKey}`,
      })
    }

    /** P3 订阅卡：每 provider 一张，窗口按实际数量一排等分。 */
    function QuotaTable({ providers }) {
      return h('div', { 'data-testid': 'token-dash-quota-table', style: styles.quotaCards },
        ...providers.map((provider) => {
          const windows = Array.isArray(provider.windows) ? provider.windows : []
          return h('div', {
            key: provider.id, 'data-testid': `token-dash-quota-row-${provider.id}`, style: styles.quotaCard,
          },
            h('div', { style: styles.apiCardHead },
              h('span', { style: styles.apiCardName, title: provider.name }, provider.name),
              h('span', { style: styles.apiChip }, `[ ${tr('订阅')} ]`)),
            windows.length === 0
              ? h('div', { style: styles.empty }, tr('套餐查询失败'))
              : h('div', {
                style: { ...styles.quotaWindows, gridTemplateColumns: `repeat(${windows.length}, minmax(0,1fr))` },
              }, windows.map((plan) => h(QuotaCell, {
                key: plan.key, providerId: provider.id, plan, windowKey: plan.key,
              }))),
            h('div', { style: styles.cardCaption }, `${windows.length} ${tr('窗')}`))
        }))
    }

    /** 预算保存后就地重算 budget，避免等下一轮轮询。 */
    function mergeBudgets(summary, prefs) {
      const providers = (summary?.providers ?? []).map((provider) => {
        const entry = prefs?.budgets?.[provider.id]
        if (entry === undefined) return provider
        const amount = Number(entry.amount) || 0
        const used = Number(provider.budget?.used ?? provider.usage?.monthCost ?? 0)
        const percent = amount > 0 ? Math.min(9.99, used / amount) : 0
        const state = amount <= 0 ? 'unset' : percent >= 1 ? 'over' : percent >= 0.8 ? 'warn' : 'ok'
        return {
          ...provider,
          budget: { ...(provider.budget ?? {}), amount, used, remaining: Math.max(0, amount - used), percent, state, currency: provider.currency },
        }
      })
      return { ...summary, providers }
    }

    const openBoardPage = () => {
      try {
        const layout = layoutRef ?? (typeof ctxRef?.get === 'function' ? ctxRef.get('layout') : null)
        if (layout === null || layout === undefined) return
        if (typeof layout.hasMainPanel === 'function' && layout.hasMainPanel(PAGE_ID) !== true) return
        layout.selectPanel?.(PAGE_ID)
      } catch { /* 宿主未注册时保持当前页 */ }
    }

    function BoardEntry() {
      return h('span', {
        'data-testid': 'token-dash-sidebar-entry', 'aria-hidden': true,
        style: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16 },
      }, h('svg', {
        width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
        strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
      },
        h('path', { d: 'M4 19V9' }), h('path', { d: 'M10 19V5' }), h('path', { d: 'M16 19v-6' }), h('path', { d: 'M2 19h20' })))
    }

    /** P3 整页：自取数 + 两表 + 两格卡与明细 + 底部设置胶囊。 */
    function BoardPage(props) {
      const active = rawActiveProvider(props)
      const [summary, setSummary] = useState(null)
      const [usage, setUsage] = useState(null)
      const [prefs, setPrefs] = useState(null)
      const [range, setRange] = useState('all')
      const [refreshing, setRefreshing] = useState(false)
      const [error, setError] = useState(false)
      const [usageError, setUsageError] = useState(false)
      const prefsRef = useRef(null)
      prefsRef.current = prefs

      const loadSummary = useCallback(async () => {
        try {
          const data = await getJson(summaryPath(active))
          setSummary(data)
          setError(false)
        } catch {
          setError(true)
        }
      }, [active])

      const loadPrefs = useCallback(async () => {
        try { setPrefs(await getJson('/prefs')) } catch { /* keep previous */ }
      }, [])

      const loadUsage = useCallback(async () => {
        try {
          const data = await getJson(`/usage?range=${encodeURIComponent(range)}`)
          setUsage(data)
          setUsageError(false)
        } catch {
          setUsageError(true)
        }
      }, [range])

      const refresh = useCallback(async () => {
        setRefreshing(true)
        try {
          await Promise.all([loadSummary(), loadPrefs(), loadUsage()])
        } finally {
          setRefreshing(false)
        }
      }, [loadSummary, loadPrefs, loadUsage])

      useEffect(() => { void refresh() }, [refresh])
      // 看板常驻，轮询周期取 min(10s, refreshMs)；费用与明细来自 /usage，必须一起刷
      usePolling(() => { void loadSummary(); void loadUsage() }, { refreshMs: Math.min(10_000, Number(summary?.refreshMs) || 60000) })

      const savePrefs = useCallback(async (patch) => {
        if (prefsRef.current === null) return { ok: false, reason: 'not-ready' }
        try {
          const saved = await putPrefs({ ...prefsRef.current, ...patch })
          prefsRef.current = saved
          setPrefs(saved)
          setSummary((current) => (current === null ? current : mergeBudgets(current, saved)))
          return { ok: true, prefs: saved }
        } catch (error) {
          return { ok: false, reason: error.message }
        }
      }, [])

      const refreshSubs = useCallback(async () => {
        try { await fetch(`${API}/providers/refresh`, { method: 'POST', headers: { accept: 'application/json' } }) } catch { /* ignore */ }
        await refresh()
      }, [refresh])

      const providers = summary?.providers ?? []
      const api = providers.filter((provider) => provider.kind === 'api')
      const subscriptions = providers.filter((provider) => provider.kind === 'subscription')
      const models = Array.isArray(usage?.models) ? usage.models : []
      const updated = fmtClock(summary?.updatedAt)
      const degraded = summary?.providersDegraded === true
      const emptyAll = summary !== null && api.length === 0 && subscriptions.length === 0

      return h('div', { 'data-testid': 'token-dash-board-scroll', style: styles.boardScroll },
        h('div', { 'data-testid': 'token-dash-board', style: styles.board },
        h('style', null, TD_CSS),
        h('div', { style: styles.boardHead },
          h('div', { style: styles.boardTitleRow },
            h('div', { style: styles.boardTitle }, tr('Token 看板')),
            h('div', { style: styles.boardMeta },
              `${tr('数据来自本机会话记录')}${updated === null ? '' : ` · ${tr('更新于 {time}', { time: updated })}`}`)),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
            h('a', {
              href: REPO_URL, target: '_blank', rel: 'noopener',
              'data-testid': 'token-dash-repo', title: tr('查看仓库'), style: styles.boardAction,
            }, '★'),
            h('button', {
              type: 'button', 'data-testid': 'token-dash-board-head-refresh',
              'aria-label': tr('刷新'), title: tr('刷新'), disabled: refreshing,
              style: { ...styles.boardAction, cursor: refreshing ? 'default' : 'pointer', opacity: refreshing ? 0.6 : 1 },
              onClick: () => { void refresh() },
            }, h(Icon, { name: refreshing ? 'loader' : 'refresh', size: 13 })))),
        error ? h('div', { style: styles.errorStrip, role: 'alert' },
          h('span', null, tr('刷新失败，保留上次数据')),
          h('button', { type: 'button', style: styles.button, onClick: () => { void refresh() } }, tr('重试'))) : null,
        api.length > 0 ? h('section', { style: styles.boardSection },
          h('div', { style: styles.boardSectionHead }, h('b', { style: styles.sectionTitle }, tr('API 用量（按供应商）'))),
          h(BudgetTable, { providers: api, prefs, onSave: savePrefs })) : null,
        subscriptions.length > 0 ? h('section', { style: styles.boardSection },
          h('div', { style: styles.boardSectionHead },
            h('b', { style: styles.sectionTitle }, tr('订阅套餐（按供应商）')),
            h(IconButton, {
              label: tr('重新检测订阅配额'), testid: 'token-dash-board-rescan',
              disabled: refreshing, onClick: () => { void refreshSubs() },
            }, h(Icon, { name: refreshing ? 'loader' : 'refresh', size: 13 }))),
          h(QuotaTable, { providers: subscriptions })) : null,
        emptyAll ? h('div', { 'data-testid': 'token-dash-board-empty', style: styles.cardBox },
          h('div', { style: styles.empty }, degraded ? tr('供应商探测失败') : tr('未检测到已配置供应商')),
          degraded ? h('button', { type: 'button', style: styles.button, onClick: () => { void refresh() } }, tr('重试')) : null) : null,
        h('section', { style: styles.boardSection },
          h('div', { style: styles.boardSectionHead }, h('b', { style: styles.sectionTitle }, tr('范围与明细'))),
          h('div', { style: styles.rangeBox },
            h('div', { style: styles.rangeHead },
              h('div', { style: { width: 'max-content', maxWidth: '100%', flex: '0 0 auto', minWidth: 0 } }, h(Segmented, {
                value: range, onChange: setRange, label: tr('时间范围'), fit: true,
                options: RANGES.map(([value, label]) => ({ value, label: tr(label) })),
              })),
              h('span', { style: styles.rangeMeta },
                `${tr('共 {n} 个模型', { n: models.length })}${updated === null ? '' : ` · ${tr('更新于 {time}', { time: updated })}`}`)),
            usageError ? h('div', { style: styles.errorStrip, role: 'alert' },
              h('span', null, tr('范围数据加载失败')),
              h('button', { type: 'button', style: styles.button, onClick: () => { void loadUsage() } }, tr('重试'))) : null,
            h(RangeCards, { usage }),
            h('div', { style: styles.detailWrap }, h(DetailTable, {
              rows: models,
              providerNames: Object.fromEntries(providers.map((provider) => [provider.id, provider.name])),
            })))),
        h('section', { style: styles.boardSection },
          h('div', { style: styles.boardSectionHead },
            h('div', { style: styles.settingsHead },
              h('b', {
                'data-testid': 'token-dash-settings-title',
                style: styles.sectionTitle,
              }, tr('设置与数据管理')),
              h('span', {
                'data-testid': 'token-dash-settings-locale-hint',
                style: styles.settingsHint,
              }, tr('语言跟随DSH设置；当前仅中文/English，其他语言回退英文')))),
          h('div', { 'data-testid': 'token-dash-settings-capsule', style: styles.capsule },
            h(SettingsRows, { summary, prefs, onSave: savePrefs, onRefresh: refresh, onRefreshSubs: refreshSubs })))))
    }

    return {
      name: PKG,
      inject: ['slots', 'locale', 'layout'],
      apply(ctx) {
        if (ctx.locale !== undefined) {
          localeService = ctx.locale
          try {
            ctx.effect?.(() => ctx.locale.register('token-dash', MESSAGES), 'locale:dictionaries')
            activeTranslate = ctx.locale.bind('token-dash')
          } catch { /* keep built-in zh fallback */ }
        }
        if (!autoUpdateChecked) {
          autoUpdateChecked = true
          ctx.effect?.(() => {
            const timer = setTimeout(() => { void checkForUpdate({ manual: false }) }, 4000)
            return () => clearTimeout(timer)
          }, 'update:startup')
        }
        ctxRef = typeof ctx === 'object' ? ctx : null
        try {
          layoutRef = typeof ctx.get === 'function' ? ctx.get('layout') ?? null : ctx.layout ?? null
        } catch {
          layoutRef = null
        }
        const slots = typeof ctx.get === 'function' ? ctx.get('slots') : ctx.slots
        if (slots === undefined || typeof slots.inject !== 'function') return
        const reportMount = (slot) => {
          try {
            void fetch(`${API}/log`, {
              method: 'POST', headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ module: 'slot', event: 'mount.ok', meta: { slot } }),
            }).catch(() => {})
          } catch { /* ignore */ }
        }
        slots.inject('conversation.composer.dock', () => {
          reportMount('conversation.composer.dock')
          return slots.register({ name: 'conversation.composer.dock', id: 'token-dash-input', order: 10 }, LocaleRoot)
        })
        slots.inject('main', () => {
          reportMount('main')
          return slots.register({ name: 'main', key: PAGE_ID, label: tr('Token 看板') }, BoardPage)
        })
        slots.inject('sidebar.panellist', () => {
          reportMount('sidebar.panellist')
          return slots.register({ name: 'sidebar.panellist', id: PAGE_ID, order: 6, label: tr('Token 看板') }, BoardEntry)
        })
      },
    }
  },
})
