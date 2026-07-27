import { expect, test, type Page } from '@playwright/test'
import { stubDictionaries } from './fixtures/dictionaries'

/**
 * The typing screen's layout invariant: the words do not move.
 *
 * The band above the field swaps its occupant the moment a run starts — the
 * settings bar leaves, the score HUD arrives, and they are not the same height.
 * The stage reserves that band's height so the swap is invisible to the eye
 * that is reading the words. It used to be kept still by pinning both with
 * `position: absolute`, which held the field still by letting the chrome sit ON
 * TOP of it — so the second assertion is the other half: reserved, not overlaid.
 */

/** Top edge of the first word, in viewport coordinates. The words are in a shadow root. */
const wordsTop = (page: Page): Promise<number> =>
  page.evaluate(
    () =>
      document
        .querySelector('.game__host')
        ?.shadowRoot?.querySelector('.word')
        ?.getBoundingClientRect().top ?? -1
  )

test.beforeEach(async ({ page }) => {
  await stubDictionaries(page)
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('cookieConsentGiven', 'true')
  })
  await page.reload()
  await page.waitForSelector('.settings-bar__btn')
  await page.waitForFunction(
    () =>
      (document.querySelector('.game__host')?.shadowRoot?.querySelectorAll('.word').length ?? 0) > 0
  )
})

test('nothing in the settings moves the words', async ({ page }) => {
  const anchor = await wordsTop(page)
  expect(anchor).toBeGreaterThan(0)

  const settle = async (): Promise<number> => {
    await page.waitForFunction(
      () =>
        (document.querySelector('.game__host')?.shadowRoot?.querySelectorAll('.word').length ?? 0) >
        0
    )
    await page.waitForTimeout(250)
    return wordsTop(page)
  }

  // Every one of these rebuilds the test, and three of them change the height of
  // what is drawn above it (the amount group, the greyed-out mods with their
  // explanation, a longer language name).
  await page.getByTestId('restart-test').click()
  expect(await settle()).toBe(anchor)

  await page.locator('[aria-label="mode"]').getByText('words', { exact: true }).click()
  expect(await settle()).toBe(anchor)

  await page.locator('[aria-label="amount"]').getByText('100', { exact: true }).click()
  expect(await settle()).toBe(anchor)

  await page.getByRole('button', { name: 'blind', exact: true }).click()
  expect(await settle()).toBe(anchor)
})

test('the words stay put when the run starts', async ({ page }) => {
  const before = await wordsTop(page)
  expect(before).toBeGreaterThan(0)

  // One keystroke: the settings bar goes, the score HUD comes.
  await page.keyboard.press('KeyA')
  await expect(page.locator('.settings-bar')).toBeHidden()

  expect(await wordsTop(page)).toBe(before)
})

test('the settings bar sits above the words rather than over them', async ({ page }) => {
  const bar = await page.locator('.settings-bar').boundingBox()
  const top = await wordsTop(page)

  expect(bar).not.toBeNull()
  expect(bar!.y + bar!.height).toBeLessThanOrEqual(top)
})
