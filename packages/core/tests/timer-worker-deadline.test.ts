/**
 * The terminal tick must not undershoot the deadline.
 *
 * `settle` finishes a timed run on `nowMs >= startedAt + durationMs` — a STRICT
 * comparison against a full-precision float. The worker's terminal tick is the
 * only thing that ever delivers that instant, and after firing it the worker
 * stops unconditionally. So a terminal tick reporting `elapsedMs = 14999.6` for a
 * 15s run does not finish the run and nothing else ever will: the progress bar
 * (an independent CSS transition) still empties, the words stay on screen, and
 * the results never open.
 *
 * WHY IT UNDERSHOOTS. `nextTickDelay` returns a fractional delay, and
 * `setTimeout`'s `timeout` argument is a WebIDL `long`: `setTimeout(fn, 999.6)`
 * waits 999ms. Every tick therefore loses the fractional part of its own delay,
 * and the fraction is real — the worker reads `performance.now()` again only
 * AFTER structured-cloning the tick to the main thread, so each callback enters
 * the next `nextTickDelay` a sliver past the grid point it just hit.
 *
 * The harness below is that browser, made punctual and deterministic: virtual
 * `performance.now()`, `setTimeout` that truncates and fires EXACTLY at the delay
 * it was asked for, and one knob — the sub-millisecond cost of posting a tick.
 * Nothing here is pessimistic; a real browser's jitter only decides which side of
 * the deadline the tick lands on, which is precisely why the hang was
 * intermittent.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  type CoreConfig,
  type TimerCommand,
  type TimerTick,
  GameCore,
  asMs,
  insertEvent
} from '@typemore/core'

interface WorkerScope {
  postMessage(message: TimerTick): void
  onmessage: ((event: MessageEvent<TimerCommand>) => void) | null
}

/**
 * Run the real worker module against a virtual clock and return every
 * `elapsedMs` it posted.
 *
 * `postCostMs` is the only source of drift: the time consumed between the
 * `performance.now()` that stamps a tick and the `performance.now()` that
 * schedules the next one (the structured clone of the message). Everything else
 * is ideal — the browser fires each timeout at exactly `trunc(delay)` ms.
 */
async function runWorker(durationMs: number, postCostMs: number): Promise<number[]> {
  const clock = { now: 0 }
  const ticks: number[] = []
  const queue = new Map<number, { at: number; fn: () => void }>()
  let nextId = 1

  const scope: WorkerScope = {
    postMessage(message) {
      ticks.push(message.elapsedMs)
      clock.now += postCostMs
    },
    onmessage: null
  }

  vi.resetModules()
  vi.stubGlobal('self', scope)
  vi.stubGlobal('performance', { now: () => clock.now })
  vi.stubGlobal('setTimeout', (fn: () => void, delay: number) => {
    const id = nextId++
    // WebIDL `long`: the fraction is truncated, never rounded.
    queue.set(id, { at: clock.now + Math.trunc(delay), fn })
    return id
  })
  vi.stubGlobal('clearTimeout', (id: number) => void queue.delete(id))

  await import('../src/timer.worker')
  scope.onmessage?.({
    data: { cmd: 'start', durationMs }
  } as MessageEvent<TimerCommand>)

  // Drain the virtual event loop: earliest deadline first, ties by insertion.
  for (let guard = 0; guard < 100_000 && queue.size > 0; guard++) {
    const [id, entry] = [...queue.entries()].sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0]
    queue.delete(id)
    clock.now = entry.at
    entry.fn()
  }
  expect(queue.size).toBe(0) // the worker always stops itself
  return ticks
}

const timeConfig = (durationMs: number): CoreConfig => ({
  mode: 'time',
  durationMs,
  maxExtraChars: 20,
  difficulty: 'normal',
  nospace: false
})

describe('timer worker: the terminal tick reaches the deadline', () => {
  afterEach(() => vi.unstubAllGlobals())

  // The reproduction, minimal and exact. 0.4ms per post makes the tick grid
  // sawtooth below the ideal grid; tick 15 of a 15s run lands at 14999.6.
  it('does not stop a 15s run 0.4ms short of its deadline', async () => {
    const ticks = await runWorker(15_000, 0.4)

    expect(ticks).toHaveLength(15)
    expect(ticks.at(-1)).toBeGreaterThanOrEqual(15_000)
  })

  // The property, over the whole plausible range: whatever a tick costs to post,
  // the LAST tick a timed run ever receives is at or past its deadline. This is
  // the contract `settle` is entitled to — the worker is the only clock that can
  // deliver the completion instant, and it never fires again after this one.
  it('holds for every post cost and every configured duration', async () => {
    const durations = [10_000, 15_000, 30_000, 60_000, 120_000]
    const costs = [0, 0.05, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 0.99]
    const short: string[] = []

    for (const durationMs of durations) {
      for (const postCostMs of costs) {
        const ticks = await runWorker(durationMs, postCostMs)
        const last = ticks.at(-1) ?? -1
        if (last < durationMs) short.push(`${durationMs}ms @ ${postCostMs}ms/post -> ${last}`)
      }
    }

    expect(short).toEqual([])
  })

  // The clamp is confined to the terminal tick. Every tick before it stays a
  // truthful reading of the worker's own clock — the live wpm/raw cadence and
  // the AFK buckets are measured against those, and rounding them to the grid
  // would move numbers the deadline has nothing to do with.
  it('leaves every non-terminal tick untouched', async () => {
    const ticks = await runWorker(15_000, 0.4)

    // Rounded to 0.1ms: the values are float sums of 0.4 and carry the usual noise.
    expect(ticks.slice(0, -1).map((ms) => Math.round(ms * 10) / 10)).toEqual([
      1000, 1999.4, 2999.8, 3999.2, 4999.6, 6000, 6999.4, 7999.8, 8999.2, 9999.6, 11_000,
      11_999.4, 12_999.8, 13_999.2
    ])
  })

  // The symptom itself, through the real reducer: the store maps `elapsedMs`
  // onto the event timebase and hands it to `GameCore.tick`. With the worker
  // stopping short, the run stays `running` after its last tick forever.
  it('finishes the run in the core, which is what the hang was', async () => {
    const config = timeConfig(15_000)
    const core = new GameCore({ config, words: ['ab', 'cd'] })
    core.dispatch(insertEvent(1, 0, 'a')) // startedAt = 0, so nowMs === elapsedMs

    for (const elapsedMs of await runWorker(15_000, 0.4)) core.tick(asMs(elapsedMs))

    expect(core.state.phase).toBe('finished')
    expect(core.state.finishedAt).toBe(15_000)
  })
})

describe('the clamp cannot move a single number', () => {
  afterEach(() => vi.unstubAllGlobals())

  // `settle` pins `finishedAt` to `startedAt + durationMs` — the DEADLINE, never
  // the instant the tick fired. So a terminal tick reporting 15000 instead of
  // 14999.6 (or instead of 15004.3, when the browser fires late) produces a
  // bit-identical state: same phase, same finishedAt, same metrics, same score
  // input. The clamp reports the instant the run ended, it does not invent time.
  it('produces the identical finished state whatever the terminal tick reports', () => {
    const config = timeConfig(15_000)
    const build = (terminal: number): GameCore => {
      const core = new GameCore({ config, words: ['ab', 'cd'] })
      core.dispatch(insertEvent(1, 0, 'a'))
      core.dispatch(insertEvent(2, 500, 'b'))
      core.dispatch(insertEvent(3, 900, ' '.trim() || 'x'))
      for (let i = 1; i < 15; i++) core.tick(asMs(i * 1000))
      core.tick(asMs(terminal))
      return core
    }

    const clamped = build(15_000)
    const late = build(15_004.3)

    expect(clamped.state.phase).toBe('finished')
    expect(clamped.state.finishedAt).toBe(15_000)
    expect(late.state.finishedAt).toBe(clamped.state.finishedAt)
    expect(JSON.stringify(late.state)).toBe(JSON.stringify(clamped.state))
  })
})
