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
  type GenerationTextSource,
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
  /**
   * Where the targets come from. Absent (or `{kind:'seeded'}`) is the seeded
   * dictionary run; the quote arm carries the already-resolved text, which the
   * page fetched from `/quotes/random`. Not a saved setting — it is drawn per
   * run, so it arrives here beside the saved ones rather than living in them.
   */
  readonly textSource?: GenerationTextSource
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
    rawTokens,
    textSource
  } = settings
  // A quote has no length target — the run ends on the last committed word of
  // the text itself, so there is no magnitude to carry and none is invented
  // (see `targetCount` in words.ts).
  const seededLength = mode === 'time' ? time : words
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
      length: textSource?.kind === 'quote' ? 0 : seededLength,
      punctuation,
      numbers,
      randomCase,
      reverse,
      rawTokens,
      textSource
    }
  }
}
