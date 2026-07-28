/**
 * Board cell formatting. Every function here is DISPLAY ONLY — the server's
 * numbers are the record and are never mutated, only rendered.
 */

const MINUTE_MS = 60_000
const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

/** `Intl` formatters are expensive to construct; one per (locale, kind) is plenty. */
const formatters = new Map<string, Intl.DateTimeFormat>()
const relativeFormatters = new Map<string, Intl.RelativeTimeFormat>()

const formatterFor = (
  locale: string | undefined,
  kind: 'clock' | 'date' | 'exact'
): Intl.DateTimeFormat => {
  const key = `${locale ?? ''}:${kind}`
  const cached = formatters.get(key)
  if (cached !== undefined) return cached
  const made = new Intl.DateTimeFormat(
    locale,
    kind === 'clock'
      ? { hour: '2-digit', minute: '2-digit' }
      : kind === 'date'
        ? { dateStyle: 'short' }
        : { dateStyle: 'medium', timeStyle: 'short' }
  )
  formatters.set(key, made)
  return made
}

const relativeFor = (locale: string | undefined): Intl.RelativeTimeFormat => {
  const key = locale ?? ''
  const cached = relativeFormatters.get(key)
  if (cached !== undefined) return cached
  const made = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'narrow' })
  relativeFormatters.set(key, made)
  return made
}

/**
 * `achievedAt` is an ISO string. Within the last day the clock time is what
 * tells two runs apart; older than that, the date is. Both come out of `Intl`,
 * so the "when" column costs no translated strings — and it lives here rather
 * than as `new Date()` soup in a template, so every board surface agrees on
 * what "when" means.
 *
 * `now` is injectable so the boundary is testable without freezing the clock.
 */
export const formatAchievedAt = (
  iso: string,
  locale?: string,
  now: number = Date.now()
): string => {
  const at = new Date(iso)
  const ms = at.getTime()
  if (Number.isNaN(ms)) return '—'
  const age = now - ms
  return formatterFor(locale, age >= 0 && age < DAY_MS ? 'clock' : 'date').format(at)
}

/**
 * The RELATIVE "when" the date column shows: "5m ago", "3d ago", "yesterday" —
 * out of `Intl.RelativeTimeFormat`, so it costs no translated strings either.
 * Under a minute is "now" territory (formatted as 0-minutes, which `numeric:
 * 'auto'` renders idiomatically); beyond ~4 weeks the calendar date reads
 * better than "37 days ago" and the exact tooltip carries the rest.
 */
export const formatRelativeAchievedAt = (
  iso: string,
  locale?: string,
  now: number = Date.now()
): string => {
  const at = new Date(iso)
  const ms = at.getTime()
  if (Number.isNaN(ms)) return '—'
  const age = now - ms
  if (age < 0 || age >= 28 * DAY_MS) return formatterFor(locale, 'date').format(at)
  const relative = relativeFor(locale)
  if (age < HOUR_MS) return relative.format(-Math.round(age / MINUTE_MS), 'minute')
  if (age < DAY_MS) return relative.format(-Math.round(age / HOUR_MS), 'hour')
  return relative.format(-Math.round(age / DAY_MS), 'day')
}

/** The EXACT instant, for the tooltip over the relative label. */
export const formatExactAchievedAt = (iso: string, locale?: string): string => {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return '—'
  return formatterFor(locale, 'exact').format(at)
}

/**
 * `acc` arrives as a FRACTION (1 = 100%), unlike the percentages the live test
 * screen shows. Guarded against a pre-scaled value so a contract drift renders
 * oddly rather than as "9700%".
 */
export const formatAccuracy = (acc: number): string => `${Math.round(acc <= 1 ? acc * 100 : acc)}%`

/** wpm carries full float precision on the wire; a board column shows whole words. */
export const formatWpm = (wpm: number): string => String(Math.round(wpm))

/** Score is an integer server-side; rounding is belt-and-braces against a float. */
export const formatScore = (score: number): string => String(Math.round(score))
