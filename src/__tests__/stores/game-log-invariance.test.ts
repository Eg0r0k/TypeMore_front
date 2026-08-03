/**
 * The submitted artifact must not have moved.
 *
 * `publishSettled` sits on the REJECTION branch of every dispatching wrapper —
 * exactly the place where it would be easy to start recording something. It must
 * not: a rejected event never enters the log, never consumes a seq, and never
 * touches the score accumulator. What the run hands to the server (log, metrics,
 * score) has to be byte-for-byte what it was before the publication existed.
 *
 * The proof is a second, independent driver. `referenceLog` re-implements the
 * store's LOG path from scratch — the same stamping discipline, the same
 * seq-return on rejection, the same tick mapping — against a bare `GameCore`
 * that no store ever touches. It knows nothing about publication, because the
 * log path knows nothing about publication. Every script below is then folded,
 * measured and scored from the log alone and compared against what the store
 * reports live.
 *
 * The scripts are chosen for the paths that could break it: ordinary rejections,
 * refused keystrokes, keys landing past a timed deadline through each of the
 * four wrappers, v2 telemetry crossing the deadline, and a count run typed into
 * after it ended.
 */
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  type CoreConfig,
  type CoreContext,
  type EventLogVersion,
  type GameEvent,
  type GenerationConfig,
  type ModsDeclaration,
  type TimerCommand,
  type TimerTick,
  GameCore,
  asMs,
  commitEvent,
  computeMetrics,
  deleteEvent,
  foldLog,
  insertEvent,
  keyDownEvent,
  keyUpEvent,
  replaceEvent,
  scoreV2OfLog
} from '@typemore/core'
import type { TimerWorkerLike } from '@shared/lib/hooks/useGameTimer'
import { useGameStore } from '@entities/game'

class FakeTimerWorker implements TimerWorkerLike {
  onmessage: ((event: MessageEvent<TimerTick>) => void) | null = null
  /** Echoed on every tick, like the real worker — the store drops foreign epochs. */
  private epoch = 0

  postMessage(message: TimerCommand): void {
    if (message.cmd === 'start') this.epoch = message.epoch
  }

  terminate(): void {}

  emitTick(elapsedMs: number): void {
    this.onmessage?.({ data: { type: 'tick', elapsedMs, epoch: this.epoch } } as never)
  }
}

/** One scripted interaction. `at` is the wall clock the store will stamp from. */
type Action =
  | { readonly do: 'insert'; readonly text: string; readonly at: number }
  | { readonly do: 'delete'; readonly unit: 'char' | 'word'; readonly at: number }
  | { readonly do: 'commit'; readonly at: number }
  | {
      readonly do: 'replace'
      readonly from: number
      readonly to: number
      readonly text: string
      readonly at: number
    }
  | { readonly do: 'down'; readonly code: string; readonly at: number }
  | { readonly do: 'up'; readonly code: string; readonly at: number }
  /** An authoritative worker tick, in elapsed-since-start ms. Never logged. */
  | { readonly do: 'tick'; readonly elapsed: number }

interface Script {
  readonly name: string
  readonly config: CoreConfig
  readonly words: readonly string[]
  readonly logVersion: EventLogVersion
  readonly actions: readonly Action[]
}

const TIME_10S: CoreConfig = {
  mode: 'time',
  durationMs: 10_000,
  maxExtraChars: 20,
  difficulty: 'normal',
  nospace: false
}
const WORDS_2: CoreConfig = { ...TIME_10S, mode: 'words', durationMs: 0 }

const GENERATION: GenerationConfig = {
  mode: 'time',
  length: 0,
  punctuation: false,
  numbers: false,
  randomCase: false,
  reverse: false
}
const DECLARATION: ModsDeclaration = { blind: false, fading: false, flashlight: false }

/**
 * The store's log path, re-implemented against a private core.
 *
 * Mirrors `stamp` (anchor on the first stamped event, integer offsets), the
 * seq-return on rejection, the v1 drop of telemetry, and the tick mapping
 * (`timerStartT + elapsed`, where `timerStartT` is the `t` of the event that
 * started the run). Publication does not appear here because it cannot: the log
 * is a function of the events alone.
 */
function referenceLog(script: Script): readonly GameEvent[] {
  const core = new GameCore({ config: script.config, words: script.words })
  let seq = 0
  let anchor: number | null = null
  let timerStartT = 0

  for (const action of script.actions) {
    if (action.do === 'tick') {
      core.tick(asMs(timerStartT + action.elapsed))
      continue
    }
    const isTelemetry = action.do === 'down' || action.do === 'up'
    if (isTelemetry && script.logVersion !== 2) continue
    if (isTelemetry && core.state.phase === 'finished') continue

    if (anchor === null) anchor = action.at
    seq += 1
    const t = Math.round(action.at - anchor)
    const wasIdle = core.state.phase === 'idle'
    const event: GameEvent =
      action.do === 'insert'
        ? insertEvent(seq, t, action.text)
        : action.do === 'delete'
          ? deleteEvent(seq, t, action.unit)
          : action.do === 'commit'
            ? commitEvent(seq, t)
            : action.do === 'replace'
              ? replaceEvent(seq, t, action.from, action.to, action.text, 'ime')
              : action.do === 'down'
                ? keyDownEvent(seq, t, action.code)
                : keyUpEvent(seq, t, action.code)

    const result = core.dispatch(event)
    if (result.isErr()) seq -= 1
    else if (wasIdle && result.value.phase === 'running') timerStartT = t
  }
  return core.events
}

/** The same script, driven through the real store. */
function driveStore(script: Script, id: string, clock: { now: number }) {
  const store = useGameStore(id)
  const worker = new FakeTimerWorker()
  store.attachTimer(() => worker)
  store.setup({
    config: script.config,
    words: script.words,
    generation: GENERATION,
    declaration: DECLARATION,
    logVersion: script.logVersion
  })
  for (const action of script.actions) {
    if (action.do === 'tick') {
      worker.emitTick(action.elapsed)
      continue
    }
    clock.now = action.at
    switch (action.do) {
      case 'insert':
        store.insert(action.text)
        break
      case 'delete':
        store.deleteBackward(action.unit)
        break
      case 'commit':
        store.commit()
        break
      case 'replace':
        store.replace(action.from, action.to, action.text, 'ime')
        break
      case 'down':
        store.keyDown(action.code)
        break
      case 'up':
        store.keyUp(action.code)
        break
    }
  }
  return store
}

const SCRIPTS: readonly Script[] = [
  // Each of the four wrappers meeting a passed deadline with no tick delivered —
  // the path `publishSettled` was added to.
  {
    name: 'insert past the deadline',
    config: TIME_10S,
    words: ['ab', 'cd'],
    logVersion: 1,
    actions: [
      { do: 'insert', text: 'a', at: 1000 },
      { do: 'insert', text: 'b', at: 1400 },
      { do: 'commit', at: 1800 },
      { do: 'insert', text: 'c', at: 2200 },
      { do: 'insert', text: 'd', at: 11_001 }
    ]
  },
  {
    name: 'delete past the deadline',
    config: TIME_10S,
    words: ['ab', 'cd'],
    logVersion: 1,
    actions: [
      { do: 'insert', text: 'a', at: 1000 },
      { do: 'insert', text: 'b', at: 1400 },
      { do: 'delete', unit: 'char', at: 11_001 }
    ]
  },
  {
    name: 'commit past the deadline',
    config: TIME_10S,
    words: ['ab', 'cd'],
    logVersion: 1,
    actions: [
      { do: 'insert', text: 'a', at: 1000 },
      { do: 'commit', at: 11_001 }
    ]
  },
  {
    name: 'replace past the deadline',
    config: TIME_10S,
    words: ['ab', 'cd'],
    logVersion: 1,
    actions: [
      { do: 'insert', text: 'a', at: 1000 },
      { do: 'replace', from: 0, to: 1, text: 'x', at: 11_001 }
    ]
  },
  // A run that ends the ordinary way (the tick lands) and is then typed into.
  {
    name: 'finished by tick, then more keys',
    config: TIME_10S,
    words: ['ab', 'cd'],
    logVersion: 1,
    actions: [
      { do: 'insert', text: 'a', at: 1000 },
      { do: 'insert', text: 'b', at: 1400 },
      { do: 'tick', elapsed: 10_000 },
      { do: 'insert', text: 'c', at: 11_500 },
      { do: 'commit', at: 11_800 }
    ]
  },
  // Ordinary rejections that are NOT completions: the publication must stay out.
  {
    name: 'backspace locked mid-run',
    config: TIME_10S,
    words: ['ab', 'cd'],
    logVersion: 1,
    actions: [
      { do: 'insert', text: 'a', at: 1000 },
      { do: 'insert', text: 'b', at: 1200 },
      { do: 'commit', at: 1400 },
      { do: 'delete', unit: 'char', at: 1600 }, // BackspaceLocked
      { do: 'insert', text: 'c', at: 1800 },
      { do: 'tick', elapsed: 10_000 }
    ]
  },
  {
    name: 'stopOnError letter refuses keystrokes',
    config: { ...TIME_10S, stopOnError: 'letter' },
    words: ['ab', 'cd'],
    logVersion: 1,
    actions: [
      { do: 'insert', text: 'z', at: 1000 }, // refused, run still idle
      { do: 'insert', text: 'a', at: 1200 },
      { do: 'insert', text: 'q', at: 1400 }, // refused
      { do: 'insert', text: 'b', at: 1600 },
      { do: 'tick', elapsed: 10_000 }
    ]
  },
  // v2 telemetry crossing the deadline — the site whose guard order changed.
  {
    name: 'v2 telemetry crosses the deadline',
    config: TIME_10S,
    words: ['ab', 'cd'],
    logVersion: 2,
    actions: [
      { do: 'down', code: 'KeyA', at: 1000 },
      { do: 'insert', text: 'a', at: 1010 },
      { do: 'up', code: 'KeyA', at: 1090 },
      { do: 'down', code: 'KeyB', at: 1400 },
      { do: 'insert', text: 'b', at: 1410 },
      { do: 'up', code: 'KeyB', at: 11_100 }, // release lands past the deadline
      { do: 'down', code: 'KeyC', at: 11_300 }, // dropped: the core is finished
      { do: 'insert', text: 'c', at: 11_310 }
    ]
  },
  // A count run that ends by running out of text and is then typed into.
  {
    name: 'count run finished, then more keys',
    config: WORDS_2,
    words: ['ab', 'cd'],
    logVersion: 1,
    actions: [
      { do: 'insert', text: 'a', at: 1000 },
      { do: 'insert', text: 'b', at: 1200 },
      { do: 'commit', at: 1400 },
      { do: 'insert', text: 'c', at: 1600 },
      { do: 'insert', text: 'd', at: 1800 },
      { do: 'commit', at: 2000 }, // finishes by count
      { do: 'insert', text: 'e', at: 2200 },
      { do: 'delete', unit: 'char', at: 2400 },
      { do: 'commit', at: 2600 }
    ]
  }
]

describe('the rejection path records nothing', () => {
  const clock = { now: 0 }

  beforeEach(() => {
    setActivePinia(createPinia())
    clock.now = 0
    vi.spyOn(performance, 'now').mockImplementation(() => clock.now)
  })
  afterEach(() => vi.restoreAllMocks())

  it.each(SCRIPTS.map((script) => [script.name, script] as const))(
    'log, metrics and score are the log’s own: %s',
    (name, script) => {
      const store = driveStore(script, `inv-${name.replace(/\s+/g, '-')}`, clock)
      const log = store.getReplayData()?.log ?? []
      const ctx: CoreContext = { config: script.config, words: script.words }

      // 1. The log is exactly what an independent driver produces.
      expect(log).toEqual(referenceLog(script))

      // 2. seq stayed contiguous from 1 — validateLog's structural rule #1, and
      //    the invariant the peers' desync detector reads.
      expect(log.map((event) => event.seq)).toEqual(log.map((_, index) => index + 1))

      // 3. ...and monotonic in time.
      for (let i = 1; i < log.length; i++) expect(log[i].t).toBeGreaterThanOrEqual(log[i - 1].t)

      // 4. No STATE event at or after a timed deadline. validateLog rejects a
      //    whole log for one, and this fix operates on precisely those keys —
      //    they must keep being refused rather than recorded. (Telemetry is
      //    exempt there and is exempt here, for the same reason.)
      const startedAt = store.snapshot.startedAt
      if (script.config.mode === 'time' && startedAt !== null) {
        const deadline = startedAt + script.config.durationMs
        const state = log.filter((event) => event.kind !== 'down' && event.kind !== 'up')
        expect(state.filter((event) => event.t >= deadline)).toEqual([])
      }

      // 5. Folding the log the way the server does reproduces the live snapshot.
      const endMs =
        script.config.mode === 'time' && startedAt !== null
          ? asMs(startedAt + script.config.durationMs)
          : undefined
      const folded = foldLog(ctx, log, endMs)
      expect(folded.isOk()).toBe(true)
      const finalState = folded._unsafeUnwrap()
      expect(finalState.phase).toBe(store.snapshot.phase)
      expect(finalState.finishedAt).toBe(store.snapshot.finishedAt)
      expect(finalState.wordIndex).toBe(store.snapshot.wordIndex)
      expect(finalState.input).toEqual(store.snapshot.input)

      // 6. The metrics the results screen shows are the log's metrics.
      expect(store.snapshot.finishedAt).not.toBeNull()
      const measured = computeMetrics(ctx, log, store.snapshot.finishedAt as never)
      expect(store.metrics).toEqual(measured)

      // 7. The live score accumulator still agrees with a full refold of the
      //    log — which it only can if the rejected events never reached
      //    `advanceScore`.
      expect(store.scoreResult).toEqual(
        scoreV2OfLog(log, { config: script.config, words: script.words, generation: GENERATION }, DECLARATION)
      )
    }
  )
})
