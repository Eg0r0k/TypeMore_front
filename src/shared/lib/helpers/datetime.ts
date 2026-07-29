import dayjs from 'dayjs'
import 'dayjs/locale/ru'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)
dayjs.extend(localizedFormat)

/**
 * The ONE date/time formatting boundary — every user-facing date goes through
 * dayjs here, never through hand-rolled `Intl` calls or bare
 * `toLocaleString()` in a template.
 *
 * Why not `Intl.RelativeTimeFormat`: its `style: 'narrow'` output in several
 * locales is a signed number — Russian renders `format(-3, 'day')` as
 * literally «-3 дн.», which read on a leaderboard as "minus three days".
 * dayjs's locale files spell the direction out («3 дня назад») in every
 * language we ship.
 *
 * Every function takes the CURRENT app locale (vue-i18n's `locale.value`);
 * unknown/omitted locales fall back to English. All of them render `'—'` for
 * a timestamp that does not parse — never `Invalid Date` soup.
 */

/** The app ships two i18n locales; dayjs mirrors that choice exactly. */
const dayjsLocale = (locale: string | undefined): string =>
  locale?.toLowerCase().startsWith('ru') ? 'ru' : 'en'

const DAY_MS = 86_400_000

/** Beyond this age the calendar date reads better than "37 days ago". */
export const RELATIVE_MAX_AGE_MS = 28 * DAY_MS

/**
 * The RELATIVE "when": «5 минут назад» / "3 days ago". Clock skew (a server
 * timestamp from the future) and anything older than ~4 weeks fall back to the
 * short calendar date — a future-relative guess would be a lie, and the exact
 * tooltip carries the rest.
 *
 * `now` is injectable so the boundaries are testable without freezing the clock.
 */
export const formatRelativeInstant = (
  iso: string,
  locale?: string,
  now: number = Date.now()
): string => {
  const at = dayjs(iso)
  if (!at.isValid()) return '—'
  const age = now - at.valueOf()
  const localized = at.locale(dayjsLocale(locale))
  if (age < 0 || age >= RELATIVE_MAX_AGE_MS) return localized.format('L')
  return localized.from(dayjs(now))
}

/**
 * Clock time within the last day («13:43»), the short date beyond it — the
 * compact "when" cell: within a day the clock is what tells two runs apart,
 * older than that the date is.
 */
export const formatClockOrDate = (
  iso: string,
  locale?: string,
  now: number = Date.now()
): string => {
  const at = dayjs(iso)
  if (!at.isValid()) return '—'
  const age = now - at.valueOf()
  return at.locale(dayjsLocale(locale)).format(age >= 0 && age < DAY_MS ? 'LT' : 'L')
}

/** The EXACT instant — date AND time — for tooltips and log-like tables. */
export const formatExactInstant = (iso: string, locale?: string): string => {
  const at = dayjs(iso)
  return at.isValid() ? at.locale(dayjsLocale(locale)).format('lll') : '—'
}

/** The short calendar date alone («25.07.2026» / "07/25/2026"). */
export const formatShortDate = (iso: string, locale?: string): string => {
  const at = dayjs(iso)
  return at.isValid() ? at.locale(dayjsLocale(locale)).format('L') : '—'
}

