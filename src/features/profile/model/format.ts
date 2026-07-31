/** Formatting helpers shared by the profile widgets. Pure; locale-agnostic. */

/** `3 725 000 ms` → `"1h 2m"`; sub-minute times keep seconds (`"45s"`). */
export function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const hours = Math.floor(totalSec / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

/**
 * `3 725 000 ms` → `"01:02:05"`. The stats block's clock: a total that only
 * ever grows reads as a clock, not as prose, and the fixed shape keeps the
 * column from reflowing every time a minute rolls over. Hours are not capped —
 * a hundred hours typed is `100:00:00`.
 */
export function formatClock(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSec / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

/** A [0, 1] fraction as a rounded percent string: `0.973` → `"97%"`. */
export const percent = (fraction: number): string => `${Math.round(fraction * 100)}%`

/** One decimal for speeds (`108.44` → `"108.4"`), trimming a trailing `.0`. */
export const speed = (wpm: number): string => {
  const rounded = Math.round(wpm * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

/** ISO `YYYY-MM-DD` of a Date, in UTC — the grid every profile day bucket uses. */
export const isoDay = (date: Date): string => date.toISOString().slice(0, 10)

/** Today minus `days - 1` days, as an ISO day (the range presets' `from`). */
export function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - (days - 1))
  return isoDay(d)
}
