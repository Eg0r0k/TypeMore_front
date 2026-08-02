import { asMs, type Ms } from '@typemore/core'

/**
 * The shortest window a LIVE speed is measured over.
 *
 * Speed is characters over elapsed time, and over the first few hundred
 * milliseconds that division says nothing: the run's very first keystroke lands
 * at `startedAt` exactly, so the window is zero wide and the formula's own
 * guard reports `0 wpm` — which is not "no reading yet", it is the claim that
 * the player is typing at zero. The next keystroke then divides two characters
 * by 200ms and reports 117, and the number spends the following half-minute
 * falling towards the truth, looking for all the world like the player is
 * slowing down while they type at a perfectly steady pace.
 *
 * monkeytype never meets either, because it only computes on one-second
 * boundaries — its first reading already has a full second underneath it. This
 * is the same guarantee without giving up the per-keystroke response: hold the
 * denominator at one second until the run has actually lasted one, so the
 * reading climbs from zero to the real speed as the characters arrive, and is
 * exact from the first second onwards.
 */
export const LIVE_WINDOW_MS = 1000

/**
 * The instant a live reading should be measured to: `now`, but never closer to
 * the start than {@link LIVE_WINDOW_MS}.
 *
 * For the LIVE path only. A finished run measures to its own `finishedAt`, and
 * must: those are the numbers that get submitted, and `metricsFrom` is vendored
 * into the backend, which recomputes them from the same log. A floor applied
 * there would make the two disagree on any run shorter than a second.
 */
export const liveMeasureAt = (startedAt: Ms | null, now: Ms): Ms =>
  startedAt === null ? now : asMs(Math.max(now, startedAt + LIVE_WINDOW_MS))
