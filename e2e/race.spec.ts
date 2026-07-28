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

test('a board race action runs on HOME: banner, ghost, verdict, no submission, exit restores settings', async ({
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
  // bucket query survives the redirect; only the path matters here.)
  await expect(page).toHaveURL(/127\.0\.0\.1:5178\/(\?|$)/)
  await expect(page.getByTestId('race-banner')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('race-banner')).toContainText('Ada')

  // 3-2-1 first: nobody's clock starts before GO.
  await expect(page.getByTestId('race-countdown')).toBeVisible()
  await expect(page.getByTestId('race-countdown')).toBeHidden({ timeout: 6_000 })

  // The ghost is typing in its compact row.
  await expect(page.getByTestId('race-opponent-wpm')).not.toHaveText('0 wpm', { timeout: 6_000 })

  // Type the run: same words, own hands.
  await typeRun(page)

  // Side-by-side result: the verdict names both numbers, over the results screen.
  await expect(page.getByTestId('race-verdict')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('race-verdict-score')).toContainText('wpm')

  // UNRANKED stays absolute: not one submission crossed the wire.
  expect(submissions).toEqual([])

  // Exit: the banner leaves and the player's own settings come back exactly.
  await page.getByTestId('race-exit').click()
  await expect(page.getByTestId('race-banner')).toBeHidden()
  await expect.poll(async () => await configSnapshot(page)).toEqual(before)
})

test('restart re-races the same ghost from 3-2-1, straight off the deep link', async ({ page }) => {
  await page.goto('/race/run-ada')
  await expect(page).toHaveURL(/127\.0\.0\.1:5178\/(\?|$)/)
  await expect(page.getByTestId('race-countdown')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByTestId('race-countdown')).toBeHidden({ timeout: 6_000 })

  // Esc = restart: the SAME ghost, a fresh 3-2-1.
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('race-countdown')).toBeVisible()
  await expect(page.getByTestId('race-banner')).toContainText('Ada')
})
