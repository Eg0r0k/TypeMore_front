/**
 * GhostDriver equivalence — the fairness foundation of online mode.
 *
 * Property: feed a captured log into a driver in ANY chunking, at ANY append
 * cadence within the jitter buffer, advancing the virtual clock in ANY
 * irregular steps — the final state and metrics are BIT-IDENTICAL to foldLog
 * of the same log. Not "approximately equal": toEqual over the full snapshot
 * and the full metrics object.
 *
 * The jitter-buffer contract (ghost-driver.ts header): an event must be
 * appended before the display clock reaches it, i.e. simulated relay latency
 * stays under `delayMs`. The scenario generator honors that bound and nothing
 * else — chunk sizes, arrival jitter, and clock steps are all randomized per
 * seed.
 */
import { describe, expect, it } from 'vitest'

import {
  type CoreConfig,
  type CoreContext,
  type GameEvent,
  DEFAULT_MAX_EXTRA_CHARS,
  asMs,
  commitEvent,
  computeMetrics,
  foldLog,
  insertEvent
} from '@shared/core'
import { GhostDriver } from '@entities/match'

import { withTelemetry, withoutSeq } from '../fixtures/telemetry-twin'

const DELAY = 250

const config = (over: Partial<CoreConfig> = {}): CoreConfig => ({
  mode: 'words',
  durationMs: 15_000,
  maxExtraChars: DEFAULT_MAX_EXTRA_CHARS,
  difficulty: 'normal',
  nospace: false,
  ...over
})

/** Deterministic LCG so every failing seed is reproducible. */
function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

/** Type every word correctly: insert each char, commit at the boundary. */
function typeAll(words: readonly string[], intervalMs = 70): GameEvent[] {
  const log: GameEvent[] = []
  let seq = 0
  let t = 0
  for (const word of words) {
    for (const char of word) log.push(insertEvent(++seq, (t += intervalMs), char))
    log.push(commitEvent(++seq, (t += intervalMs)))
  }
  return log
}

const wordsList = ['hello', 'world', 'foo']
const wordsCtx: CoreContext = { config: config(), words: wordsList }
const wordsLog = typeAll(wordsList)

// Time mode: the bot types two words then idles; the run must settle at the
// 10s deadline with no further events (audit area 3, gap 3).
const timeCtx: CoreContext = {
  config: config({ mode: 'time', durationMs: 10_000 }),
  words: wordsList
}
const timeLog = typeAll(wordsList.slice(0, 2)) // last event t = 840 << deadline
// typeAll stamps the first insert at t=70, so the run starts (and the deadline
// anchors) there — not at 0.
const timeDeadline = timeLog[0].t + 10_000

// Match policy: every core is live from t = 0 (the server's go instant), so a
// timed ghost's deadline is the duration itself — no first-keystroke anchor —
// and a ghost whose player never typed still has to settle on the clock alone.
const goCtx: CoreContext = {
  config: config({ mode: 'time', durationMs: 10_000, startPolicy: 'go' }),
  words: wordsList
}
const goDeadline = 10_000

interface Scenario {
  readonly ctx: CoreContext
  /** The log the driver is actually fed. */
  readonly log: readonly GameEvent[]
  /** The v1 capture of the same keystrokes — the result the fold must equal. */
  readonly twin: readonly GameEvent[]
  /** Virtual instant by which everything (deadline included) must be over. */
  readonly endMs: number
}

/**
 * The two wire formats the driver has to be equivalent under. `v1` is the
 * historic coverage; `v2` is the same run captured by a client with keystroke
 * telemetry, which until now never reached this path at all. Telemetry is NOT
 * skipped anywhere along it: the driver dispatches it into the reducer like
 * everything else and the reducer answers with the same state object — feeding
 * these logs through is the only thing that proves it.
 */
const VARIANTS = [
  { name: 'v1 log', capture: (log: readonly GameEvent[]) => log },
  { name: 'v2 log with telemetry', capture: (log: readonly GameEvent[]) => withTelemetry(log) }
] as const
type Variant = (typeof VARIANTS)[number]

const lastT = (log: readonly GameEvent[]): number => log[log.length - 1].t

const wordsScenario = (variant: Variant): Scenario => {
  const log = variant.capture(wordsLog)
  return { ctx: wordsCtx, log, twin: wordsLog, endMs: lastT(log) + DELAY + 50 }
}
const timeScenario = (variant: Variant): Scenario => ({
  ctx: timeCtx,
  log: variant.capture(timeLog),
  twin: timeLog,
  endMs: timeDeadline + DELAY + 50
})
const goScenario = (variant: Variant): Scenario => ({
  ctx: goCtx,
  log: variant.capture(timeLog),
  twin: timeLog,
  endMs: goDeadline + DELAY + 50
})

/**
 * Run one randomized delivery: random chunk sizes, per-chunk arrival latency
 * in [0, DELAY), irregular clock steps. Returns the driver, fully advanced.
 */
function runScenario(scenario: Scenario, rng: () => number): GhostDriver {
  const driver = new GhostDriver(
    { config: scenario.ctx.config, words: scenario.ctx.words },
    { delayMs: DELAY }
  )

  // Chunk the log: 1..6 events per chunk.
  const chunks: GameEvent[][] = []
  for (let i = 0; i < scenario.log.length;) {
    const size = 1 + Math.floor(rng() * 6)
    chunks.push(scenario.log.slice(i, i + size))
    i += size
  }
  // Arrival: the chunk's FIRST event time + latency under the buffer bound —
  // late enough to be a real relay, never so late the display overtakes it.
  // max() keeps the stream ordered, like a real socket.
  let previous = 0
  const arrivals = chunks.map((chunk) => {
    previous = Math.max(previous, chunk[0].t + rng() * (DELAY * 0.95))
    return previous
  })

  // Drive: irregular steps between 1 and ~180 ms of virtual time.
  let now = 0
  let next = 0
  while (now < scenario.endMs) {
    now = Math.min(scenario.endMs, now + 1 + rng() * 180)
    while (next < chunks.length && arrivals[next] <= now) driver.append(chunks[next++])
    driver.advance(now)
  }
  // Deliver any straggler chunks (arrival ≤ lastT + DELAY ≤ endMs by bound,
  // but guard against float edges), then let the display clock drain.
  while (next < chunks.length) driver.append(chunks[next++])
  driver.advance(scenario.endMs + DELAY)
  return driver
}

describe.each(VARIANTS)('GhostDriver equivalence (property): $name', (variant) => {
  const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1)

  it.each(SEEDS)(
    'word-mode log: any chunking/cadence reproduces foldLog exactly (seed %i)',
    (seed) => {
      const scenario = wordsScenario(variant)
      const driver = runScenario(scenario, lcg(seed))
      const folded = foldLog(wordsCtx, scenario.log)._unsafeUnwrap()
      expect(driver.view.snapshot).toEqual(folded)
      expect(driver.view.finished).toBe(true)
      expect(folded.finishedAt).not.toBeNull()
      // …and that fold IS the v1 twin's, apart from the seq counter telemetry
      // also consumes. Metrics are compared against the TWIN's, not the fed
      // log's: identical to the last decimal, telemetry or not.
      const twin = foldLog(wordsCtx, scenario.twin)._unsafeUnwrap()
      expect(withoutSeq(folded)).toEqual(withoutSeq(twin))
      expect(driver.metrics.value).toEqual(
        computeMetrics(wordsCtx, scenario.twin, twin.finishedAt ?? asMs(0))
      )
    }
  )

  it.each(SEEDS)(
    'time-mode log with idle tail: deadline settles via tick, still exact (seed %i)',
    (seed) => {
      const scenario = timeScenario(variant)
      const driver = runScenario(scenario, lcg(seed))
      // foldLog settled well past the deadline == driver display settled there.
      const settleAt = asMs(scenario.endMs + DELAY)
      const folded = foldLog(timeCtx, scenario.log, settleAt)._unsafeUnwrap()
      expect(folded.phase).toBe('finished')
      expect(folded.finishedAt).toBe(timeDeadline) // pinned to the deadline, not a tick instant
      expect(driver.view.snapshot).toEqual(folded)
      const twin = foldLog(timeCtx, scenario.twin, settleAt)._unsafeUnwrap()
      expect(withoutSeq(folded)).toEqual(withoutSeq(twin))
      expect(driver.metrics.value).toEqual(
        computeMetrics(timeCtx, scenario.twin, twin.finishedAt ?? asMs(0))
      )
    }
  )

  it.each(SEEDS)('start policy go: the deadline anchors at t=0, still exact (seed %i)', (seed) => {
    const scenario = goScenario(variant)
    const driver = runScenario(scenario, lcg(seed))
    const settleAt = asMs(scenario.endMs + DELAY)
    const folded = foldLog(goCtx, scenario.log, settleAt)._unsafeUnwrap()
    expect(folded.finishedAt).toBe(goDeadline) // the go instant + duration, not first-keystroke + duration
    expect(driver.view.snapshot).toEqual(folded)
    const twin = foldLog(goCtx, scenario.twin, settleAt)._unsafeUnwrap()
    expect(withoutSeq(folded)).toEqual(withoutSeq(twin))
    expect(driver.metrics.value).toEqual(
      computeMetrics(goCtx, scenario.twin, twin.finishedAt ?? asMs(0))
    )
  })
})

describe('GhostDriver equivalence (property): degenerate deliveries', () => {
  it('start policy go: an idle ghost settles at its deadline from advance() alone', () => {
    const driver = new GhostDriver({ config: goCtx.config, words: wordsList }, { delayMs: DELAY })
    // Nothing is ever appended: this player never typed a character.
    driver.advance(goDeadline + DELAY - 1)
    expect(driver.view.snapshot.phase).toBe('running')
    expect(driver.view.finished).toBe(false)

    driver.advance(goDeadline + DELAY)
    expect(driver.view.finished).toBe(true)
    expect(driver.view.snapshot.finishedAt).toBe(goDeadline)
    // Equivalence holds for the empty log too.
    const folded = foldLog(goCtx, [], asMs(goDeadline + DELAY))._unsafeUnwrap()
    expect(driver.view.snapshot).toEqual(folded)
    expect(driver.metrics.value).toEqual(computeMetrics(goCtx, [], folded.finishedAt ?? asMs(0)))
  })

  it.each(VARIANTS)(
    'degenerate chunkings ($name): all-at-once and one-event-per-chunk both reproduce foldLog',
    (variant) => {
      const scenario = wordsScenario(variant)
      const folded = foldLog(wordsCtx, scenario.log)._unsafeUnwrap()
      expect(withoutSeq(folded)).toEqual(
        withoutSeq(foldLog(wordsCtx, scenario.twin)._unsafeUnwrap())
      )

      const bulk = new GhostDriver(
        { config: wordsCtx.config, words: wordsList },
        { delayMs: DELAY }
      )
      bulk.append(scenario.log)
      bulk.advance(scenario.endMs + DELAY)
      expect(bulk.view.snapshot).toEqual(folded)

      const single = new GhostDriver(
        { config: wordsCtx.config, words: wordsList },
        { delayMs: DELAY }
      )
      for (const event of scenario.log) {
        single.append([event])
        single.advance(event.t + DELAY)
      }
      expect(single.view.snapshot).toEqual(folded)
    }
  )
})

// Ports of the ReplayScheduler suite (superseded by GhostDriver): the clock,
// checkpoint, and restart contracts survive the migration.
describe('GhostDriver as replay (delay 0, complete log)', () => {
  const fresh = (delayMs = 0): GhostDriver => {
    const driver = new GhostDriver({ config: config(), words: wordsList }, { delayMs })
    driver.append(wordsLog)
    return driver
  }
  const lastT = wordsLog[wordsLog.length - 1].t

  it('dispatches nothing until the clock advances', () => {
    const driver = fresh()
    expect(driver.view.snapshot.phase).toBe('idle')
    expect(driver.drained).toBe(false)
  })

  it('a display delay holds events back until virtualNow >= t + delay', () => {
    const driver = fresh(DELAY)
    driver.advance(wordsLog[0].t + DELAY - 1)
    expect(driver.view.snapshot.phase).toBe('idle')
    driver.advance(wordsLog[0].t + DELAY)
    expect(driver.view.snapshot.input[0]).toBe('h')
  })

  it('reproduces foldLog once every event is dispatched', () => {
    const driver = fresh()
    driver.advance(lastT + 1)
    expect(driver.drained).toBe(true)
    expect(driver.view.snapshot).toEqual(foldLog(wordsCtx, wordsLog)._unsafeUnwrap())
    expect(driver.view.finished).toBe(true)
  })

  it('reaches the same final state whether advanced in one jump or many small steps', () => {
    const steps = fresh()
    for (let i = 0; i < 130; i++) steps.advance(i * 10) // absolute clock, 10ms strides
    expect(steps.view.snapshot).toEqual(foldLog(wordsCtx, wordsLog)._unsafeUnwrap())
  })

  it('applies only due events at a checkpoint (dispatch by t)', () => {
    const driver = fresh()
    driver.advance(450)
    const prefix = wordsLog.filter((event) => event.t <= 450)
    expect(driver.view.snapshot).toEqual(foldLog(wordsCtx, prefix)._unsafeUnwrap())
    expect(driver.view.wordIndex).toBe(1)
    expect(driver.view.snapshot.input[0]).toBe('hello')
    expect(driver.drained).toBe(false)
  })

  it('ignores clock regressions (monotonic virtual time)', () => {
    const driver = fresh()
    driver.advance(450)
    const at450 = driver.view.snapshot
    driver.advance(100) // regression: no-op
    expect(driver.view.snapshot).toBe(at450)
    expect(driver.virtualNow).toBe(450)
  })

  it('reset rewinds to a clean core and replays the queued log', () => {
    const driver = fresh()
    driver.advance(lastT + 1)
    expect(driver.drained).toBe(true)

    driver.reset()
    expect(driver.drained).toBe(false)
    expect(driver.view.snapshot.phase).toBe('idle')
    expect(driver.view.wordIndex).toBe(0)

    driver.advance(lastT + 1)
    expect(driver.view.snapshot).toEqual(foldLog(wordsCtx, wordsLog)._unsafeUnwrap())
  })

  it('exposes progress primitives: endMs and drained', () => {
    const driver = fresh()
    expect(driver.endMs).toBe(lastT)
    driver.advance(lastT + 1)
    expect(driver.drained).toBe(true)
  })
})
