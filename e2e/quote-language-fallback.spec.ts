import { expect, test, type Page } from '@playwright/test'
import { stubDictionaries } from './fixtures/dictionaries'

/**
 * Quote mode against a language that has no quotes.
 *
 * The two corpora share a key space they do not cover equally — 430 served
 * dictionaries against 86 quote corpora (the backend's `docs/QUOTES.md`) — so
 * "this language has no quotes" is a permanent fact about a perfectly good
 * language, and picking such a language while quote mode is on used to leave the
 * player on an error panel with no test to type. The bar must instead put the
 * mode somewhere it can actually run and say that it did.
 *
 * Asserted end to end rather than in a unit test because the rule is a WATCHER
 * over two pieces of state that arrive separately — the persisted mode and an
 * answer from the network — and the thing that would break is their ordering.
 */

/** The language the stub publishes quotes for; `code_css` deliberately has none. */
const WITH_QUOTES = { lang: 'russian', name: 'Russian' }
const WITHOUT_QUOTES = { lang: 'code_css', name: 'CSS (code)' }

const QUOTE_META = {
  id: '1f5f1f2c-6f0f-4d5a-9f0a-3f2a1b0c9d8e',
  lang: WITH_QUOTES.lang,
  upstreamId: 42,
  source: 'Антон Чехов',
  length: 21,
  lenGroup: 'short',
  textHash: 'e2e0aa01'
}

/**
 * The quote registry, backend-less. One corpus exists and every other language
 * answers with an EMPTY PAGE — which is what the real server does for a language
 * it has no quotes for, and the whole reason the client asks the index rather
 * than trying a draw and reading a 404.
 */
async function stubQuotes(page: Page): Promise<void> {
  await page.route('**/api/v1/quotes**', (route) => {
    const url = new URL(route.request().url())
    const json = (body: unknown) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })

    if (url.pathname.endsWith('/random')) {
      return json({ ...QUOTE_META, text: 'Краткость — сестра', superseded: false })
    }
    const lang = url.searchParams.get('lang')
    return json({ quotes: lang === WITH_QUOTES.lang ? [QUOTE_META] : [] })
  })
}

const modeGroup = (page: Page) => page.locator('[aria-label="mode"]')
const selectedMode = (page: Page) => modeGroup(page).locator('[data-state="on"]')

async function pickLanguage(page: Page, name: string): Promise<void> {
  await page.getByTestId('language-picker').click()
  await page.getByRole('textbox').first().fill(name)
  await page.getByRole('option', { name, exact: true }).click()
}

test.beforeEach(async ({ page }) => {
  await stubDictionaries(page)
  await stubQuotes(page)
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('cookieConsentGiven', 'true')
  })
  await page.reload()
  await page.waitForSelector('.settings-bar__btn')
})

test('picking a language with no quotes falls back to words and says so', async ({ page }) => {
  // Russian has quotes, so quote mode is offered and selectable.
  await modeGroup(page).getByText('quote', { exact: true }).click()
  await expect(selectedMode(page)).toHaveText('quote')

  await pickLanguage(page, WITHOUT_QUOTES.name)

  // The mode moved on its own, and the toast is what makes that legible — a
  // silent switch would read as the click having selected the wrong thing.
  await expect(selectedMode(page)).toHaveText('words')
  await expect(page.getByRole('alertdialog')).toContainText(
    `no quotes in ${WITHOUT_QUOTES.name}`
  )
  await expect(page.getByTestId('language-picker')).toHaveText(WITHOUT_QUOTES.name)

  // ...and it cannot be walked straight back into: with the answer now known,
  // the mode itself is disabled rather than silently failing on the next draw.
  await expect(modeGroup(page).getByText('quote', { exact: true })).toBeDisabled()
})

test('a language that has quotes leaves the mode alone', async ({ page }) => {
  await pickLanguage(page, WITH_QUOTES.name)
  await modeGroup(page).getByText('quote', { exact: true }).click()

  await expect(selectedMode(page)).toHaveText('quote')
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
})
