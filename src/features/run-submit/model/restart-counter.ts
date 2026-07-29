/**
 * The abandoned-run counter behind RUNS.md's `restartsSinceLastSubmit`.
 *
 * A run that was STARTED (first keystroke landed) and never submitted leaves
 * no log, no score, no row — so without this count the profile's "tests
 * started" could only equal "tests completed". The client counts those runs
 * locally and reports the number on the NEXT run it submits; the server's
 * profile aggregation reads `tests_started = count(completed) + sum(restarts)`.
 *
 * Persistence is localStorage, synchronously on every bump, because the
 * hardest abandonment to catch is the page dying (reload/close mid-run): the
 * `pagehide` handler gets one synchronous chance to record it. Nothing is ever
 * SENT from here — an anonymous player's abandons simply accumulate until a
 * future authed submission reports them (unfinished runs are never posted on
 * their own, for anyone).
 *
 * The count is capped at the server's validation ceiling: out-of-range would
 * turn the NEXT legitimate submission into a 422.
 */

import { clamp } from '@/shared/lib/helpers/numbers'

const STORAGE_KEY = 'runs-restarts-since-submit'

/** RUNS.md: integer in [0, 10 000]; beyond is `422 invalid_restarts`. */
export const MAX_RESTARTS = 10_000

const read = (): number => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw === null ? 0 : Number.parseInt(raw, 10)
    return Number.isFinite(parsed) ? clamp(parsed, 0, MAX_RESTARTS) : 0
  } catch {
    return 0
  }
}

const write = (value: number): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(value))
  } catch {
    // Quota/privacy-mode failure: the count degrades to "fewer than reality",
    // which is the safe direction for an unverifiable, trust-based number.
  }
}

/** Current count — what the next submitted payload should carry. */
export const peekRestarts = (): number => read()

/** One more started-and-abandoned run. */
export const bumpRestarts = (): void => write(Math.min(read() + 1, MAX_RESTARTS))

/** The counter reported and accepted — the window starts over. */
export const clearRestarts = (): void => write(0)
