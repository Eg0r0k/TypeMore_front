import { expect, test } from '@playwright/test'
import { stubDictionaries } from './fixtures/dictionaries'
import { installVisibleText } from './support/visible-text'

test.beforeEach(async ({ page }) => {
  await installVisibleText(page)
})

/**
 * Guest save-hint gate (functional, NOT a perf budget). A signed-out visitor who
 * finishes a ranked-eligible run (words mode — the default) must see the subtle
 * "sign in to save" link on the results screen, never a silent auto-save. The
 * link routes to /login (verified via the results component's `signin` emit).
 *
 * Reuses `perf.spec.ts`'s shadow-DOM typing harness: words live inside the open
 * shadow root of `.game__host`, and the field is driven with `beforeinput`
 * (insertText) + a Space `keydown` commit. No backend is required — with no
 * session, `/me` resolves the auth store to `guest`, which is exactly the state
 * under test.
 */
test('guest who finishes a ranked run sees the sign-in-to-save hint', async ({ page }) => {
  // Word lists come from the Go server; this harness has no backend.
  await stubDictionaries(page)
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForSelector('.settings-bar__btn')

  // Drive the settings bar itself so the config-store rebuild watcher runs.
  const clickBarButton = (label: string) =>
    page.evaluate((text) => {
      const button = Array.from(document.querySelectorAll<HTMLElement>('.settings-bar__btn')).find(
        (el) => el.textContent?.trim() === text
      )
      button?.click()
    }, label)

  // Shortest ranked-eligible run: words mode with the 10-word preset.
  await clickBarButton('words')
  await page.waitForTimeout(80)
  await clickBarButton('10')
  await page.waitForFunction(
    () =>
      (document.querySelector('.game__host')?.shadowRoot?.querySelectorAll('.word').length ?? 0) > 0
  )

  const wordCount = await page.evaluate(
    () => JSON.parse(localStorage.getItem('config') ?? '{}').config?.words
  )
  expect(wordCount).toBe(10)

  // Type every word to completion; committing the final word finishes the run.
  await page.evaluate(async () => {
    const root = (document.querySelector('.game__host') as HTMLElement).shadowRoot as ShadowRoot
    const input = document.querySelector('.game-input') as HTMLTextAreaElement
    const activeEl = () => root.querySelector<HTMLElement>('.word.active')
    const raf = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
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

    // Bounded loop — 10 words plus slack; stops as soon as the field is done.
    for (let w = 0; w < 20; w++) {
      const el = activeEl()
      if (!el) break
      const text = window.__visibleText!(el).replace(/\s+/g, '')
      for (const ch of text) {
        ins(ch)
        await raf()
      }
      commit()
      await raf()
      await raf()
    }
  })

  // The results screen replaces the field; the guest hint is present, labeled,
  // and rendered as an actionable control (routes to sign-in).
  const hint = page.locator('[data-testid="save-signin"]')
  await expect(hint).toBeVisible()
  await expect(hint).toHaveText('sign in to save')
})
