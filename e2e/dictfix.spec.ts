import { expect, test, type Page } from '@playwright/test'
import { dictVersion } from '@typemore/core'
import { stubDictionaries } from './fixtures/dictionaries'

/**
 * The dictionary/quote loading contract, end to end (docs/DICTFIX_LOG.md).
 *
 * Solo must be playable from a COLD cache on both text sources, a dead or
 * dying backend must produce an explicit, recoverable error state — never an
 * empty field — and the two Stage-0 roots must never regress:
 *
 *   B-DICT-1 `empty-quote-registry`: an empty quote registry is an honest
 *   disabled quote toggle, not a spinner and not a crash.
 *   B-DICT-3 `lang-switch-drops-dict`: a language switch that cannot load its
 *   body keeps the currently loaded dictionary playable.
 *
 * B-DICT-4 rides along: a body that does not hash to its address is refused.
 */

const QUOTE = {
  id: '7f31d1e0-0000-4000-8000-000000000001',
  lang: 'russian',
  upstreamId: 1,
  source: 'Антон Чехов',
  length: 24,
  lenGroup: 'short',
  textHash: dictVersion(['краткость сестра таланта']),
  superseded: false
}
const QUOTE_TEXT = 'краткость сестра таланта'

/** Quote endpoints with a NON-empty registry. */
async function stubQuotes(page: Page): Promise<void> {
  await page.route('**/api/v1/quotes**', (route) => {
    const url = new URL(route.request().url())
    const body = /\/random$/.test(url.pathname)
      ? { ...QUOTE, text: QUOTE_TEXT }
      : url.pathname.endsWith(`/quotes/${QUOTE.id}`)
        ? { ...QUOTE, text: QUOTE_TEXT }
        : { quotes: [QUOTE] }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
}

/** The words currently rendered in the field's shadow root. */
const fieldWords = (page: Page): Promise<string[]> =>
  page.evaluate(() =>
    Array.from(
      document.querySelector('.game__host')?.shadowRoot?.querySelectorAll('.word') ?? []
    ).map((w) => (w.textContent ?? '').replace(/\s+/g, ''))
  )

const acceptCookies = async (page: Page): Promise<void> => {
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('cookieConsentGiven', 'true')
  })
}

test('solo words is playable from a cold cache', async ({ page }) => {
  await stubDictionaries(page)
  await stubQuotes(page)
  await acceptCookies(page)
  await page.reload()

  await expect.poll(async () => (await fieldWords(page)).length, { timeout: 15_000 }).toBeGreaterThan(0)
})

test('solo quote is playable from a cold cache', async ({ page }) => {
  await stubDictionaries(page)
  await stubQuotes(page)
  await acceptCookies(page)
  await page.reload()

  await page.getByRole('radio', { name: /цитат|quote/i }).or(page.getByRole('button', { name: /цитат|quote/i })).first().click()
  await expect.poll(async () => (await fieldWords(page)).join(' '), { timeout: 15_000 }).toBe(QUOTE_TEXT)
})

test('a 500 backend is an error state with retry, and recovery makes it playable', async ({ page }) => {
  await stubQuotes(page)
  await stubDictionaries(page)
  // Registered AFTER the stub, so it wins (Playwright routes are LIFO): the
  // backend is broken until the test flips the switch, then fallback() lets
  // the request reach the healthy stub underneath.
  let broken = true
  await page.route('**/api/v1/dictionaries', (route) =>
    broken
      ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' })
      : route.fallback()
  )
  await acceptCookies(page)
  await page.reload()

  // Explicit error surface — never an empty field, never an eternal spinner.
  await expect(page.getByText(/не удалось загрузить список слов|could not load the word list/i)).toBeVisible({
    timeout: 20_000
  })
  const retry = page.getByRole('button', { name: /повторить|retry/i })
  await expect(retry).toBeVisible()

  // The backend comes back; retry must make the game playable.
  broken = false
  await retry.click()
  await expect.poll(async () => (await fieldWords(page)).length, { timeout: 15_000 }).toBeGreaterThan(0)
})

// B-DICT-1 regression, by name: an EMPTY quote registry (the state every fresh
// stand used to boot into before compose ran the import) must read as a
// disabled quote toggle — the availability probe answering honestly — while
// words mode stays fully playable.
test('B-DICT-1: an empty quote registry disables quote mode honestly', async ({ page }) => {
  await stubDictionaries(page)
  await page.route('**/api/v1/quotes**', (route) => {
    const url = new URL(route.request().url())
    return /\/random$/.test(url.pathname)
      ? route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not_found","message":"no such quote"}' })
      : route.fulfill({ status: 200, contentType: 'application/json', body: '{"quotes":[]}' })
  })
  await acceptCookies(page)
  await page.reload()

  // Words mode is untouched by the empty registry.
  await expect.poll(async () => (await fieldWords(page)).length, { timeout: 15_000 }).toBeGreaterThan(0)

  const quoteToggle = page
    .getByRole('radio', { name: /цитат|quote/i })
    .or(page.getByRole('button', { name: /цитат|quote/i }))
    .first()
  await expect(quoteToggle).toBeDisabled()
})

// B-DICT-3 regression, by name: switching language while the network is down
// keeps the loaded dictionary playable instead of replacing the field with the
// error state; the config reverts to the language that still has a body.
test('B-DICT-3: a dead-net language switch keeps the loaded dictionary', async ({ page }) => {
  await stubDictionaries(page)
  await stubQuotes(page)
  await acceptCookies(page)
  await page.reload()
  await expect.poll(async () => (await fieldWords(page)).length, { timeout: 15_000 }).toBeGreaterThan(0)

  // The network dies: every API request from here on is refused.
  await page.route('**/api/v1/**', (route) => route.abort('connectionrefused'))
  await page.route('**/static/dictionaries/**', (route) => route.abort('connectionrefused'))

  await page.getByTestId('language-picker').click()
  await page.getByPlaceholder(/поиск|search/i).fill('German')
  await page.getByText(/^German$/).first().click()

  // The field survives on the previous dictionary (rebuilt from the immutable
  // cache) and the failure is said out loud, not swallowed.
  await expect(page.getByText(/остаёмся на|staying on/i)).toBeVisible({ timeout: 10_000 })
  await expect.poll(async () => (await fieldWords(page)).length).toBeGreaterThan(0)
})

// B-DICT-4: a body that does not hash to its catalogue address is a refused
// load (the explicit error state), never a silently used corrupted body.
test('B-DICT-4: a corrupted dictionary body is refused, not used', async ({ page }) => {
  await stubDictionaries(page)
  await stubQuotes(page)
  // Registered after the stub, so it wins: every body request gets a word list
  // that CANNOT hash to the requested address. No route.fetch here — that
  // would bypass the stub and depend on whatever listens on the real port.
  await page.route('**/static/dictionaries/*.json', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ name: 'corrupted', words: ['definitely', 'not', 'the', 'published', 'list'] })
    })
  )
  await acceptCookies(page)
  await page.reload()

  await expect(page.getByText(/не удалось загрузить список слов|could not load the word list/i)).toBeVisible({
    timeout: 20_000
  })
})
