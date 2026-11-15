/**
 * 预览规格单一来源。
 *
 * 消费者：tools/preview/render.mjs（HTML 预览）、scripts/e2e.mjs（尺寸断言，后续接入）。
 * 修改尺寸只改本文件；预览与断言一起跟上。
 */

/**
 * 环：P1 / P2 / P3 共用同一套几何与阈值，只是尺寸档位不同。
 * - p1：底栏 Pill 内联
 * - p2：浮层订阅行内联
 * - p3：P3 卡片内（QuotaGauge，按量与订阅共用）
 */
export const RING = {
  p1: { size: 14, stroke: 2 },
  p2: { size: 20, stroke: 2.5 },
  p3: { size: 40, stroke: 4 },
  /** 数字转 amber 的下限（仅染数字，不动弧） */
  warn: 80,
  /** API 预算：≥100 环与数字转红 */
  criticalApi: 100,
  /** 订阅窗口：≥90 环与数字转红 */
  criticalSub: 90,
  /** 三态语义色：语义固定、色值走宿主 token，不散落 hex */
  colors: {
    normal: 'var(--td-state-ok)',
    warn: 'var(--dsw-alias-state-warn-primary)',
    critical: 'var(--dsw-alias-state-error-primary)',
  },
}

export const SPEC = {
  ring: RING,
  /** 统一间距：4 的倍数，页面只用这六档 */
  spacing: {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 24,
    xl: 32,
  },
  /** P3 中栏内容宽与卡片网格 */
  layout: {
    contentWidth: 952, // 1000 中栏 − 24 × 2 padding
    gap: 12,
    minCard: 220,
    maxCard: 260, // 卡片不随剩余宽度无限拉伸，避免 3 家时被拉成 309
    pagePadding: 24,
  },
  card: {
    radius: 8,
    padding: 16,
    gap: 12,
    headerFont: 13,
    chipFont: 11,
  },
  /** 订阅卡内的 QuotaGauge */
  gauge: {
    ring: RING.p3.size,
    stroke: RING.p3.stroke,
    label: 12, // 环心周期
    percent: 16, // 环下百分比
    meta: 11, // 剩余 / 倒计时 / 绝对时间
    gap: 4,
    percentOffset: 4, // 环与百分比之间的额外间距
  },
  /** 按量卡内的环：与订阅同款，只是环心文案不同 */
  apiGauge: {
    ring: RING.p3.size,
    stroke: RING.p3.stroke,
    label: '已用',
  },
  /** P1 / P2 的内联组合：环 + 右侧数字（数字由调用方给） */
  inlineRing: {
    font: 12, // 数字字号（P1/P2 一致）
    gap: 4, // 环与数字间距
  },
  /** P3 摘要带：四格，同时是指标选择器（点某格 → 趋势柱画该指标） */
  summary: {
    columns: 4,
    font: 22, // 四格后每格约 226px，26px 放不下多币种金额
    subFont: 11,
    selectedAlpha: 10, // 选中格底色：accent 的百分比浓度
  },
  /** P3 趋势柱 */
  trend: {
    height: 132,
    axisPadLeft: 34, // Y 轴数字占位
    tickHeight: 18, // 底部日期刻度
    barMax: 36,
    barRadius: 3,
    barGap: 2,
    tickFont: 11,
  },
  /** P2 用量表 */
  table: {
    rowHeight: 28,
    headerFont: 12,
    cellPaddingX: 4,
    dividerAlpha: 0.06,
  },
  /** P2 浮层宽度区间 */
  panel: { minWidth: 280, maxWidth: 480 },
}

/** auto-fit / minmax(minCard, 1fr) 在给定内容宽下的列数 */
export const columnCount = (
  contentWidth = SPEC.layout.contentWidth,
  minCard = SPEC.layout.minCard,
  gap = SPEC.layout.gap,
) => Math.max(1, Math.floor((contentWidth + gap) / (minCard + gap)))

/** 给定列数时每张卡的实际宽度（px，向下取整） */
export const cardWidth = (
  contentWidth = SPEC.layout.contentWidth,
  columns = columnCount(),
  gap = SPEC.layout.gap,
) => Math.floor((contentWidth - gap * (columns - 1)) / columns)
