/**
 * Game store — a thin Pinia wrapper over a `GameCore` instance.
 *
 * The store holds NO game rules: every "is this allowed / what happened" question
 * is answered by the pure reducer. The store only:
 *   - owns one `GameCore` (config snapshot + generated words),
 *   - stamps DOM-driven interactions into events and dispatches them,
 *   - mirrors the resulting immutable state + derived metrics reactively,
 *   - forwards authoritative timer ticks into the core,
 *   - owns the timer worker's lifecycle: the worker is created by `attachTimer`
 *     and lives until `detachTimer` / store disposal — never tied to the scope
 *     of whichever component happened to call attach.
 *
 * It is a FACTORY parameterized by `id`, so N independent games coexist (the
 * local player + up to four ghost opponents) with zero shared state — see the
 * isolation test. Nothing here is a module singleton.
 *
 * TIME ANCHOR (Phase 3 requirement): under the default `startPolicy: 'input'`,
 * `t = 0` is the instant of the first event. The anchor (`performance.now()`) is
 * captured synchronously inside `stamp`, the single function every event flows
 * through, on the first stamp — the same call that also starts the timer worker.
 * All later events are offsets from that one anchor. Conversion to `Ms` lives
 * here and nowhere else.
 *
 * MATCH ANCHOR: a `startPolicy: 'go'` run (match) does NOT start lazily — the
 * caller MUST call `start(atPerf)` at the server's go instant. That call pins the
 * stamp anchor and starts the timer, so the run settles at its deadline even if
 * the player never types a single character. Solo is untouched: without a
 * `start()` the lazy path is exactly as before.
 */
import { defineStore, getActivePinia } from 'pinia'
import { computed, onScopeDispose, shallowRef } from 'vue'

import {
  type AfkStats,
  type CoreConfig,
  type GameState,
  type Metrics,
  type Ms,
  type ErrorWord,
  type TimelinePoint,
  type GameEvent,
  type ScoreResult,
  type ScoreState,
  type GenerationConfig,
  type ModsDeclaration,
  type ActiveMod,
  type Grade,
  GameCore,
  activeModsV1,
  commitEvent,
  comboMultiplier,
  deleteEvent,
  finalizeScoreV2,
  gradeOf,
  afkStatsOf,
  initialScoreState,
  initialState,
  insertEvent,
  metricsOf,
  modMultiplierV1,
  errorWordsOf,
  scoreStep,
  timelineOf,
  replaceEvent
} from '@shared/core'
import { type GameTimer, type TimerWorkerLike, useGameTimer } from '@shared/lib/hooks/useGameTimer'

export interface GameSetup {
  readonly config: CoreConfig
  readonly words: readonly string[]
  /** Generation config — verifiable-mod half of the multiplier. Optional: ghosts/replay omit it (no scoring). */
  readonly generation?: GenerationConfig
  /** Declared view-only mods (blind/fading/flashlight) — trusted half. Optional; defaults to none. */
  readonly declaration?: ModsDeclaration
}

/**
 * A finished run's replayable material — everything a replay needs to render the
 * run AS PLAYED, with zero reference to whatever the viewer has configured now:
 * the reducer snapshot, the target words, the full event log, BOTH mod halves
 * (the generation config and the declared view-only mods), and the run's result.
 */
export interface ReplayData {
  readonly config: CoreConfig
  readonly words: readonly string[]
  readonly log: readonly GameEvent[]
  /** Generation config the words came from — the verifiable-mod half. */
  readonly generation: GenerationConfig
  /** Declared view-only mods (blind/fading/flashlight) the run was played under. */
  readonly declaration: ModsDeclaration
  /** The run's finalized score: total, mod multiplier and formula version. */
  readonly score: ScoreResult
  /** Letter grade of the run's accuracy (`gradeOf`). */
  readonly grade: Grade
}

const ZERO_METRICS: Metrics = {
  wpm: 0,
  raw: 0,
  accuracy: 0,
  consistency: 0,
  chars: { correct: 0, incorrect: 0, extra: 0, missed: 0 },
  spaces: 0,
  durationSec: 0
}

const ZERO_AFK: AfkStats = { afkMs: 0, buckets: 0 }

/** Fallbacks for a setup that declared neither half (ghosts, tests): no mods, ×1. */
const NO_GENERATION: GenerationConfig = {
  mode: 'time',
  length: 0,
  punctuation: false,
  numbers: false,
  randomCase: false,
  reverse: false
}
const NO_DECLARATION: ModsDeclaration = { blind: false, fading: false, flashlight: false }

/**
 * Timer duration for a non-timed run that still needs a per-second cadence. Every
 * word/free run uses it so the live wpm/raw DECAY with elapsed time (metrics are
 * measured to the tick `nowMs`, so they fall while the player is idle — matching
 * monkeytype's per-second live speed); a MinSpeed run additionally surfaces a
 * floor breach when typing stops. The worker ticks each second; the store stops
 * it the moment the core finishes. Large enough to outlast any real run.
 */
const UNBOUNDED_TIMER_MS = 86_400_000

function createGameStore(storeId: string) {
  return defineStore(`game:${storeId}`, () => {
    // Private, non-reactive engine + producer state.
    let core: GameCore | null = null
    let timer: GameTimer | null = null
    let anchorPerf: number | null = null
    let seq = 0
    // Live scoring accumulator (scoreV1). Mutated in place per event (O(1)); the
    // reactive projections below are refreshed from it after each dispatch.
    let scoreState: ScoreState = initialScoreState()
    // The setup halves the core does NOT hold: the generation config the words
    // came from and the declared view-only mods. Retained so `getReplayData`
    // hands a replay the run's own setup instead of the viewer's live config.
    let setupGeneration: GenerationConfig = NO_GENERATION
    let setupDeclaration: ModsDeclaration = NO_DECLARATION

    // Reactive projections consumed by the view.
    const snapshot = shallowRef<GameState>(initialState())
    const words = shallowRef<readonly string[]>([])
    const liveNow = shallowRef<Ms>(0 as Ms)
    // scoreV1 live projections: base combo points, current streak, its peak.
    const scoreBase = shallowRef(0)
    const combo = shallowRef(0)
    const comboPeak = shallowRef(0)
    // scoreV2 mod layer: the combined multiplier + active-mod breakdown, both
    // computed ONCE at setup (a run's mods cannot change mid-run) and read by the
    // HUD chip and the results screen.
    const modMultiplier = shallowRef(1)
    const activeMods = shallowRef<readonly ActiveMod[]>([])

    const phase = computed(() => snapshot.value.phase)
    const wordIndex = computed(() => snapshot.value.wordIndex)
    const metrics = computed<Metrics>(() => {
      // Touch reactive deps, then recompute purely from the log.
      const state = snapshot.value
      const now = liveNow.value
      if (!core) return ZERO_METRICS
      return metricsOf(core, state.finishedAt ?? now)
    })
    const timeline = computed<TimelinePoint[]>(() => {
      const state = snapshot.value
      if (!core) return []
      return timelineOf(core, state.finishedAt ?? liveNow.value)
    })
    const errorWords = computed<ErrorWord[]>(() => {
      if (snapshot.value.phase !== 'finished') return []
      return core ? errorWordsOf(core) : []
    })
    /** AFK time of the run so far — log-derived, measured to the same instant as `metrics`. */
    const afk = computed<AfkStats>(() => {
      const state = snapshot.value
      const now = liveNow.value
      if (!core) return ZERO_AFK
      return afkStatsOf(core, state.finishedAt ?? now)
    })
    // scoreV1 HUD/results projections. `combo`/`comboMultiplierValue`/`scoreBase`
    // are the live number; `scoreResult` is the finalized total (acc²/timeBonus).
    const comboMultiplierValue = computed(() => comboMultiplier(combo.value))
    const scoreResult = computed<ScoreResult | null>(() =>
      core
        ? finalizeScoreV2(
            scoreBase.value,
            comboPeak.value,
            metrics.value,
            core.config.mode,
            modMultiplier.value
          )
        : null
    )

    /**
     * The single stamping point. Captures the anchor synchronously on the first
     * event, converts `performance.now()` into the event `Ms` timebase, and
     * assigns the monotonic `seq`. Returns raw numbers; the event constructor brands them.
     */
    function stamp(): { seq: number; t: number } {
      const perfNow = performance.now()
      if (anchorPerf === null) anchorPerf = perfNow
      seq += 1
      // Integer ms on the wire: no metric depends on sub-ms precision, and
      // full-precision floats inflate serialized events by ~30%.
      return { seq, t: Math.round(perfNow - anchorPerf) }
    }

    function applyResult(next: GameState, startedThisEvent: boolean, nowMs: number): void {
      snapshot.value = next
      // Live clock tracks the current keystroke's elapsed `t` (or the pinned finish
      // instant at completion), so live wpm/raw advance per keystroke instead of
      // staying frozen at startedAt (a zero-length window → 0 wpm/raw).
      liveNow.value = next.finishedAt ?? (nowMs as Ms)
      if (startedThisEvent && core) {
        // Cadence timer on the first event in EVERY mode: timed runs tick to their
        // deadline; all others tick unbounded so live wpm/raw decay with elapsed
        // time and any MinSpeed floor breach surfaces even when the player stops.
        timer?.start(core.config.mode === 'time' ? core.config.durationMs : UNBOUNDED_TIMER_MS)
      }
      if (next.phase === 'finished') timer?.stop()
    }

    /** Fold one accepted event into the live scoreV1 accumulator (O(1) per event). */
    function advanceScore(event: GameEvent): void {
      if (!core) return
      scoreStep(scoreState, event, { config: core.config, words: core.words })
      scoreBase.value = scoreState.base
      combo.value = scoreState.streak
      comboPeak.value = scoreState.comboPeak
    }

    function resetScore(): void {
      scoreState = initialScoreState()
      scoreBase.value = 0
      combo.value = 0
      comboPeak.value = 0
    }

    /**
     * Load a fresh game: config snapshot + generated target words. An `'input'`
     * run starts lazily on the first keystroke; a `'go'` run is already running
     * (see the MATCH ANCHOR note) and waits for `start()` to pin its clock.
     */
    function setup(game: GameSetup): void {
      core = new GameCore({ config: game.config, words: game.words })
      words.value = core.words
      snapshot.value = core.state
      anchorPerf = null
      seq = 0
      liveNow.value = 0 as Ms
      timer?.reset()
      resetScore()
      setupGeneration = game.generation ?? { ...NO_GENERATION, mode: game.config.mode }
      setupDeclaration = game.declaration ?? NO_DECLARATION
      const modSetup = { generation: setupGeneration, config: game.config }
      modMultiplier.value = modMultiplierV1(modSetup, setupDeclaration)
      activeMods.value = activeModsV1(modSetup, setupDeclaration)
    }

    /**
     * Re-declare the view-only mods (blind/fading/flashlight) of the LOADED run.
     *
     * They are not core-bound — toggling one neither regenerates words nor
     * restarts the run — but they ARE scored (SCORING_CONCEPT.md §2), so the
     * multiplier has to follow the toggles while the player is still setting the
     * run up. Once the first keystroke has landed the declaration is frozen: a
     * run is scored under the mods it was played with, never the ones the config
     * happens to hold at the end (that also keeps a finished run's breakdown from
     * moving under the results screen).
     */
    function setDeclaration(declaration: ModsDeclaration): void {
      if (!core || snapshot.value.phase !== 'idle') return
      setupDeclaration = declaration
      const modSetup = { generation: setupGeneration, config: core.config }
      modMultiplier.value = modMultiplierV1(modSetup, declaration)
      activeMods.value = activeModsV1(modSetup, declaration)
    }
    function reset(): void {
      if (!core) return
      core.reset()
      snapshot.value = core.state
      anchorPerf = null
      seq = 0
      liveNow.value = 0 as Ms
      timer?.reset()
      resetScore()
    }

    /**
     * Start a `startPolicy: 'go'` run at the match's go instant: pin the stamp
     * anchor (so every event `t` is an offset from GO, not from the first
     * keystroke) and start the authoritative timer. The core is already
     * `running` from `t = 0` under that policy, so the deadline settles on the
     * timer tick with an empty log — a player who never types still finishes.
     * A no-op for the default lazy policy, which owns its own anchor in `stamp`.
     */
    function start(atPerf: number = performance.now()): void {
      if (!core || core.config.startPolicy !== 'go') return
      anchorPerf = atPerf
      snapshot.value = core.state
      liveNow.value = 0 as Ms
      timer?.start(core.config.mode === 'time' ? core.config.durationMs : UNBOUNDED_TIMER_MS)
    }

    function insert(text: string): void {
      if (!core) return
      const wasIdle = core.state.phase === 'idle'
      const { seq: s, t } = stamp()
      const event = insertEvent(s, t, text)
      const result = core.dispatch(event)
      if (result.isOk()) {
        advanceScore(event)
        applyResult(result.value, wasIdle && result.value.phase === 'running', t)
      } else {
        // Rejected events never enter the log, so their seq must be returned:
        // the accepted log stays contiguous (validateLog structural rule #1,
        // and the peers' desync detector reads the same invariant).
        seq -= 1
      }
    }

    function replace(from: number, to: number, text: string, source: 'ime' | 'paste'): void {
      if (!core) return
      const wasIdle = core.state.phase === 'idle'
      const { seq: s, t } = stamp()
      const event = replaceEvent(s, t, from, to, text, source)
      const result = core.dispatch(event)
      if (result.isOk()) {
        advanceScore(event)
        applyResult(result.value, wasIdle && result.value.phase === 'running', t)
      } else {
        seq -= 1 // see insert(): rejected events return their seq
      }
    }

    function deleteBackward(unit: 'char' | 'word' = 'char'): void {
      if (!core) return
      const { seq: s, t } = stamp()
      const event = deleteEvent(s, t, unit)
      const result = core.dispatch(event)
      if (result.isOk()) {
        advanceScore(event)
        applyResult(result.value, false, t)
      } else {
        seq -= 1 // see insert(): rejected events return their seq
      }
    }

    function commit(): void {
      if (!core) return
      const { seq: s, t } = stamp()
      const event = commitEvent(s, t)
      const result = core.dispatch(event)
      if (result.isOk()) {
        advanceScore(event)
        applyResult(result.value, false, t)
      } else {
        seq -= 1 // see insert(): rejected events return their seq
      }
    }

    /** Render an externally-produced state (the replay scheduler drives this). */
    function setState(state: GameState): void {
      snapshot.value = state
    }

    /**
     * Snapshot the current run for replay: the core's config + words + log, plus
     * the setup halves and result the core does not carry. A replay player is
     * driven ENTIRELY by this — it never reads the viewer's config store.
     */
    function getReplayData(): ReplayData | null {
      if (!core) return null
      const score = scoreResult.value
      if (!score) return null
      return {
        config: core.config,
        words: core.words,
        log: core.events,
        generation: setupGeneration,
        declaration: setupDeclaration,
        score,
        grade: gradeOf(metrics.value.accuracy)
      }
    }

    /**
     * Install the authoritative timer. Injected (not imported) so the store stays
     * free of the `?worker` build transform and testable without a real worker.
     * Idempotent; ticks feed straight into the core.
     */
    function attachTimer(createWorker: () => TimerWorkerLike): void {
      if (timer) return
      timer = useGameTimer(createWorker)
      timer.onTick((nowMs) => {
        if (!core) return
        core.tick(nowMs)
        snapshot.value = core.state
        liveNow.value = nowMs
        if (core.state.phase === 'finished') timer?.stop()
      })
    }

    /** Terminate the worker and forget the timer, so a later `attachTimer` works. */
    function detachTimer(): void {
      timer?.dispose()
      timer = null
    }

    // The STORE owns the worker: registered here (inside the store's own effect
    // scope), so `$dispose` / `releaseGameStore` terminates it. Component unmount
    // never does — see useGameTimer's ownership note.
    onScopeDispose(() => detachTimer())

    return {
      snapshot,
      words,
      phase,
      wordIndex,
      metrics,
      timeline,
      errorWords,
      score: scoreBase,
      combo,
      comboMultiplier: comboMultiplierValue,
      comboPeak,
      scoreResult,
      modMultiplier,
      activeMods,
      afk,
      setup,
      setDeclaration,
      reset,
      start,
      insert,
      replace,
      deleteBackward,
      commit,
      setState,
      getReplayData,
      attachTimer,
      detachTimer
    }
  })
}

const registry = new Map<string, ReturnType<typeof createGameStore>>()

/**
 * Resolve (or create) the game store for `id`. Distinct ids are fully independent
 * Pinia stores over independent `GameCore` instances.
 */
export function useGameStore(id = 'local') {
  let definition = registry.get(id)
  if (!definition) {
    definition = createGameStore(id)
    registry.set(id, definition)
  }
  return definition()
}

/**
 * Dispose and forget the store for `id`: terminates its timer worker, stops the
 * store's effect scope, clears its state from the active Pinia, and removes the
 * cached definition so a later `useGameStore(id)` starts fresh. Match flows that
 * create ghost stores per game call this on teardown; without it the registry
 * only grows.
 */
export function releaseGameStore(id: string): void {
  const definition = registry.get(id)
  if (!definition) return
  const store = definition()
  store.detachTimer()
  store.$dispose()
  const pinia = getActivePinia()
  if (pinia) delete pinia.state.value[`game:${id}`]
  registry.delete(id)
}

/** The game store instance type — the named contract consumers import. */
export type GameStore = ReturnType<typeof useGameStore>
