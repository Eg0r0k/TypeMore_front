/**
 * GhostDriver — a live opponent: a private `GameCore` fed by relayed events
 * instead of local input, plus a `GameView` the game field renders read-only.
 *
 * No Pinia store, no registry entry, no worker — one plain object per ghost,
 * created and dropped with the match. Reactivity is two shallow refs
 * (snapshot + display clock); `view` and `metrics` read through them.
 *
 * Clock model (docs/game-architecture.md, "Match timing model"): the caller
 * drives `advance(virtualNow)` — the shared match clock (t=0 anchor). Display
 * runs `delayMs` behind it (jitter buffer, cosmetic only): an event with time
 * `t` is dispatched when `virtualNow >= t + delayMs`. Deadline settling is
 * forwarded to `core.tick`, so an idle time-mode ghost finishes exactly at its
 * deadline with no further events.
 *
 * Equivalence contract (see ghost-driver.test.ts): as long as every event is
 * appended before the display clock reaches it (relay latency < `delayMs` —
 * what the jitter buffer is FOR), the final state and metrics are bit-identical
 * to `foldLog` of the same log, for any chunking and any advance cadence. To
 * keep that guarantee, the deadline tick fires only when the pending queue is
 * drained: ticking past the deadline while known events are still queued would
 * reject them (`TestFinished`) where `foldLog` — which settles at each event's
 * own `t` — would not. Authoritative results always come from full logs
 * (`validateLog`), never from this display core.
 *
 * `append` takes ALREADY-PARSED, trusted events: `parseEventBatch` runs at the
 * transport boundary, not here.
 */
import { type ComputedRef, type ShallowRef, computed, shallowRef } from 'vue'

import {
  type GameEvent,
  type GameState,
  type Metrics,
  type Ms,
  type ScoreResult,
  type ScoreState,
  GameCore,
  asMs,
  initialScoreState,
  metricsOf,
  scoreOfLog,
  scoreStep,
  sortEvents
} from '@typemore/core'
import type { GameSetup, GameView } from '@entities/game'
import { liveMeasureAt } from '@shared/lib/helpers/live-window'

export const DEFAULT_GHOST_DELAY_MS = 250

export interface GhostDriverOptions {
  /** Fixed display delay (jitter buffer), ms of virtual time. Default 250. */
  readonly delayMs?: number
}

export class GhostDriver {
  private readonly core: GameCore
  private readonly delayMs: number
  /** Appended-but-not-yet-dispatched events; `cursor` marks the consumed prefix. */
  private readonly pending: GameEvent[] = []
  private cursor = 0
  private _virtualNow = 0
  private readonly snapshotRef: ShallowRef<GameState>
  private readonly displayNowRef = shallowRef<Ms>(asMs(0))
  /** Incremental scoreV1 fold of the dispatched prefix — O(1) per event, unlike `score`'s full refold. */
  private scoreState: ScoreState = initialScoreState()
  private readonly liveScoreRef = shallowRef<{ readonly base: number; readonly streak: number }>({
    base: 0,
    streak: 0
  })

  /** Readonly view-model for the game field. Ghosts never render blind. */
  readonly view: GameView
  /** Live metrics (WPM/accuracy/…) recomputed from the ghost's own log. */
  readonly metrics: ComputedRef<Metrics>
  /** Live scoreV1 result from the ghost's own fold — opponents' scores come free (no ghost UI yet). */
  readonly score: ComputedRef<ScoreResult>
  /** Live combo points + current streak, advanced with the display clock (the race rail reads this). */
  readonly liveScore: ComputedRef<{ readonly base: number; readonly streak: number }>

  constructor(setup: GameSetup, options: GhostDriverOptions = {}) {
    this.core = new GameCore({ config: setup.config, words: setup.words })
    this.delayMs = options.delayMs ?? DEFAULT_GHOST_DELAY_MS
    this.snapshotRef = shallowRef(this.core.state)

    const snapshot = this.snapshotRef
    const words = this.core.words
    this.view = {
      get snapshot() {
        return snapshot.value
      },
      words,
      get wordIndex() {
        return snapshot.value.wordIndex
      },
      get finished() {
        return snapshot.value.phase === 'finished'
      },
      blind: false
    }

    this.metrics = computed(() => {
      // Touch both reactive deps, then recompute purely from the log.
      const state = this.snapshotRef.value
      // A ghost's speed is a live reading like the local player's, and starts
      // in the same zero-wide window on its first relayed event.
      return metricsOf(
        this.core,
        state.finishedAt ?? liveMeasureAt(state.startedAt, this.displayNowRef.value)
      )
    })

    this.score = computed(() => {
      void this.snapshotRef.value
      return scoreOfLog(this.core.events, { config: this.core.config, words: this.core.words })
    })

    this.liveScore = computed(() => this.liveScoreRef.value)
  }

  /** The shared match clock as last advanced (NOT the delayed display clock). */
  get virtualNow(): Ms {
    return asMs(this._virtualNow)
  }

  /** Every appended event has been dispatched. */
  get drained(): boolean {
    return this.cursor >= this.pending.length
  }

  /** Largest appended event time — a progress denominator for replay UIs. */
  get endMs(): Ms {
    const last = this.pending[this.pending.length - 1]
    return asMs(last ? last.t : 0)
  }

  /**
   * Queue trusted events. The wire contract is seq order; a batch arriving
   * out of order (interleaved feeds in tests) triggers a defensive re-sort of
   * the undispatched tail.
   */
  append(events: readonly GameEvent[]): void {
    if (events.length === 0) return
    const lastQueued = this.pending[this.pending.length - 1]
    const disordered = lastQueued !== undefined && events[0].seq < lastQueued.seq
    this.pending.push(...events)
    if (disordered) {
      const tail = sortEvents(this.pending.slice(this.cursor))
      this.pending.length = this.cursor
      this.pending.push(...tail)
    }
  }

  /**
   * Advance the shared match clock to `virtualNowMs` (absolute, monotonic —
   * regressions are ignored) and dispatch every event now due on the delayed
   * display clock. Call from the match tick fan-out or a rAF loop.
   */
  advance(virtualNowMs: number): void {
    this._virtualNow = Math.max(this._virtualNow, virtualNowMs)
    const displayNow = this._virtualNow - this.delayMs
    if (displayNow < 0) return

    const dispatchedFrom = this.cursor
    while (this.cursor < this.pending.length && this.pending[this.cursor].t <= displayNow) {
      // Rejected events (e.g. a cheat the reducer refuses) are display no-ops;
      // the authoritative judgement happens in validateLog on the full log.
      const event = this.pending[this.cursor]
      this.core.dispatch(event)
      // Same unconditional fold as `scoreOfLog`: rejected events are no-ops
      // inside `scoreStep` too (a finished state ignores everything).
      scoreStep(this.scoreState, event, { config: this.core.config, words: this.core.words })
      this.cursor += 1
    }
    if (this.cursor > dispatchedFrom) {
      this.liveScoreRef.value = { base: this.scoreState.base, streak: this.scoreState.streak }
    }
    // Deadline settle for an idle ghost — only once the queue is drained (see
    // the equivalence contract in the header).
    if (this.drained) this.core.tick(asMs(displayNow))

    this.snapshotRef.value = this.core.state
    this.displayNowRef.value = asMs(displayNow)
  }

  /** Rewind to a clean core; queued events stay and replay from the start. */
  reset(): void {
    this.core.reset()
    this.cursor = 0
    this._virtualNow = 0
    this.scoreState = initialScoreState()
    this.liveScoreRef.value = { base: 0, streak: 0 }
    this.snapshotRef.value = this.core.state
    this.displayNowRef.value = asMs(0)
  }
}
