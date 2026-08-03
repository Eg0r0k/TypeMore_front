/**
 * Match store — the client-only match skeleton: the local player's game store
 * plus up to `MAX_GHOSTS` GhostDrivers, all on one clock.
 *
 * Timing (docs/game-architecture.md, "Match timing model"): ONE timer — the
 * local player's worker — is the authoritative cadence. Its ticks are teed
 * through the existing `attachTimer` DI seam and fan out to every driver, so
 * a frozen tab still settles ghost deadlines. A rAF loop on the match screen
 * calls `advance()` between ticks for smooth display and for word-count modes
 * (whose timer never starts).
 *
 * t=0 anchor: this skeleton anchors the match clock at the local run's start
 * (the first observed non-idle frame; timer ticks — exact elapsed since that
 * same instant — re-align it). The server-announced "go at T" countdown from
 * the timing model replaces this in C1; the ±one-frame skew here is cosmetic.
 *
 * Feed source is `DemoFeed` (recorded/synthesized logs as bots) — the seam C1
 * swaps for the real transport. Lifecycle: `createMatch` builds everything,
 * `leaveMatch` disposes drivers/feeds and releases the local store.
 */
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import type { GameEvent, TimerTick } from '@typemore/core'
import { type GameSetup, type GameStore, releaseGameStore, useGameStore } from '@entities/game'
import type { TimerWorkerLike } from '@shared/lib/hooks/useGameTimer'

import { type DemoFeedOptions, DemoFeed } from './demo-feed'
import { type GhostDriverOptions, GhostDriver } from './ghost-driver'

export const MAX_GHOSTS = 4
/** The local player's dedicated game-store id — never 'local' (the solo run). */
export const MATCH_LOCAL_STORE_ID = 'match:local'

export interface MatchGhostSetup {
  readonly name: string
  /** Recorded/synthesized event log this opponent will "type". */
  readonly log: readonly GameEvent[]
}

export interface MatchSetup {
  /** Server-dictated snapshot: identical config + words for every core. */
  readonly setup: GameSetup
  readonly ghosts: readonly MatchGhostSetup[]
  readonly driver?: GhostDriverOptions
  readonly feed?: DemoFeedOptions
}

export interface MatchGhost {
  readonly id: string
  readonly name: string
  readonly driver: GhostDriver
}

export const useMatchStore = defineStore('match', () => {
  const ghosts = shallowRef<readonly MatchGhost[]>([])
  const active = ref(false)

  // Non-reactive internals.
  let feeds: DemoFeed[] = []
  let local: GameStore | null = null
  let anchorPerf: number | null = null
  /** Bumped by every `createMatch`; a tee captures it and never outlives it. */
  let generation = 0

  const localStore = computed(() => (active.value ? local : null))

  function createMatch(match: MatchSetup): void {
    leaveMatch()
    // Which match the ghost fan-out belongs to. The run epoch alone cannot
    // answer that: `leaveMatch` releases the local store, and a fresh store
    // starts its own counter at zero — so the next match's first run carries
    // the SAME epoch the previous one did. `advanceTo` is shared across
    // matches, so a tee left over from the previous one would drive THESE
    // ghosts. See `attachLocalTimer`.
    generation += 1
    local = useGameStore(MATCH_LOCAL_STORE_ID)
    local.setup(match.setup)
    feeds = []
    ghosts.value = match.ghosts.slice(0, MAX_GHOSTS).map((ghost, index) => {
      const driver = new GhostDriver(match.setup, match.driver)
      feeds.push(new DemoFeed(driver, ghost.log, { seed: index + 1, ...match.feed }))
      return { id: `ghost-${index}`, name: ghost.name, driver }
    })
    anchorPerf = null
    active.value = true
  }

  /**
   * Install the local player's timer, teeing every authoritative tick into the
   * ghost fan-out. `elapsedMs` is exact time since the local run's start — the
   * match clock — so ticks also re-align the rAF anchor.
   */
  function attachLocalTimer(createWorker: () => TimerWorkerLike): void {
    local?.attachTimer(() => {
      const inner = createWorker()
      // The tee is a SECOND consumer of every tick: the store's handler drops a
      // foreign one for the CORE, and this side must drop it for the ghost
      // fan-out, or a tick from a retired clock jumps every opponent's caret —
      // and unlike the local core, nothing downstream would reject it.
      //
      // Two axes of staleness, because one does not cover the other:
      //  - `armedEpoch` — a different RUN of this match, read off the `start`
      //    passing through, so the tee and the store cannot disagree;
      //  - `generation` — a different MATCH entirely. `leaveMatch` releases the
      //    local store, whose fresh instance restarts its epoch at zero, so the
      //    next match's first run reuses the number this tee is holding.
      const generationAtAttach = generation
      let armedEpoch: number | null = null
      const tee: TimerWorkerLike = {
        postMessage: (message) => {
          if (message.cmd === 'start') armedEpoch = message.epoch
          inner.postMessage(message)
        },
        get onmessage() {
          return inner.onmessage
        },
        set onmessage(handler: ((event: MessageEvent<TimerTick>) => void) | null) {
          inner.onmessage =
            handler === null
              ? null
              : (event) => {
                  handler(event)
                  if (
                    event.data.type === 'tick' &&
                    event.data.epoch === armedEpoch &&
                    generationAtAttach === generation
                  ) {
                    anchorPerf = performance.now() - event.data.elapsedMs
                    advanceTo(event.data.elapsedMs)
                  }
                }
        },
        terminate: () => inner.terminate()
      }
      return tee
    })
  }

  /** Fan one match-clock instant out to every feed and driver. */
  function advanceTo(matchNowMs: number): void {
    for (const feed of feeds) feed.pump(matchNowMs)
    for (const ghost of ghosts.value) ghost.driver.advance(matchNowMs)
  }

  /**
   * rAF-driven advance: derives the match clock from the anchor. Arms the
   * anchor on the first non-idle frame (±one frame of the true start; timer
   * ticks correct it exactly in time mode).
   */
  function advance(): void {
    if (!active.value || !local) return
    if (anchorPerf === null) {
      if (local.phase === 'idle') return
      anchorPerf = performance.now()
    }
    advanceTo(performance.now() - anchorPerf)
  }

  function leaveMatch(): void {
    if (!active.value && local === null) return
    active.value = false
    ghosts.value = []
    feeds = []
    anchorPerf = null
    local = null
    releaseGameStore(MATCH_LOCAL_STORE_ID)
  }

  return {
    ghosts,
    active,
    localStore,
    createMatch,
    attachLocalTimer,
    advance,
    advanceTo,
    leaveMatch
  }
})
