/**
 * Which quote corpus serves a dictionary key.
 *
 * The dictionary catalogue and the quote registry are two different corpora
 * that share a key space, and they do not cover it equally: 430 dictionaries
 * against 86 quote corpora. Size variants are the gap that hurts, because they
 * are not different LANGUAGES — `russian_50k` is Russian with a bigger word
 * list, and upstream publishes its quotes once, under `russian`. A player who
 * types Russian at 50k and switches to quote mode was asking for Russian
 * quotes, not for a 404.
 *
 * So the rule is exactly one rewrite: strip a trailing `_<n>k` size suffix.
 * That is safe to do blind, and the reason is checkable rather than hopeful —
 * NO quote corpus key carries such a suffix (`MANIFEST.json`, 86 rows), so the
 * mapping can never shadow a corpus that exists in its own right.
 *
 * Everything else is left alone, because everything else is a real distinction:
 * `arabian_egypt`, `norwegian_bokmal` and `tamil_old` all have corpora of their
 * own, and `russian_empire` (pre-reform orthography) genuinely has none. A 404
 * for those is the registry answering honestly, and the picker's "no quotes for
 * this filter" state is the right place to say so.
 */

/** `<base>_<digits>k` — the only suffix the dictionary catalogue uses for size. */
const SIZE_VARIANT = /^(.+)_\d+k$/

/**
 * The corpus a quote draw for `language` should ask for. Identity for every key
 * that is not a size variant.
 *
 *   english_10k  → english
 *   russian_50k  → russian
 *   german_250k  → german
 *   russian_empire → russian_empire   (a different orthography, not a size)
 *   code_python  → code_python
 */
export const quoteCorpusLang = (language: string): string =>
  SIZE_VARIANT.exec(language)?.[1] ?? language

/** True when a draw for `language` will be served by a different corpus key. */
export const isSizeVariant = (language: string): boolean => quoteCorpusLang(language) !== language
