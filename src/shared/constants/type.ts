import type { UiLanguage } from '@/shared/lib/i18n/locale'
import type { Difficulty } from '@shared/core'

/** Input: how hard the test stops you on a mistake. */
export type StopOnError = 'off' | 'word' | 'letter'
/** Caret: interpolation speed between letters (`off` = instant jumps). */
export type SmoothCaret = 'off' | 'slow' | 'medium' | 'fast'
/** Caret: shape drawn at the typing position (`off` = no caret). */
export type CaretStyle = 'off' | 'default' | 'block' | 'outline' | 'underline'
/** Custom background: how the image is fitted to the viewport. */
export type BackgroundSize = 'cover' | 'contain' | 'max'
/**
 * Pace caret: the bot the ghost caret paces the run against. `pb`/`last`/`avg`
 * resolve against the SERVER profile (signed-in only); `custom` runs at
 * `paceCaretWpm`. A record race (entities/race) overrides whatever is here for
 * the duration of the race.
 */
export type PaceCaretMode = 'off' | 'pb' | 'last' | 'avg' | 'custom'
/**
 * Quote mode: which length band to draw from. `all` is the absence of a filter
 * — it OMITS the `group` query parameter rather than sending a sixth value the
 * server would reject with a 400 (see the backend's `docs/QUOTES.md`).
 */
export type QuoteGroup = 'all' | 'short' | 'medium' | 'long' | 'thicc'

export interface Config {
  words: number
  devTools: boolean
  time: number
  /** Dictionary language for the test text (NOT the interface language). */
  language: string
  /** Interface locale; `system` follows the browser. */
  uiLanguage: UiLanguage
  /** Active colour theme name (see `shared/api/themes`). */
  theme: string
  mode: ConfigModes
  /** Custom background: remote image URL ('' = none). */
  backgroundImg: string
  /** Custom background: local image as a data URL ('' = none). Wins over the URL. */
  backgroundLocal: string
  /** Custom background: fitting mode. */
  backgroundSize: BackgroundSize
  showFps: boolean
  playSound: boolean
  showKeyboard: boolean
  soundVolume: number
  soundSet: string
  fontSize: number
  fontFamily: string
  // Game options threaded to the core (see toCoreSetup). `blind` is view-only.
  punctuation: boolean
  numbers: boolean
  randomCase: boolean
  nospace: boolean
  difficulty: Difficulty
  /** Reverse mod (generation): mirror every word. Core-bound — rebuilds on change. */
  reverse: boolean
  /** Quote mode: length band the random draw is filtered to. Core-bound. */
  quoteGroup: QuoteGroup
  /** MinSpeed floor in net WPM (0 = off). Core-bound — rebuilds on change. */
  minWpm: number
  // View-only mods (never in core/log; applied live).
  blind: boolean
  /** Fading mod: the active word melts over FADE_MS. */
  fading: boolean
  /** Flashlight mod: only the active word ± neighbours is visible. */
  flashlight: boolean
  // Input behaviour — core-bound (see toCoreSetup), rebuilds the run on change.
  /** Backspace into already-committed words, even correct ones. */
  freedomMode: boolean
  /** `letter` rejects a wrong keystroke; `word` blocks the advance until the word is correct. */
  stopOnError: StopOnError
  /** Words mode: finish on the last word even if it is wrong (no trailing space needed). */
  quickEnd: boolean
  // Caret (view-only).
  smoothCaret: SmoothCaret
  caretStyle: CaretStyle
  // Pace caret (view-only: a ghost caret racing the field, never in core/log).
  paceCaret: PaceCaretMode
  /** Custom pace speed in wpm; read only when `paceCaret` is `custom`. */
  paceCaretWpm: number
}

export enum ConfigModes {
  Words = 'words',
  Free = 'free',
  Time = 'time',
  Quote = 'quote',
  Custom = 'custom'
}
