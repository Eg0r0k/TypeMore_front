import type { Page } from '@playwright/test'
import { dictVersion } from '@typemore/core'

/**
 * Dictionary stub for the backend-less E2E harness.
 *
 * Word lists are no longer shipped in `public/` — the Go server is their only
 * source (`GET /api/v1/dictionaries` → `/static/dictionaries/<hash>.json`, see
 * the backend's `docs/DICTIONARIES.md`). These specs deliberately run without a
 * backend, so both endpoints are fulfilled here. The client path under test is
 * unchanged and real: catalogue lookup → hash → body.
 *
 * The advertised hashes are REAL fingerprints, computed with the same core
 * `dictVersion` the app and the server use. They have to be: since B-DICT-4
 * (docs/DICTFIX_LOG.md) the client re-fingerprints every downloaded body and
 * refuses one that does not hash to its address, so a stub advertising an
 * opaque made-up hash would fail every load in the suite — which is exactly
 * the behaviour that catches a real catalogue/body mismatch in production.
 */

const WORDS: Record<string, string[]> = {
  german: [
    'der',
    'die',
    'das',
    'und',
    'ist',
    'nicht',
    'mit',
    'sich',
    'auf',
    'für',
    'eine',
    'auch',
    'aber',
    'noch',
    'nach',
    'wenn',
    'schon',
    'immer',
    'sehr',
    'unter',
    'zwischen',
    'gegen',
    'ohne',
    'durch',
    'wieder',
    'jeder',
    'welche',
    'komme',
    'sagen',
    'geben',
    'machen',
    'sehen',
    'finden',
    'stehen',
    'bleiben',
    'arbeit',
    'wasser',
    'straße',
    'jahre',
    'leben'
  ],
  russian: [
    'и',
    'не',
    'на',
    'что',
    'как',
    'все',
    'она',
    'так',
    'его',
    'но',
    'вы',
    'мне',
    'было',
    'вот',
    'от',
    'меня',
    'еще',
    'нет',
    'если',
    'уже',
    'или',
    'быть',
    'был',
    'него',
    'себя',
    'когда',
    'даже',
    'ну',
    'вдруг',
    'сказал',
    'время',
    'город',
    'дело',
    'жизнь',
    'люди',
    'место',
    'работа',
    'слово',
    'страна',
    'человек'
  ],
  code_css: [
    'color',
    'background',
    'font-size',
    'display',
    'width',
    'height',
    'flex',
    'justify-content',
    'align-items',
    'cursor',
    'padding',
    'margin',
    'border',
    'outline',
    'grid',
    'border-radius',
    'overflow',
    'opacity',
    'transform',
    'line-height',
    'z-index',
    'transition',
    'position',
    'inset',
    'block'
  ]
}

/** Real content addresses: the core's FNV of each list (see the note above). */
const HASHES: Record<string, string> = Object.fromEntries(
  Object.entries(WORDS).map(([lang, words]) => [lang, dictVersion(words)])
)

/**
 * The catalogue's human names. NOT derived from the key: the server owns this
 * table (`code_css` is "CSS (code)", never "Css Code"), and the client renders
 * whatever it is handed — so the stub has to hand over the real thing.
 */
const NAMES: Record<string, string> = {
  german: 'German',
  russian: 'Russian',
  code_css: 'CSS (code)'
}

/**
 * Filler rows, so a spec can drive the pickers at the size the real catalogue
 * now is (430 languages) rather than at the three this file hand-writes.
 *
 * They are real rows in every respect a picker cares about — a key, a name that
 * is not derivable from it, a hash that addresses a body — because the thing
 * under test is whether a picker stays usable at that length, and a stub that
 * shrank the list would be testing the opposite.
 */
const FILLER_COUNT = 427

function fillerRows(): { lang: string; name: string; words: string[] }[] {
  // Distinct, pronounceable-ish, and deliberately NOT a title-cased key: the
  // name has to be something no transformation of `lang` could produce, which
  // is the property the catalogue exists to carry.
  const stems = ['ka', 'lo', 'mi', 'ne', 'po', 'ru', 'sa', 'te', 'vi', 'zu']
  return Array.from({ length: FILLER_COUNT }, (_, i) => {
    const stem = stems[i % stems.length]
    return {
      lang: `filler_${stem}_${String(i).padStart(3, '0')}`,
      name: `Filler ${stem.toUpperCase()} #${i}`,
      words: Array.from({ length: 24 }, (_, w) => `${stem}${w}`)
    }
  })
}

/**
 * A FIXED-WIDTH corpus, for specs whose subject is layout rather than text.
 *
 * Every word is exactly ten characters, so a run of N words wraps onto the same
 * lines no matter which seed the client draws — which is the difference between
 * a render assertion and a coin flip. (The perf spec's replay probe asserts a
 * line jump happened; on a natural word list a short draw sometimes fits in two
 * lines and never jumps, and the test failed for reasons that had nothing to do
 * with rendering.)
 *
 * Opt-in via `extra`, so the catalogue every other spec sees is unchanged.
 */
const FIXED_WIDTH_WORDS = [
  'alphabetic',
  'buttercups',
  'cornflower',
  'dandelions',
  'elderberry',
  'fieldstone',
  'grapevines',
  'hailstorms',
  'immersions',
  'jackhammer',
  'kilometers',
  'lighthouse'
] as const

export const FIXED_WIDTH_DICTIONARY = {
  lang: 'e2e_fixed_width',
  name: 'Fixed Width (e2e)',
  dictHash: dictVersion(FIXED_WIDTH_WORDS),
  words: FIXED_WIDTH_WORDS
} as const

export interface ExtraDictionary {
  readonly lang: string
  readonly name: string
  readonly dictHash: string
  readonly words: readonly string[]
}

/**
 * Installs the catalogue + body routes on `page`. Call before the first `goto`.
 *
 * Every call builds its OWN corpus from the constants above and never writes
 * back into them. That is not tidiness: Playwright reuses a worker process
 * across the tests in a file, so a fixture that appended its filler rows to the
 * module-level maps would hand the second test a catalogue twice the size of
 * the first one's and the third a catalogue three times the size — which is
 * exactly what it did, and it read as a search filter that had stopped working.
 */
export async function stubDictionaries(
  page: Page,
  opts: { full?: boolean; extra?: readonly ExtraDictionary[] } = {}
): Promise<void> {
  const words: Record<string, string[]> = { ...WORDS }
  const hashes: Record<string, string> = { ...HASHES }
  const names: Record<string, string> = { ...NAMES }

  for (const row of opts.extra ?? []) {
    words[row.lang] = [...row.words]
    hashes[row.lang] = row.dictHash
    names[row.lang] = row.name
  }

  if (opts.full === true) {
    fillerRows().forEach((row) => {
      words[row.lang] = row.words
      hashes[row.lang] = dictVersion(row.words)
      names[row.lang] = row.name
    })
  }

  // The catalogue is served ordered by key; the picker must not depend on
  // having been handed it in any other order.
  const catalogue = Object.keys(words)
    .sort()
    .map((lang) => ({
      lang,
      name: names[lang],
      dictHash: hashes[lang],
      wordCount: words[lang].length,
      bytes: new TextEncoder().encode(JSON.stringify({ name: lang, words: words[lang] })).length
    }))

  await page.route('**/api/v1/dictionaries', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(catalogue) })
  )

  await page.route('**/static/dictionaries/*.json', (route) => {
    const hash = new URL(route.request().url()).pathname.split('/').pop()!.replace('.json', '')
    const lang = Object.keys(hashes).find((l) => hashes[l] === hash)
    if (lang === undefined) {
      return route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: '{"error":"not_found","message":"no dictionary with that hash"}'
      })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'cache-control': 'public, max-age=31536000, immutable' },
      body: JSON.stringify({ name: lang, words: words[lang] })
    })
  })
}
