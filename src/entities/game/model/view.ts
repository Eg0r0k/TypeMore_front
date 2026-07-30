/**
 * GameView — the narrow, readonly contract between a game and its renderer.
 *
 * `GameField` (widgets/test) and its child composables read EXACTLY this:
 * the state snapshot (typed buffers, phase, indices — caret position and
 * extra characters are derived from it), the target words, the active word
 * index, a finished flag, and the view-only `blind` toggle. Anything that
 * satisfies this shape renders — the local Pinia store (via `toGameSession`),
 * a `GhostDriver`'s view-model, or a plain reactive object in a test.
 *
 * Placed in entities/game (not shared/core) deliberately: `blind` is app
 * config, explicitly OUTSIDE the core per the slot invariant
 * (docs/game-architecture.md — view-only slot), and the consumers are the
 * widget layer, which already depends on this entity.
 */
import type { GameState } from '@typemore/core'

export interface GameView {
  /** Immutable reducer snapshot: typed buffers, phase, indices. */
  readonly snapshot: GameState
  /** Target words (immutable for the run). */
  readonly words: readonly string[]
  /** Active word index (== snapshot.wordIndex, hoisted for direct binding). */
  readonly wordIndex: number
  /** True once the run reached its end (committed out or deadline settled). */
  readonly finished: boolean
  /** View-only correctness masking. Ghost views hardcode `false`. */
  readonly blind: boolean
}

/** The write half: what the input adapter (features/test/input) dispatches. */
export interface GameInputSink {
  insert(text: string): void
  replace(from: number, to: number, text: string, source: 'ime' | 'paste'): void
  deleteBackward(unit?: 'char' | 'word'): void
  commit(): void
  /**
   * Log v2 keystroke telemetry (physical `KeyboardEvent.code`). Optional: a
   * sink without capture support (ghosts, replay views, older fixtures) simply
   * records nothing, and the adapter calls them with `?.` — a run on such a
   * sink is a v1 run.
   */
  keyDown?(code: string): void
  keyUp?(code: string): void
}

/** A playable game: readable by the field AND writable by the input adapter. */
export type GameSession = GameView & GameInputSink

interface GameSessionSource extends GameInputSink {
  readonly snapshot: GameState
  readonly words: readonly string[]
  readonly wordIndex: number
  readonly phase: 'idle' | 'running' | 'finished'
}

/**
 * Adapt the local player's game store to a `GameSession`. Getters delegate to
 * the reactive store, so bindings track; `blind` is supplied by the caller
 * (the home page reads the config store — the field itself never does).
 */
export function toGameSession(store: GameSessionSource, isBlind: () => boolean): GameSession {
  return {
    get snapshot() {
      return store.snapshot
    },
    get words() {
      return store.words
    },
    get wordIndex() {
      return store.wordIndex
    },
    get finished() {
      return store.phase === 'finished'
    },
    get blind() {
      return isBlind()
    },
    insert: (text) => store.insert(text),
    replace: (from, to, text, source) => store.replace(from, to, text, source),
    deleteBackward: (unit) => store.deleteBackward(unit),
    commit: () => store.commit(),
    keyDown: (code) => store.keyDown?.(code),
    keyUp: (code) => store.keyUp?.(code)
  }
}

/**
 * Re-project a read-only view under a caller-supplied `blind`.
 *
 * The replay player needs it: a `GhostDriver`'s view hardcodes `blind: false`
 * (a live opponent is never rendered blind), but a replay must render the RUN's
 * own declared mods. `isBlind` is a getter so the caller can gate it on a
 * toggle; the source view stays untouched, and no config store is involved on
 * either side of the seam.
 */
export function withBlind(source: GameView, isBlind: () => boolean): GameView {
  return {
    get snapshot() {
      return source.snapshot
    },
    get words() {
      return source.words
    },
    get wordIndex() {
      return source.wordIndex
    },
    get finished() {
      return source.finished
    },
    get blind() {
      return isBlind()
    }
  }
}
