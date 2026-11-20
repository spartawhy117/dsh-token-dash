/**
 * Version ordering for the update check.
 *
 * Local builds are published as `X.Y.Z-local.N`; that is a prerelease of the same
 * X.Y.Z, so `1.0.7-local.1 < 1.0.7` and local numbers grow numerically.
 */

function parseVersion(value) {
  const text = String(value ?? '')
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-local\.(\d+))?$/.exec(text)
  if (match === null) {
    const parts = text.split('.').map((part) => Number.parseInt(part, 10) || 0)
    return { base: [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0], local: null }
  }
  return {
    base: [Number(match[1]), Number(match[2]), Number(match[3])],
    local: match[4] === undefined ? null : Number(match[4]),
  }
}

/** -1 / 0 / 1 for left older than / equal to / newer than right. */
export function compareVersions(left, right) {
  const a = parseVersion(left)
  const b = parseVersion(right)
  for (let index = 0; index < 3; index += 1) {
    if (a.base[index] !== b.base[index]) return a.base[index] > b.base[index] ? 1 : -1
  }
  if (a.local === null && b.local === null) return 0
  if (a.local === null) return 1
  if (b.local === null) return -1
  return a.local === b.local ? 0 : a.local > b.local ? 1 : -1
}

/** True when both share the same X.Y.Z base, ignoring the local suffix. */
export function sameBase(left, right) {
  const a = parseVersion(left)
  const b = parseVersion(right)
  return a.base[0] === b.base[0] && a.base[1] === b.base[1] && a.base[2] === b.base[2]
}

/** True when `latest` is strictly newer than `current`. */
export function isNewer(latest, current) {
  return compareVersions(latest, current) > 0
}
