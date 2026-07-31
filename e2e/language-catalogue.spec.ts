import { expect, test } from '@playwright/test'
import { stubDictionaries } from './fixtures/dictionaries'
import { installVisibleText } from './support/visible-text'

/**
 * The language picker at the size the catalogue actually is.
 *
 * The server now publishes 430 dictionaries, and the picker is the surface that
 * change is felt on: a list that was fine at three rows has to still be usable
 * at four hundred and thirty. Two things are asserted, and they are the two that
 * would break — that the FULL catalogue is offered rather than a truncated head
 * of it, and that search narrows it to something a person can click.
 *
 * Then it starts a run on an exotic language. That is the part that proves the
 * picker is wired to the real path rather than to a label: selecting a row has
 * to resolve a key to a hash, fetch that body, and generate words from it.
 */
test.beforeEach(async ({ page }) => {
  await installVisibleText(page)
  await stubDictionaries(page, { full: true })
})

const EXOTIC = { lang: 'filler_zu_419', name: 'Filler ZU #419' }

async function openLanguagePicker(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('cookieConsentGiven', 'true'))
  await page.reload()
  await page.getByTestId('language-picker').click()
  await expect(page.getByRole('listbox')).toBeVisible()
}

/**
 * How long the list is, as the list itself reports it.
 *
 * The rows are virtualized, so counting DOM nodes counts the WINDOW, not the
 * catalogue — `aria-setsize` is the number a screen reader is given and the
 * only honest measure of "how many are on offer". It is also the thing that
 * breaks if the list is ever silently capped.
 */
const offeredCount = async (page: import('@playwright/test').Page): Promise<number> =>
  Number(await page.getByRole('option').first().getAttribute('aria-setsize'))

test('the picker offers the whole catalogue, not a truncated head of it', async ({ page }) => {
  await openLanguagePicker(page)

  // 430 = the three hand-written stub rows plus 427 filler. The assertion is on
  // the exact count because "some of them" is how a silently capped list looks.
  await expect.poll(() => offeredCount(page)).toBe(430)

  // ...and only a window of them is mounted. This is the other half of the same
  // claim: a list that offers 430 rows by rendering 430 rows is the version
  // that made the picker slow.
  expect(await page.getByRole('option').count()).toBeLessThan(430)

  // A row far past any plausible truncation point is reachable and named by the
  // catalogue — the key never reaches the screen.
  await page.getByRole('textbox').first().fill(EXOTIC.name)
  await expect(page.getByRole('option', { name: EXOTIC.name, exact: true })).toBeVisible()
})

test('search narrows the full catalogue', async ({ page }) => {
  await openLanguagePicker(page)
  const search = page.getByRole('textbox').first()

  // One tenth of the 427 filler rows carry the `zu` stem: i % 10 === 9, i.e.
  // 9 through 419, which is 42 of them.
  await search.fill('filler zu')
  await expect.poll(() => offeredCount(page)).toBe(42)

  await search.fill(EXOTIC.name)
  await expect(page.getByRole('option')).toHaveCount(1)

  // The key is searchable too, for whoever already has one in hand — a pasted
  // URL, a bug report — even though it is never rendered.
  await search.fill(EXOTIC.lang)
  await expect(page.getByRole('option')).toHaveCount(1)
  await expect(page.getByRole('option')).toHaveText(EXOTIC.name)

  await search.fill('no such language')
  await expect(page.getByRole('option')).toHaveCount(0)
})

test('selecting an exotic language starts a run on it', async ({ page }) => {
  await openLanguagePicker(page)

  await page.getByRole('textbox').first().fill(EXOTIC.lang)
  await page.getByRole('option', { name: EXOTIC.name, exact: true }).click()

  // The picker closed and the trigger now reads the catalogue's name for it.
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(page.getByTestId('language-picker')).toHaveText(EXOTIC.name)

  // The run is real: the body was fetched by hash and words were generated from
  // it. `zu` is the stem every word in this filler dictionary starts with, so
  // the field is provably showing THIS language rather than the previous one.
  await page.waitForFunction(
    () =>
      (document.querySelector('.game__host')?.shadowRoot?.querySelectorAll('.word').length ?? 0) > 0
  )
  const firstWord = await page.evaluate(() =>
    window
      .__visibleText!(document.querySelector('.game__host')?.shadowRoot?.querySelector('.word'))
      .trim()
  )
  expect(firstWord).toMatch(/^zu\d+$/)
})
