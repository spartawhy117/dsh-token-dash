import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addDays,
  buildModel,
  collectReleases,
  coverageOf,
  estimate,
  launchWindow,
  median,
  parseArgs,
  pickBaseline,
  recentVersions,
  renderMarkdown,
  releaseWaves,
  sortedVersions,
  utcDay,
} from '../../scripts/npm-stats.mjs'

test('utcDay / addDays：统一按 UTC 日归一', () => {
  assert.equal(utcDay('2026-11-20T10:51:08.257Z'), '2026-11-20')
  assert.equal(utcDay('2026-11-20'), '2026-11-20')
  assert.equal(utcDay(new Date('2026-11-20T23:30:00Z')), '2026-11-20')
  assert.equal(utcDay('not-a-date'), null)
  assert.equal(addDays('2026-11-20', 7), '2026-11-27')
  assert.equal(addDays('2026-11-01', -1), '2026-10-31')
})

test('median：奇数取中位，偶数取均值，空数组为 null', () => {
  assert.equal(median([3, 1, 2]), 2)
  assert.equal(median([4, 1, 3, 2]), 2.5)
  assert.equal(median([]), null)
  assert.equal(median([Number.NaN, 5]), 5)
})

test('collectReleases：按 UTC 日聚合，跳过 created/modified', () => {
  const releases = collectReleases({
    created: '2026-10-31T00:00:00Z',
    modified: '2026-11-20T00:00:00Z',
    '1.0.0': '2026-11-01T02:00:00Z',
    '1.0.1': '2026-11-01T09:30:00Z',
    '1.1.0': '2026-11-02T00:10:00Z',
  })
  assert.deepEqual([...releases.keys()].sort(), ['2026-11-01', '2026-11-02'])
  assert.deepEqual(releases.get('2026-11-01'), ['1.0.0', '1.0.1'])
  assert.equal(releases.has('created'), false)
})

test('pickBaseline / releaseWaves：发布日不进基线，from 之前不计', () => {
  const releases = new Map([
    ['2026-11-01', ['1.0.0']],
    ['2026-11-10', ['2.1.0']],
  ])
  const daily = [
    { day: '2026-11-01', downloads: 900 },
    { day: '2026-11-02', downloads: 300 },
    { day: '2026-11-10', downloads: 214 },
    { day: '2026-11-11', downloads: 50 },
    { day: '2026-11-12', downloads: 60 },
    { day: '2026-11-13', downloads: null },
  ]
  // 非发布日：11-02(300) / 11-11(50) / 11-12(60)；null 不计
  assert.equal(pickBaseline(daily, releases), 60)
  assert.equal(pickBaseline(daily, releases, { from: '2026-11-11' }), 55)
  const waves = releaseWaves(daily, releases, 50, { from: '2026-11-08' })
  assert.deepEqual(waves.map((wave) => wave.day), ['2026-11-10'])
  assert.equal(waves[0].excess, 164)
})

test('estimate：首发 7 天算冷启动，装机区间由更新波峰折算', () => {
  const releases = new Map([
    ['2026-11-01', ['1.0.0']],
    ['2026-11-10', ['2.1.0']],
    ['2026-11-15', ['2.2.0']],
  ])
  const values = {
    '2026-11-01': 900,
    '2026-11-02': 400,
    '2026-11-03': 250,
    '2026-11-04': 120,
    '2026-11-05': 80,
    '2026-11-06': 60,
    '2026-11-07': 55,
    '2026-11-08': 55,
    '2026-11-09': 57,
    '2026-11-10': 214,
    '2026-11-11': 50,
    '2026-11-12': 50,
    '2026-11-13': 50,
    '2026-11-14': 50,
    '2026-11-15': 209,
  }
  const daily = Object.entries(values).map(([day, downloads]) => ({ day, downloads }))
  const result = estimate(daily, releases)
  assert.equal(result.warmupFrom, '2026-11-08')
  assert.equal(result.baseline, 50)
  assert.deepEqual(result.waves.map((wave) => wave.excess), [164, 159])
  assert.equal(result.active, 162)
  assert.equal(result.peak, 164)
  assert.equal(result.installLow, 231)
  assert.equal(result.installHigh, 273)
  assert.equal(result.enough, true)
})

test('estimate：没有发布日时不给估算', () => {
  const result = estimate([{ day: '2026-11-20', downloads: 100 }], new Map())
  assert.equal(result.baseline, 100)
  assert.equal(result.active, null)
  assert.equal(result.peak, null)
  assert.equal(result.installLow, null)
  assert.equal(result.enough, false)
})

test('sortedVersions：按发布时间倒序，过滤非版本键', () => {
  const list = sortedVersions({
    created: '2026-10-01T00:00:00Z',
    '1.0.0': '2026-11-01T00:00:00Z',
    '2.0.0': '2026-11-10T00:00:00Z',
    '1.5.0': '2026-11-05T00:00:00Z',
  })
  assert.deepEqual(list.map((row) => row.version), ['2.0.0', '1.5.0', '1.0.0'])
})

test('coverageOf：发布日越靠后，7 日窗口覆盖越高', () => {
  const lastSettledDay = '2026-11-22'
  const today = '2026-11-23'
  assert.equal(coverageOf('2026-11-22', { today, lastSettledDay }), 0)
  assert.equal(coverageOf('2026-11-19', { today, lastSettledDay }), 0.5)
  assert.equal(coverageOf('2026-11-16', { today, lastSettledDay }), 1)
  assert.equal(coverageOf('2026-11-15', { today, lastSettledDay }), 0)
  assert.equal(coverageOf('2026-11-23', { today, lastSettledDay }), 0)
})

test('launchWindow：按发布日往后取整日，缺数据就是 null', () => {
  const dailyByDay = new Map([
    ['2026-11-20', 263],
    ['2026-11-21', null],
  ])
  assert.deepEqual(launchWindow({ releaseDay: '2026-11-20', dailyByDay, days: 1 }), [{ day: '2026-11-20', downloads: 263 }])
  assert.deepEqual(launchWindow({ releaseDay: '2026-11-20', dailyByDay, days: 2 }), [
    { day: '2026-11-20', downloads: 263 },
    { day: '2026-11-21', downloads: null },
  ])
  assert.deepEqual(launchWindow({ releaseDay: '2026-11-24', dailyByDay, days: 1 }), [{ day: '2026-11-24', downloads: null }])
})

test('recentVersions：给出 7 日量 + 发布后 24h / 48h', () => {
  const times = {
    '2.3.0': '2026-11-16T05:25:25Z',
    '2.3.1': '2026-11-19T07:09:40Z',
    '2.4.0': '2026-11-20T10:51:08Z',
  }
  const weekByVersion = new Map([
    ['2.3.0', 349],
    ['2.3.1', 213],
    ['2.4.0', 263],
  ])
  const dailyByDay = new Map([
    ['2026-11-16', 270],
    ['2026-11-17', 69],
    ['2026-11-19', 177],
    ['2026-11-20', 263],
    ['2026-11-21', 119],
  ])
  const rows = recentVersions({
    times,
    weekByVersion,
    dailyByDay,
    latest: '2.4.0',
    count: 3,
    today: '2026-11-23',
    lastSettledDay: '2026-11-22',
  })
  assert.deepEqual(rows.map((row) => row.version), ['2.4.0', '2.3.1', '2.3.0'])
  assert.equal(rows[0].window24, 263)
  assert.equal(rows[0].window48, 382)
  assert.equal(rows[0].pending48, false)
  assert.equal(rows[0].launchExact, true)
  // 2.3.1 发布日 11-19(177) + 次日 11-20(263) = 440（含 2.4.0 的发布日，故真实单版本 48h 更低）
  assert.equal(rows[1].window48, 440)
  // 2.3.0 的次日 11-17 有数据
  assert.equal(rows[2].window48, 339)
})

test('recentVersions：48h 未结算时 window48 为 null 并标记 pending', () => {
  const rows = recentVersions({
    times: { '2.4.0': '2026-11-20T10:51:08Z' },
    weekByVersion: new Map([['2.4.0', 263]]),
    dailyByDay: new Map([['2026-11-20', 263]]),
    latest: '2.4.0',
    count: 1,
    today: '2026-11-22',
    lastSettledDay: '2026-11-20',
  })
  assert.equal(rows[0].window24, 263)
  assert.equal(rows[0].window48, null)
  assert.equal(rows[0].pending48, true)
})

test('recentVersions：同一天发布多个版本时标为不精确', () => {
  const rows = recentVersions({
    times: { '1.3.0': '2026-11-04T19:31:36Z', '2.0.0': '2026-11-04T21:53:45Z' },
    weekByVersion: new Map([['2.0.0', 2], ['1.3.0', 2]]),
    dailyByDay: new Map([['2026-11-04', 432], ['2026-11-05', 263]]),
    latest: '2.0.0',
    count: 2,
    today: '2026-11-10',
    lastSettledDay: '2026-11-09',
  })
  assert.equal(rows[1].launchExact, false)
  assert.deepEqual(rows[1].launchDayVersions, ['1.3.0', '2.0.0'])
})

test('recentVersions：发布日尚未结算时 24h 与 48h 都无数据', () => {
  const rows = recentVersions({
    times: { '2.4.0': '2026-11-20T10:51:08Z' },
    weekByVersion: new Map([['2.4.0', 0]]),
    dailyByDay: new Map([['2026-11-20', null]]),
    latest: '2.4.0',
    count: 1,
    today: '2026-11-20',
    lastSettledDay: '2026-11-19',
  })
  assert.equal(rows[0].window24, null)
  assert.equal(rows[0].window48, null)
  assert.equal(rows[0].pending48, false)
  assert.equal(rows[0].week, 0)
})

test('buildModel：近期版本表、当日未结算与总量对齐', () => {
  const model = buildModel({
    pkg: 'demo-pkg',
    registry: {
      time: {
        created: '2026-11-16T00:00:00Z',
        '2.3.0': '2026-11-16T05:25:00Z',
        '2.4.0': '2026-11-20T10:51:00Z',
      },
      'dist-tags': { latest: '2.4.0' },
    },
    weekDownloads: [['2.3.0', 349]],
    rangeDownloads: [
      { day: '2026-11-19', downloads: 177 },
      { day: '2026-11-20', downloads: 263 },
      { day: '2026-11-21', downloads: 0 },
    ],
    days: 30,
    versions: 2,
    now: new Date('2026-11-21T12:00:00Z'),
  })
  assert.equal(model.daily.at(-1).downloads, null)
  assert.equal(model.lastSettledDay, '2026-11-20')
  assert.equal(model.totals.week, 349)
  assert.equal(model.totals.window, 177 + 263)
  assert.deepEqual(model.recent.map((row) => row.version), ['2.4.0', '2.3.0'])
  const latestRow = model.recent[0]
  assert.equal(latestRow.week, 0)
  assert.equal(latestRow.window24, 263)
  // 次日 11-21 未结算 → 48h 暂缺
  assert.equal(latestRow.window48, null)
  assert.equal(latestRow.pending48, true)
})

test('parseArgs：默认落盘 npm-reports，--stdout 与非法参数', () => {
  assert.deepEqual(parseArgs([]), { days: 30, pkg: null, out: null, json: false, stdout: false, versions: 3 })
  assert.equal(parseArgs(['--versions', '5']).versions, 5)
  assert.equal(parseArgs(['--json']).json, true)
  assert.equal(parseArgs(['--stdout']).stdout, true)
  assert.throws(() => parseArgs(['--versions', '0']), /--versions 需为 1–20 的整数/)
  assert.throws(() => parseArgs(['--days', '3']), /--days 需为 7–365 的整数/)
  assert.throws(() => parseArgs(['--nope']), /未知参数/)
})

test('renderMarkdown：三列口径、暂未更新文案与口径说明齐备', () => {
  const model = buildModel({
    pkg: 'demo-pkg',
    registry: {
      time: { '2.3.0': '2026-11-16T05:25:00Z', '2.4.0': '2026-11-20T10:51:00Z' },
      'dist-tags': { latest: '2.4.0' },
    },
    weekDownloads: [['2.3.0', 349]],
    rangeDownloads: [
      { day: '2026-11-19', downloads: 177 },
      { day: '2026-11-20', downloads: 263 },
      { day: '2026-11-21', downloads: 119 },
      { day: '2026-11-22', downloads: 0 },
    ],
    days: 30,
    versions: 2,
    now: new Date('2026-11-22T12:00:00Z'),
  })
  const markdown = renderMarkdown(model)
  assert.match(markdown, /# demo-pkg 下载统计/)
  assert.match(markdown, /## 近期 2 个版本/)
  assert.match(markdown, /\| 版本 \| 发布后 24h \| 发布后 48h \| 7 日安装量 \| 发布日 \|/)
  assert.match(markdown, /\| 2\.4\.0（latest） \| 263 \| 382 \| 0 \| 2026-11-20 \|/)
  // 表内不再出现年龄与覆盖列
  assert.doesNotMatch(markdown, /版本年龄/)
  assert.doesNotMatch(markdown, /7 日窗口覆盖 \|/)
  assert.match(markdown, /数据暂未更新/)
  assert.match(markdown, /npm-reports\//)
  assert.match(markdown, /## 口径说明/)
})

test('renderMarkdown：48h 未结算时单元格写「数据暂未更新」', () => {
  const model = buildModel({
    pkg: 'demo-pkg',
    registry: {
      time: { '2.4.0': '2026-11-20T10:51:00Z' },
      'dist-tags': { latest: '2.4.0' },
    },
    weekDownloads: [['2.4.0', 263]],
    rangeDownloads: [{ day: '2026-11-20', downloads: 263 }],
    days: 30,
    versions: 1,
    now: new Date('2026-11-21T12:00:00Z'),
  })
  const markdown = renderMarkdown(model)
  assert.match(markdown, /\| 2\.4\.0（latest） \| 263 \| 数据暂未更新 \| 263 \|/)
})
