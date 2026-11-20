import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addDays,
  buildModel,
  collectReleases,
  estimate,
  median,
  pickBaseline,
  renderMarkdown,
  releaseWaves,
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
  // 11-01 是首发日，11-02 ~ 11-09 都在冷启动内，基线只取 11-11 ~ 11-14
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

test('buildModel：当日未结算记为 null，latest 版本 0 下载也入表', () => {
  const model = buildModel({
    pkg: 'demo-pkg',
    registry: {
      time: {
        created: '2026-11-19T00:00:00Z',
        '2.3.1': '2026-11-19T07:00:00Z',
        '2.4.0': '2026-11-20T10:51:00Z',
      },
      'dist-tags': { latest: '2.4.0' },
    },
    weekDownloads: [['2.3.1', 129]],
    rangeDownloads: [
      { day: '2026-11-19', downloads: 177 },
      { day: '2026-11-20', downloads: 0 },
    ],
    days: 30,
    now: new Date('2026-11-20T12:00:00Z'),
  })
  assert.equal(model.daily.at(-1).downloads, null)
  assert.equal(model.totals.week, 129)
  assert.equal(model.totals.window, 177)
  assert.equal(model.totals.lastDay.day, '2026-11-19')
  assert.equal(model.firstDay, '2026-11-19')
  const newest = model.versions.find((row) => row.version === '2.4.0')
  assert.equal(newest.downloads, 0)
  assert.equal(newest.latest, true)
  assert.equal(newest.stale, false)
})

test('renderMarkdown：总量、版本分布、估算与口径说明齐备', () => {
  const model = buildModel({
    pkg: 'demo-pkg',
    registry: {
      time: { '2.3.1': '2026-11-19T07:00:00Z', '2.4.0': '2026-11-20T10:51:00Z' },
      'dist-tags': { latest: '2.4.0' },
    },
    weekDownloads: [['2.3.1', 129]],
    rangeDownloads: [
      { day: '2026-11-19', downloads: 177 },
      { day: '2026-11-20', downloads: 0 },
    ],
    days: 30,
    now: new Date('2026-11-20T12:00:00Z'),
  })
  const markdown = renderMarkdown(model)
  assert.match(markdown, /# demo-pkg 下载统计/)
  assert.match(markdown, /\| 近 7 天下载 \| 129 \|/)
  assert.match(markdown, /\| 2\.4\.0 \| 0 \| 0\.0% \| 2026-11-20 \| latest \|/)
  assert.match(markdown, /## 估算（启发式，只看趋势）/)
  assert.match(markdown, /## 口径说明/)
})
