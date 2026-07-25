import type { Page } from '@playwright/test'

/**
 * Dictionary stub for the backend-less E2E harness.
 *
 * Word lists are no longer shipped in `public/` — the Go server is their only
 * source (`GET /api/v1/dictionaries` → `/static/dictionaries/<hash>.json`, see
 * the backend's `docs/DICTIONARIES.md`). These specs deliberately run without a
 * backend, so both endpoints are fulfilled here. The client path under test is
 * unchanged and real: catalogue lookup → hash → body.
 *
 * The advertised hashes are opaque addresses, not fingerprints to verify: the
 * app recomputes `dictVersion(words)` from the body it receives whenever a hash
 * actually matters (room settings, match-frame validation). Any stable, unique
 * value works.
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
  css_code: [
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

/** Stable, unique stand-in addresses; see the note above on why these are opaque. */
const HASHES: Record<string, string> = {
  german: 'e2e00001',
  russian: 'e2e00002',
  css_code: 'e2e00003'
}

/** Installs the catalogue + body routes on `page`. Call before the first `goto`. */
export async function stubDictionaries(page: Page): Promise<void> {
  const catalogue = Object.entries(WORDS).map(([lang, words]) => {
    const body = JSON.stringify({ name: lang, words })
    return {
      lang,
      name: lang,
      dictHash: HASHES[lang],
      wordCount: words.length,
      bytes: new TextEncoder().encode(body).length
    }
  })

  await page.route('**/api/v1/dictionaries', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(catalogue) })
  )

  await page.route('**/static/dictionaries/*.json', (route) => {
    const hash = new URL(route.request().url()).pathname.split('/').pop()!.replace('.json', '')
    const lang = Object.keys(HASHES).find((l) => HASHES[l] === hash)
    if (!lang) {
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
      body: JSON.stringify({ name: lang, words: WORDS[lang] })
    })
  })
}
