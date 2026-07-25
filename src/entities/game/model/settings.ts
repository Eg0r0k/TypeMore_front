/**
 * The boundary where saved app settings become the core's immutable snapshots.
 *
 * Kept pure and in one place: given the app-config subset that reaches the core,
 * produce the `CoreConfig` (reducer snapshot) and `GenerationConfig` (seed
 * context). Changing a setting means calling `store.setup` with a fresh result —
 * a new `GameCore` — never mutating a live config. See the invariant on
 * `GenerationConfig`.
 */
import {
  type CoreConfig,
  type Difficulty,
  type GenerationConfig,
  type GenerationMode,
  CODE_MAX_EXTRA_CHARS,
  DEFAULT_MAX_EXTRA_CHARS
} from '@shared/core'

/** The saved-config subset that influences the core. `blind` is deliberately absent — it is view-only. */
export interface GameSettings {
  readonly mode: GenerationMode
  /** Test duration in seconds (timed mode). */
  readonly time: number
  /** Target word count (word-count mode). */
  readonly words: number
  // Generation (→ seed context).
  readonly punctuation: boolean
  readonly numbers: boolean
  readonly randomCase: boolean
  /** Reverse mod: mirror every generated word. */
  readonly reverse: boolean
  // Reducer snapshot (→ CoreConfig).
  readonly nospace: boolean
  readonly difficulty: Difficulty
  /** MinSpeed floor in net WPM (0 = off). */
  readonly minWpm: number
  /*
   * Input behaviour. Optional here and in `CoreConfig`: every one defaults to the
   * pre-existing behaviour, so older callers (match / room / tests) keep compiling
   * and older run snapshots keep replaying identically.
   */
  /** Backspace into already-committed words, even correct ones. */
  readonly freedomMode?: boolean
  /** `letter` refuses a wrong keystroke; `word` refuses the commit until the word is correct. */
  readonly stopOnError?: CoreConfig['stopOnError']
  /** Count modes: finish on the last word's final character, correct or not. */
  readonly quickEnd?: boolean
  /**
   * Emit dictionary tokens verbatim (code dictionaries: they carry their own
   * case, punctuation and `\t`/`\n` layout). Not a user setting — it will come
   * from the dictionary's metadata; there is no toggle in the settings bar.
   */
  readonly rawTokens?: boolean
}

export interface CoreSetup {
  readonly coreConfig: CoreConfig
  readonly generation: GenerationConfig
}

export function toCoreSetup(settings: GameSettings): CoreSetup {
  const {
    mode,
    time,
    words,
    punctuation,
    numbers,
    randomCase,
    reverse,
    nospace,
    difficulty,
    minWpm,
    freedomMode,
    stopOnError,
    quickEnd,
    rawTokens
  } = settings
  return {
    coreConfig: {
      mode,
      durationMs: time * 1000,
      maxExtraChars: rawTokens === true ? CODE_MAX_EXTRA_CHARS : DEFAULT_MAX_EXTRA_CHARS,
      difficulty,
      nospace,
      minWpm,
      freedomMode,
      stopOnError,
      quickEnd
    },
    generation: {
      mode,
      length: mode === 'time' ? time : words,
      punctuation,
      numbers,
      randomCase,
      reverse,
      rawTokens
    }
  }
}
