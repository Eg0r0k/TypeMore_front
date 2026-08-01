/**
 * IME event sequences — the spec the input adapter's composition handling is
 * written against, and the fixtures its unit tests replay.
 *
 * PROVENANCE — READ BEFORE TRUSTING A ROW. These sequences are DERIVED, not
 * captured: they are written from the UI Events spec (`beforeinput` input types,
 * the composition event order) plus the behaviour monkeytype's own listeners
 * document having observed on real devices (`input/listeners/composition.ts`,
 * `input/listeners/input.ts:65-72` — the Firefox stray event, the quick-end
 * dispatch). No Android device was attached when they were written.
 *
 * That matters for exactly one thing: if a real capture disagrees with a row
 * here, the CAPTURE WINS and the row is edited. They are laid out as data for
 * that reason — replacing a sequence is a data edit, not a test rewrite.
 *
 * The invariants they encode, which a capture is unlikely to overturn:
 *  - a composition session is `compositionstart` → `compositionupdate`* →
 *    `compositionend`, and `compositionend.data` is the FINAL text;
 *  - inside a session, `beforeinput` carries `insertCompositionText` with
 *    `isComposing === true`, and `preventDefault()` on it is ignored;
 *  - `compositionupdate.data` is the whole composed string so far, not a delta;
 *  - Android drives plain latin through composition too — which is why the
 *    mobile suggestion bug and CJK input are one problem, not two.
 */

/** One event in a sequence. `beforeinput` steps are dispatched as `InputEvent`. */
export type ImeStep =
  | { readonly kind: 'compositionstart'; readonly data?: string }
  | { readonly kind: 'compositionupdate'; readonly data: string }
  | { readonly kind: 'compositionend'; readonly data: string }
  | {
      readonly kind: 'beforeinput'
      readonly inputType: string
      readonly data: string | null
      readonly isComposing?: boolean
    }
  | { readonly kind: 'keydown'; readonly key: string; readonly code?: string }

export interface ImeSequence {
  readonly id: string
  /** What a player did, in words. */
  readonly description: string
  readonly steps: readonly ImeStep[]
}

/** `beforeinput` + its composition event, the pair that arrives per update. */
const update = (data: string): readonly ImeStep[] => [
  { kind: 'beforeinput', inputType: 'insertCompositionText', data, isComposing: true },
  { kind: 'compositionupdate', data }
]

/**
 * Korean: one syllable is three keystrokes assembled by the IME. 한 = ㅎ + ㅏ + ㄴ,
 * and the intermediate forms are themselves valid syllables (하), so every update
 * carries a complete string rather than a delta.
 */
export const KOREAN_SYLLABLE: ImeSequence = {
  id: 'korean-syllable',
  description: 'Korean 한 — ㅎ → 하 → 한, committed on compositionend',
  steps: [
    { kind: 'compositionstart', data: '' },
    ...update('ㅎ'),
    ...update('하'),
    ...update('한'),
    { kind: 'compositionend', data: '한' }
  ]
}

/**
 * Japanese: romaji → kana → kanji. The candidate swap replaces the WHOLE composed
 * string, which is why an adapter must never diff consecutive updates.
 */
export const JAPANESE_KANJI: ImeSequence = {
  id: 'japanese-kanji',
  description: 'Japanese 家 — romaji "ie" → kana いえ → kanji candidate 家',
  steps: [
    { kind: 'compositionstart', data: '' },
    ...update('i'),
    ...update('いえ'),
    ...update('家'),
    { kind: 'compositionend', data: '家' }
  ]
}

/** Chinese pinyin: the latin buffer is replaced wholesale by the chosen hanzi. */
export const CHINESE_PINYIN: ImeSequence = {
  id: 'chinese-pinyin',
  description: 'Chinese 房子 — pinyin "fangzi" then candidate selection',
  steps: [
    { kind: 'compositionstart', data: '' },
    ...update('f'),
    ...update('fang'),
    ...update('fangzi'),
    ...update('房子'),
    { kind: 'compositionend', data: '房子' }
  ]
}

/**
 * A cancelled composition (Escape, or the candidate window dismissed): the
 * session ends with EMPTY data and nothing was typed.
 */
export const COMPOSITION_CANCELLED: ImeSequence = {
  id: 'composition-cancelled',
  description: 'Composition abandoned — compositionend with empty data',
  steps: [
    { kind: 'compositionstart', data: '' },
    ...update('ㅎ'),
    ...update('하'),
    { kind: 'compositionend', data: '' }
  ]
}

/**
 * THE MOBILE BUG. Android runs plain latin through composition, and a tap on a
 * keyboard suggestion ends the session with the whole word plus a trailing
 * space — the space that used to be left behind in the textarea as an
 * "invisible character".
 */
export const ANDROID_SUGGESTION: ImeSequence = {
  id: 'android-suggestion',
  description: 'Android latin — "hel" typed, suggestion tapped, commits "hello "',
  steps: [
    { kind: 'compositionstart', data: '' },
    ...update('h'),
    ...update('he'),
    ...update('hel'),
    { kind: 'compositionend', data: 'hello ' }
  ]
}

/** Android character-by-character with no suggestion: still a composition session. */
export const ANDROID_LATIN_PLAIN: ImeSequence = {
  id: 'android-latin-plain',
  description: 'Android latin typed out, no suggestion — session ends on the space key',
  steps: [
    { kind: 'compositionstart', data: '' },
    ...update('h'),
    ...update('hi'),
    { kind: 'compositionend', data: 'hi' }
  ]
}

/**
 * Autocorrect OUTSIDE a composition session: the browser reports the whole
 * replacement as one `insertReplacementText`.
 */
export const AUTOCORRECT_REPLACEMENT: ImeSequence = {
  id: 'autocorrect-replacement',
  description: 'Autocorrect rewrites the word — insertReplacementText, no composition',
  steps: [{ kind: 'beforeinput', inputType: 'insertReplacementText', data: 'hello' }]
}

/**
 * Firefox fires one extra `insertCompositionText` with `isComposing === false`
 * after the session is over. It is the ONE composition-typed event that must be
 * cancelled — monkeytype cancels it by exactly this test (`input.ts:65-72`).
 */
export const FIREFOX_STRAY: ImeSequence = {
  id: 'firefox-stray',
  description: 'Firefox trailing insertCompositionText with isComposing false',
  steps: [
    { kind: 'compositionstart', data: '' },
    ...update('ㅎ'),
    { kind: 'compositionend', data: '하' },
    { kind: 'beforeinput', inputType: 'insertCompositionText', data: '하', isComposing: false }
  ]
}

export const IME_SEQUENCES: readonly ImeSequence[] = [
  KOREAN_SYLLABLE,
  JAPANESE_KANJI,
  CHINESE_PINYIN,
  COMPOSITION_CANCELLED,
  ANDROID_SUGGESTION,
  ANDROID_LATIN_PLAIN,
  AUTOCORRECT_REPLACEMENT,
  FIREFOX_STRAY
]
