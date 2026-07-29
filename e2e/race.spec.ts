import { expect, test, type Page } from '@playwright/test'
import { stubDictionary, stubLeaderboards, stubReplay } from './fixtures/leaderboards'

/**
 * The race-vs-run rework (C10): a race action anywhere seats the ghost on the
 * HOME solo screen — no dedicated game page. `/race/:runId` survives only as a
 * thin redirect, the settings snapshot/restore round-trips, and a race run
 * NEVER reaches POST /runs (the no-submission guard, asserted on the wire).
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('cookieConsentGiven', 'true')
  })
  await stubDictionary(page)
  await stubLeaderboards(page)
  await stubReplay(page)
})

/** Type through the field the way the input adapter hears it. */
const typeRun = (page: Page) =>
  page.evaluate(async () => {
    const root = (document.querySelector('.game__host') as HTMLElement).shadowRoot as ShadowRoot
    const input = document.querySelector('.game-input') as HTMLTextAreaElement
    const ins = (ch: string) =>
      input.dispatchEvent(
        new InputEvent('beforeinput', {
          inputType: 'insertText',
          data: ch,
          bubbles: true,
          cancelable: true
        })
      )
    const commit = () =>
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true })
      )
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    for (let w = 0; w < 40; w++) {
      const active = root.querySelector<HTMLElement>('.word.active')
      if (!active) break
      const text = (active.textContent ?? '').replace(/\s+/g, '')
      for (const ch of text) {
        ins(ch)
        await sleep(30)
      }
      commit()
      await sleep(30)
    }
  })

const configSnapshot = (page: Page) =>
  page.evaluate(() => {
    const raw = JSON.parse(window.localStorage.getItem('config') ?? '{}').config ?? {}
    const keys = ['mode', 'time', 'words', 'punctuation', 'numbers', 'difficulty', 'minWpm']
    return Object.fromEntries(keys.map((key) => [key, raw[key]]))
  })

test('a board race action runs on HOME: repeated mark, ghost pace, no submission, pace-exit restores settings', async ({
  page
}) => {
  // The wire spy: nothing on this path may POST a run.
  const submissions: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST' && /\/api\/v1\/runs\/?(\?|$)/.test(request.url())) {
      submissions.push(request.url())
    }
  })

  await page.goto('/')
  await page.waitForSelector('.settings-bar__btn')
  // Make the player's OWN setup distinctive (words mode at its own count), so
  // the restore has something real to prove against the fixture's words-10 run.
  await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll<HTMLElement>('.settings-bar__btn')).find(
      (el) => el.textContent?.trim() === 'words'
    )
    button?.click()
  })
  await expect.poll(async () => (await configSnapshot(page)).mode).toBe('words')
  const before = await configSnapshot(page)

  await page.goto('/boards')
  const first = page.getByTestId('boards-row').first()
  await expect(first).toContainText('Ada')
  await first.hover()
  await first.getByTestId('boards-action-race').click()

  // The redirect lands on HOME — there is no /race page any more. (The board's
  // bucket query survives the redirect; only the path matters here.) The
  // race's whole chrome is the standard solo bar: the red "repeated" mark (a
  // seeded record's text is pre-known) and the pace selector reading "ghost".
  await expect(page).toHaveURL(/127\.0\.0\.1:5178\/(\?|$)/)
  await expect(page.getByTestId('race-repeated')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('pace-picker')).toContainText('Ada')

  // Type the run: same words, own hands. There is no countdown — the first
  // keystroke is the starting gun for both clocks.
  await typeRun(page)

  // The results screen carries the race's "one more": race-again in the
  // bottom actions row (replacing "next test").
  await expect(page.getByTestId('results-race-again')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('results-next')).toHaveCount(0)

  // UNRANKED stays absolute: not one submission crossed the wire.
  expect(submissions).toEqual([])

  // "One more" re-seats the SAME ghost and returns to the stage, where the
  // settings bar (and so the pace selector) lives.
  await page.getByTestId('results-race-again').click()
  await expect(page.getByTestId('race-repeated')).toBeVisible()

  // Exit IS the pace selector: pick another pace mode, the ghost leaves and
  // the player's own settings come back exactly.
  await page.getByTestId('pace-picker').click()
  await page.getByRole('option', { name: 'off', exact: true }).click()
  await expect(page.getByTestId('race-repeated')).toBeHidden()
  await expect.poll(async () => await configSnapshot(page)).toEqual(before)
})

test('the deep link seats the race on HOME, and Esc re-seats the same ghost', async ({ page }) => {
  await page.goto('/race/run-ada')
  await expect(page).toHaveURL(/127\.0\.0\.1:5178\/(\?|$)/)
  // The race's only chrome: the repeated mark and the ghost-mode pace chip.
  await expect(page.getByTestId('race-repeated')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('pace-picker')).toContainText('Ada')

  // A few keystrokes start the race (no countdown gates it)…
  await page.locator('.game-input').focus()
  await page.keyboard.type('aaaa', { delay: 40 })

  // …and Esc re-seats the SAME ghost: still racing, same record.
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('race-repeated')).toBeVisible()
  await expect(page.getByTestId('pace-picker')).toContainText('Ada')
})
