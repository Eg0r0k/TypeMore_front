import { expect, test } from '@playwright/test'
import { stubDictionaries } from './fixtures/dictionaries'

/**
 * A room racing a QUOTE, end to end over the loopback transport.
 *
 * This is the path that used to be closed: v0 of the protocol validated
 * `textSource.kind == "seeded"`, so a room could only race a generated text.
 * What makes the quote arm different is everything this spec asserts — the id
 * travels instead of the bytes, no dictionary is fetched and no `dictHash` is
 * advertised, and both seats end up typing the same published characters.
 */
const QUOTE = {
  id: 'q-room-1',
  lang: 'russian',
  upstreamId: 7,
  source: 'Антон Чехов',
  length: 24,
  lenGroup: 'short',
  textHash: 'aa11bb22'
}
const TEXT = 'краткость сестра таланта'

test('a room can race a quote: the id travels, the text is fetched per seat', async ({ page }) => {
  test.setTimeout(90_000)
  await stubDictionaries(page)

  /** Which quote endpoints were asked for — the id must be what travels. */
  const quoteCalls: string[] = []
  await page.route('**/api/v1/quotes**', (route) => {
    const url = new URL(route.request().url())
    quoteCalls.push(url.pathname + url.search)
    const body = url.pathname.endsWith('/random')
      ? { ...QUOTE, text: TEXT, superseded: false }
      : url.pathname.endsWith(`/quotes/${QUOTE.id}`)
        ? { ...QUOTE, text: TEXT, superseded: false }
        : { quotes: [QUOTE] }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body)
    })
  })

  await page.goto('/servers?mp=loopback')
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('cookieConsentGiven', 'true')
  })
  await page.reload()

  const createButton = page.getByRole('button', { name: 'Create room' })
  await expect(createButton).toBeEnabled()
  await createButton.click()
  await page.waitForURL('**/room')

  // Quote mode draws BEFORE it applies, so the room never advertises a mode
  // without a quote to go with it: the toggle only lands on `quote` once the
  // draw came back and the settings went out.
  await page.locator('[aria-label="mode"]').getByText('quote', { exact: true }).click()
  await expect(page.locator('[aria-label="mode"] [data-state="on"]')).toHaveText('quote')
  await expect(page.locator('[aria-label="quote length"]')).toBeVisible()
  await expect(page.locator('[aria-label="word count"]')).toHaveCount(0)

  await page.evaluate(() => {
    const w = window as unknown as {
      __tmLoopback: { addBot(options?: { wpm?: number }): Promise<void> }
    }
    return w.__tmLoopback.addBot({ wpm: 90 })
  })
  await expect(page.locator('.players__list li')).toHaveCount(2)

  const startButton = page.getByTestId('start-button')
  await expect(startButton).toBeEnabled()
  await startButton.click()

  // The field is built from the quote, not from a seeded generation.
  await page.waitForFunction(
    () =>
      (document.querySelector('.game__host')?.shadowRoot?.querySelectorAll('.word').length ?? 0) >
      0,
    undefined,
    { timeout: 20_000 }
  )
  const words = await page.evaluate(() =>
    Array.from(
      document.querySelector('.game__host')?.shadowRoot?.querySelectorAll('.word') ?? []
    ).map((word) => (word.textContent ?? '').replace(/\s+/g, ''))
  )
  expect(words).toEqual(TEXT.split(' '))

  // Exactly one draw, and it was the HOST's: the id then travels, and every seat
  // resolves it. In this page both seats resolve it from the cache that draw
  // warmed (`loadRandomQuote` seeds the by-id entry), which is the point of
  // sending an id rather than the bytes — anyone can resolve it, and whoever
  // already has it pays nothing.
  expect(quoteCalls.filter((call) => call.includes('/quotes/random'))).toHaveLength(1)
})
