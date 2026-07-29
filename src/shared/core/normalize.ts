/**
 * Input normalization — visually-equivalent characters.
 *
 * The behaviour is monkeytype's (`utils/strings.ts` `areCharactersVisuallyEqual`
 * + `input/helpers/util.ts` `normalizeData`): when the typed grapheme and the
 * expected one are visually the same character — a straight apostrophe against
 * a typographic one, `-` against `—`, `е` against `ё` in Russian — the INPUT
 * ADAPTER stores the expected character instead of the typed one. Everything
 * downstream then compares with plain `===`.
 *
 * The design is NOT monkeytype's. There the knowledge is spread over a flat
 * array of sets, a separate per-language record, and a hardcoded space branch.
 * Here every rule is one entry in ONE registry (`EQUIVALENCE_GROUPS`), and each
 * entry is a plain object: the characters, optionally the dictionary languages
 * it applies to, optionally a canonical fallback. Extending = appending an
 * entry; nothing else changes. `makeNormalizer` compiles any registry into the
 * two per-keystroke functions, so a custom rule set (tests, future per-language
 * packs) is the same one-liner.
 *
 * WHY THIS TOUCHES NO ENGINE CODE: the event-log invariant (events.ts) is that
 * normalization happens BEFORE an event exists — the stored text is final, and
 * correctness is derived from (text, target, position) by reducer, metrics and
 * the server validator alike. Normalizing in the adapter therefore changes what
 * is WRITTEN, never how anything is judged: core, wire protocol and server stay
 * byte-for-byte as they are.
 */

/** One equivalence rule: every character in the group types as any other. */
export interface EquivalenceGroup {
  /** Stable id, for tests and docs ('dashes', 'ru-yo', …). */
  readonly id: string
  /** The characters that count as the same letter. */
  readonly chars: readonly string[]
  /**
   * Dictionary-language names this group applies to. A name matches the exact
   * language or a sized variant ('russian' covers 'russian_1k'). Absent ⇒ the
   * group applies everywhere.
   */
  readonly languages?: readonly string[]
  /**
   * Fallback: when the expected character is outside the group (or unknown),
   * a typed member becomes this instead of staying as-is. Spaces use it —
   * an IME's U+3000 must become the plain separator even mid-word.
   */
  readonly canonical?: string
}

/**
 * Directly-typable space variants (monkeytype's SPACE_CODE_POINTS): what an
 * IME or an Option+Space produces where the log wants U+0020.
 */
const SPACE_CHARS = [
  '\u0020', // regular space
  '\u00a0', // no-break space
  '\u1680', // ogham space mark
  '\u2002', // en space
  '\u2003', // em space
  '\u2004', // three-per-em space
  '\u2007', // figure space
  '\u2008', // punctuation space
  '\u2009', // thin space
  '\u200a', // hair space
  '\u200b', // zero width space
  '\u202f', // narrow no-break space
  '\u3000', // ideographic space (CJK IME)
  '\ufeff' // zero width no-break space
] as const

/**
 * The default registry. To add a rule, append an entry — e.g. a new language
 * pack `{ id: 'de-eszett', chars: ['ß', 'ss'], languages: ['german'] }` is the
 * entire change. (Multi-char members like 'ss' are NOT supported yet: the
 * adapter normalizes one grapheme at a time.)
 */
export const EQUIVALENCE_GROUPS: readonly EquivalenceGroup[] = [
  { id: 'apostrophes', chars: ["'", '’', '‘', 'ʼ', '׳', 'ʻ', '᾽'] },
  { id: 'double-quotes', chars: ['"', '”', '“', '„'] },
  { id: 'dashes', chars: ['-', '–', '—', '‐', '‑'] },
  { id: 'commas', chars: [',', '‚'] },
  { id: 'spaces', chars: SPACE_CHARS, canonical: ' ' },
  // Latin 'e' included like monkeytype: a latin layout mid-cyrillic word is a
  // layout slip, not a different letter.
  { id: 'ru-yo', chars: ['ё', 'е', 'e'], languages: ['russian'] }
]

export interface Normalizer {
  /** The two graphemes count as the same character (under `language`). */
  areEquivalent(a: string, b: string, language?: string): boolean
  /**
   * The grapheme to STORE for a keystroke: `expected` when the typed grapheme
   * is equivalent to it, else the group's canonical fallback, else the typed
   * grapheme untouched.
   */
  normalize(typed: string, expected: string | undefined, language?: string): string
}

const appliesTo = (group: EquivalenceGroup, language: string | undefined): boolean => {
  if (group.languages === undefined) return true
  if (language === undefined) return false
  return group.languages.some((name) => language === name || language.startsWith(`${name}_`))
}

/** Compile a registry into the per-keystroke functions (char → groups lookup). */
export function makeNormalizer(groups: readonly EquivalenceGroup[]): Normalizer {
  const byChar = new Map<string, EquivalenceGroup[]>()
  for (const group of groups) {
    for (const char of group.chars) {
      const list = byChar.get(char)
      if (list) list.push(group)
      else byChar.set(char, [group])
    }
  }

  const areEquivalent = (a: string, b: string, language?: string): boolean => {
    if (a === b) return true
    const candidates = byChar.get(a)
    if (candidates === undefined) return false
    return candidates.some((group) => group.chars.includes(b) && appliesTo(group, language))
  }

  const normalize = (typed: string, expected: string | undefined, language?: string): string => {
    if (typed === expected) return typed
    if (expected !== undefined && areEquivalent(typed, expected, language)) return expected
    const fallback = byChar
      .get(typed)
      ?.find((group) => group.canonical !== undefined && appliesTo(group, language))
    return fallback?.canonical ?? typed
  }

  return { areEquivalent, normalize }
}

const defaultNormalizer = makeNormalizer(EQUIVALENCE_GROUPS)

/** {@link Normalizer.areEquivalent} over the default registry. */
export const areGraphemesEquivalent = defaultNormalizer.areEquivalent

/** {@link Normalizer.normalize} over the default registry. */
export const normalizeGrapheme = defaultNormalizer.normalize

const SPACE_SET: ReadonlySet<string> = new Set(SPACE_CHARS)

/** The grapheme is a typable space variant — a word separator, wherever typed. */
export const isSpaceGrapheme = (grapheme: string): boolean => SPACE_SET.has(grapheme)
