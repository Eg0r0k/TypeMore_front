/**
 * Board cell formatting. Every function here is DISPLAY ONLY — the server's
 * numbers are the record and are never mutated, only rendered.
 *
 * Dates delegate to the shared dayjs boundary (`@/shared/lib/helpers/datetime`):
 * the old `Intl.RelativeTimeFormat` path rendered Russian narrow relatives as a
 * signed number («-3 дн.»), which read on the board as "minus three days".
 */
import {
  formatClockOrDate,
  formatExactInstant,
  formatRelativeInstant
} from '@/shared/lib/helpers/datetime'

/**
 * `achievedAt` is an ISO string. Within the last day the clock time is what
 * tells two runs apart; older than that, the date is — and it lives here rather
 * than as `new Date()` soup in a template, so every board surface agrees on
 * what "when" means.
 *
 * `now` is injectable so the boundary is testable without freezing the clock.
 */
export const formatAchievedAt = (
  iso: string,
  locale?: string,
  now: number = Date.now()
): string => formatClockOrDate(iso, locale, now)

/**
 * The RELATIVE "when" the date column shows: «5 минут назад» / "3 days ago".
 * Beyond ~4 weeks the calendar date reads better than "37 days ago", and the
 * exact tooltip carries the rest.
 */
export const formatRelativeAchievedAt = (
  iso: string,
  locale?: string,
  now: number = Date.now()
): string => formatRelativeInstant(iso, locale, now)

/** The EXACT instant, for the tooltip over the relative label. */
export const formatExactAchievedAt = (iso: string, locale?: string): string =>
  formatExactInstant(iso, locale)

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
