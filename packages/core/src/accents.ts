/**
 * Lazy mode — the accent dictionary and the word transform it drives.
 *
 * Lazy mode types a word WITHOUT its diacritics: `épée` becomes `epee`, `straße`
 * becomes `strasse`, `ёж` becomes `еж`. The transform runs at GENERATION time,
 * so the target the player sees is already the plain form — nothing about input,
 * the event log or scoring is involved, and `normalize.ts` (which decides that a
 * TYPED grapheme counts as an EXPECTED one) is untouched. The two are easy to
 * confuse and must stay apart: normalize is always on and forgiving about
 * variants of the same character; lazy is a toggle that rewrites the text.
 *
 * DATA PORTED FROM MONKEYTYPE, ALGORITHM NOT. The rules are their
 * `test/lazy-mode.ts` `accents` table plus the `additionalAccents` of the six
 * languages whose JSON declares one (german, pinyin, quenya, serbian_latin,
 * vietnamese, yiddish). Two deliberate departures:
 *
 * 1. THE SOURCES ARE GRAPHEMES, NOT CODE POINTS. monkeytype flattens each rule
 *    with `[...rule[0]]`, which splits the combining sequences that are in their
 *    own table — `ą́` is `ą`+U+0301, `g̃` is `g`+U+0303, Yiddish `אַ` is alef+patah
 *    — into separate entries, so a bare U+0301 maps to whatever letter's rule
 *    came last and `אַ` expands to two alefs. Here each source is the whole
 *    character a typist sees, and the matcher tries the LONGEST source first.
 * 2. CASE IS DERIVED PER CHARACTER, not by index into `word.toUpperCase()`.
 *    Theirs desynchronises after any character whose upper-case form is longer
 *    than itself (`ß` → `SS`), which is exactly the character the table exists
 *    for. The observable rule is kept: for a 1→2 expansion the second output
 *    character borrows the case of the FOLLOWING source character, so `Äpfel` →
 *    `Aepfel` and `ÄPFEL` → `AEPFEL`.
 *
 * THIS TABLE IS PART OF THE WIRE CONTRACT, like the canary draw order. The
 * server regenerates a run's words from the seed context through the vendored
 * goja bundle; changing a rule changes what every lazy run was supposed to type,
 * so edits here ship only together with a re-vendored bundle.
 */

import { languageMatches } from './normalize'

/** One rule: any of `from` (matched longest-first, case-insensitively) becomes `to`. */
export interface AccentRule {
  /** Source characters, each a full grapheme — `ą́` and `אַ` are one entry, not two. */
  readonly from: readonly string[]
  /** The plain form. `''` DELETES the source (the Arabic harakat rules). */
  readonly to: string
}

/**
 * Rules that apply to every dictionary. A language pack entry for the same
 * source WINS over these (monkeytype's `additionalFound ?? commonFound`) — which
 * is how `đ` is `d` in general but `dj` in Serbian, and `þ` is `th` in general
 * but `p` in Quenya.
 */
export const COMMON_ACCENTS: readonly AccentRule[] = [
  { from: ['á', 'à', 'â', 'ä', 'å', 'ã', 'ą', 'ą́', 'ā', 'ą̄', 'ă'], to: 'a' },
  { from: ['é', 'è', 'ê', 'ë', 'ẽ', 'ę', 'ę́', 'ē', 'ę̄', 'ė', 'ě'], to: 'e' },
  { from: ['í', 'ì', 'î', 'ï', 'ĩ', 'į', 'į́', 'ī', 'į̄', 'ı'], to: 'i' },
  { from: ['ó', 'ò', 'ô', 'ö', 'ø', 'õ', 'ō', 'ǫ', 'ǫ́', 'ǭ', 'ő'], to: 'o' },
  { from: ['ú', 'ù', 'û', 'ü', 'ŭ', 'ũ', 'ū', 'ů', 'ű'], to: 'u' },
  { from: ['ń', 'ň', 'ṇ', 'ṅ'], to: 'n' },
  { from: ['ç', 'ĉ', 'č', 'ć'], to: 'c' },
  { from: ['ř', 'ŕ', 'ṛ'], to: 'r' },
  { from: ['ď', 'đ', 'ḍ'], to: 'd' },
  { from: ['ť', 'ț', 'ṭ'], to: 't' },
  { from: ['ṃ'], to: 'm' },
  { from: ['æ'], to: 'ae' },
  { from: ['œ'], to: 'oe' },
  { from: ['ẅ', 'ŵ'], to: 'w' },
  { from: ['ĝ', 'ğ', 'g̃'], to: 'g' },
  { from: ['ĥ'], to: 'h' },
  { from: ['ĵ'], to: 'j' },
  { from: ['ŝ', 'ś', 'š', 'ș', 'ş', 'ṣ'], to: 's' },
  { from: ['ß'], to: 'ss' },
  { from: ['ż', 'ź', 'ž'], to: 'z' },
  { from: ['ÿ', 'ỹ', 'ý', 'ŷ'], to: 'y' },
  { from: ['ł', 'ľ', 'ĺ'], to: 'l' },
  { from: ['þ'], to: 'th' },
  // Cyrillic: the same ё/е pair `normalize.ts` forgives on input, here rewriting
  // the target itself so the dotted form never appears.
  { from: ['ё'], to: 'е' },
  // Greek: tonos stripped, the letter kept.
  { from: ['ά'], to: 'α' },
  { from: ['έ'], to: 'ε' },
  { from: ['ί'], to: 'ι' },
  { from: ['ύ'], to: 'υ' },
  { from: ['ό'], to: 'ο' },
  { from: ['ή'], to: 'η' },
  { from: ['ώ'], to: 'ω' },
  // Arabic: hamza forms collapse onto bare alef, and the harakat are DELETED
  // (`to: ''`) rather than replaced — they are marks on a letter, not letters.
  { from: ['أ', 'إ', 'آ'], to: 'ا' },
  {
    from: ['ً', 'ٌ', 'ٍ', 'َ', 'ُ', 'ِ', 'ّ', 'ْ'],
    to: ''
  }
]

/**
 * Per-dictionary overrides, keyed by the CANONICAL dictionary key. A sized
 * variant resolves to its base (`german_1k` → `german`), same rule the language
 * groups in `normalize.ts` use.
 */
export const LANGUAGE_ACCENTS: Readonly<Record<string, readonly AccentRule[]>> = {
  // German spells the umlauts out rather than dropping the diaeresis.
  german: [
    { from: ['ä'], to: 'ae' },
    { from: ['ö'], to: 'oe' },
    { from: ['ü'], to: 'ue' }
  ],
  // Pinyin tone marks; `ü` is written `v`, the standard IME convention.
  pinyin: [
    { from: ['ā', 'á', 'ǎ', 'à'], to: 'a' },
    { from: ['ō', 'ó', 'ǒ', 'ò'], to: 'o' },
    { from: ['ē', 'é', 'ě', 'è'], to: 'e' },
    { from: ['ī', 'í', 'ǐ', 'ì'], to: 'i' },
    { from: ['ū', 'ú', 'ǔ', 'ù'], to: 'u' },
    { from: ['ü', 'ǖ', 'ǘ', 'ǚ', 'ǜ'], to: 'v' }
  ],
  quenya: [
    { from: ['ä', 'á'], to: 'a' },
    { from: ['ö', 'ó'], to: 'o' },
    { from: ['ë', 'é'], to: 'e' },
    { from: ['í'], to: 'i' },
    { from: ['Ú', 'ú'], to: 'u' },
    { from: ['χ'], to: 'x' },
    { from: ['þ'], to: 'p' }
  ],
  serbian_latin: [{ from: ['đ'], to: 'dj' }],
  vietnamese: [
    {
      from: ['á', 'à', 'ă', 'ắ', 'ằ', 'ẵ', 'ẳ', 'â', 'ấ', 'ầ', 'ẫ', 'ẩ', 'ã', 'ả', 'ạ', 'ặ', 'ậ'],
      to: 'a'
    },
    { from: ['đ'], to: 'd' },
    { from: ['é', 'è', 'ê', 'ế', 'ề', 'ễ', 'ể', 'ẽ', 'ẻ', 'ẹ', 'ệ'], to: 'e' },
    { from: ['í', 'ì', 'ĩ', 'ỉ', 'ị'], to: 'i' },
    {
      from: ['ó', 'ò', 'ô', 'ố', 'ồ', 'ỗ', 'ổ', 'õ', 'ỏ', 'ơ', 'ớ', 'ờ', 'ỡ', 'ở', 'ợ', 'ọ', 'ộ'],
      to: 'o'
    },
    { from: ['ú', 'ù', 'ũ', 'ủ', 'ư', 'ứ', 'ừ', 'ữ', 'ử', 'ự', 'ụ'], to: 'u' },
    { from: ['ý', 'ỳ', 'ỹ', 'ỷ', 'ỵ'], to: 'y' }
  ],
  // Yiddish: base letter + niqqud, and the ligatures written as their two
  // letters. Every source here is TWO code points bar the ligatures — the whole
  // reason sources are graphemes rather than code points.
  yiddish: [
    { from: ['אַ', 'אָ'], to: 'א' },
    { from: ['בּ', 'בֿ'], to: 'ב' },
    { from: ['וּ', 'וֹ'], to: 'ו' },
    { from: ['יִ'], to: 'י' },
    { from: ['כּ'], to: 'כ' },
    { from: ['פּ', 'פֿ'], to: 'פ' },
    { from: ['שׂ'], to: 'ש' },
    { from: ['תּ'], to: 'ת' },
    { from: ['ײַ', 'ײ'], to: 'יי' },
    { from: ['ױ'], to: 'וי' },
    { from: ['װ'], to: 'וו' }
  ]
}

/** A compiled table: lower-cased source → replacement, plus the longest source. */
interface AccentTable {
  readonly bySource: ReadonlyMap<string, string>
  /** Longest source in UTF-16 code units — the matcher's starting window. */
  readonly maxLength: number
}

function compile(packs: readonly (readonly AccentRule[])[]): AccentTable {
  const bySource = new Map<string, string>()
  let maxLength = 0
  // Later packs overwrite earlier ones: common first, then the language.
  for (const pack of packs) {
    for (const rule of pack) {
      for (const source of rule.from) {
        bySource.set(source.toLowerCase(), rule.to)
        if (source.length > maxLength) maxLength = source.length
      }
    }
  }
  return { bySource, maxLength }
}

/**
 * Compiled tables per language key. Generation calls `replaceAccents` once per
 * word — up to a few hundred times for a timed run — and the table is a pure
 * function of the constants above, so compiling it once per language is a cache,
 * not state: it cannot make two calls with the same arguments disagree.
 */
const tables = new Map<string, AccentTable>()

function tableFor(language: string | undefined): AccentTable {
  const key = language ?? ''
  const cached = tables.get(key)
  if (cached !== undefined) return cached
  const pack = Object.keys(LANGUAGE_ACCENTS).find((name) => languageMatches(name, language))
  const compiled = compile(
    pack === undefined ? [COMMON_ACCENTS] : [COMMON_ACCENTS, LANGUAGE_ACCENTS[pack]]
  )
  tables.set(key, compiled)
  return compiled
}

/** The rules a dictionary resolves to, common table included. Exported for tests and docs. */
export function accentsFor(language: string | undefined): readonly AccentRule[] {
  const pack = Object.keys(LANGUAGE_ACCENTS).find((name) => languageMatches(name, language))
  return pack === undefined ? COMMON_ACCENTS : [...COMMON_ACCENTS, ...LANGUAGE_ACCENTS[pack]]
}

/** A character is upper-case when it differs from its own lower-case form. */
function isUpper(char: string): boolean {
  return char !== char.toLowerCase()
}

/**
 * The lazy-mode form of one word: every accented character replaced by its plain
 * form, case preserved.
 *
 * Pure and allocation-light on the common path — a word with no accented
 * character is returned by identity, which is every word of every English run.
 *
 * @param word the generated target
 * @param language canonical dictionary key selecting the override pack
 */
export function replaceAccents(word: string, language?: string): string {
  const { bySource, maxLength } = tableFor(language)
  let out: string | null = null // stays null until the first replacement
  let i = 0
  while (i < word.length) {
    // Longest source first: `אַ` must win over the bare `א` it starts with.
    let length = Math.min(maxLength, word.length - i)
    let replacement: string | undefined
    for (; length > 0; length--) {
      replacement = bySource.get(word.slice(i, i + length).toLowerCase())
      if (replacement !== undefined) break
    }
    if (replacement === undefined) {
      if (out !== null) out += word[i]
      i++
      continue
    }
    if (out === null) out = word.slice(0, i)
    for (let j = 0; j < replacement.length; j++) {
      // Output character j takes the case of source character j. Past the end of
      // the source (a 1→2 expansion like ß→ss) it borrows the FOLLOWING word
      // character, so `Straße` → `Strasse` and `STRAßE` → `STRASSE`; past the end
      // of the word there is nothing to borrow and lower case wins.
      const model = word[i + j]
      out += model !== undefined && isUpper(model) ? replacement[j].toUpperCase() : replacement[j]
    }
    i += length
  }
  return out ?? word
}
