import { expect, test, type Page } from '@playwright/test'
import { stubDictionaries } from './fixtures/dictionaries'

/**
 * Regression: a TIMED run restarted via Ctrl+Enter must still finish.
 *
 * The keyup of the very combo that restarts the test lands on the freshly
 * set-up core as v2 keystroke telemetry and pins the event-time anchor
 * hundreds of ms before the first insert starts the run. The timer worker
 * reports elapsed-since-start; without the `timerStartT` offset in the store
 * the worker's terminal tick landed short of `startedAt + durationMs`, the
 * worker stopped, and the run hung in `running` forever.
 */

async function typeActiveWord(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const root = (document.querySelector('.game__host') as HTMLElement).shadowRoot as ShadowRoot
    const input = document.querySelector('.game-input') as HTMLTextAreaElement
    const raf = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const el = root.querySelector<HTMLElement>('.word.active')
    if (!el) return
    const text = (el.textContent ?? '').replace(/\s+/g, '')
    for (const ch of text) {
      input.dispatchEvent(
        new InputEvent('beforeinput', {
          inputType: 'insertText',
          data: ch,
          bubbles: true,
          cancelable: true
        })
      )
      await raf()
    }
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true })
    )
    await raf()
  })
}

test('a Ctrl+Enter-restarted timed run finishes at its deadline', async ({ page }) => {
  test.setTimeout(90_000)
  await page.addInitScript(() => {
    window.localStorage.setItem('cookieConsentGiven', 'true')
  })
  await stubDictionaries(page)
  await page.goto('/')
  await page.waitForFunction(
    () =>
      (document.querySelector('.game__host')?.shadowRoot?.querySelectorAll('.word').length ?? 0) > 0
  )
  await page.locator('[aria-label="mode"]').getByText('time', { exact: true }).click()
  await page.locator('[aria-label="amount"]').getByText('15', { exact: true }).click()
  await page.waitForTimeout(400)

  // Start a run, then restart it mid-flight with the advertised combo. The
  // combo's keyup is the poisoned telemetry event this test exists for.
  await typeActiveWord(page)
  await page.keyboard.press('Control+Enter')
  await page.waitForFunction(
    () =>
      (document.querySelector('.game__host')?.shadowRoot?.querySelectorAll('.word').length ?? 0) > 0
  )
  await page.waitForTimeout(300)

  // One word starts the restarted run; the 15s clock must then settle it even
  // with the player idle — the terminal tick is the whole point.
  await typeActiveWord(page)
  await expect(page.getByTestId('results-score')).toBeVisible({ timeout: 20_000 })
})
