import { expect, test } from '@playwright/test'
import { stubDictionaries } from './fixtures/dictionaries'

/**
 * Full lobby → match → results loop over the in-page LoopbackTransport
 * (`?mp=loopback`, dev/E2E builds only — the Playwright web server runs vite
 * dev, so `import.meta.env.DEV` satisfies the gate). No backend is required:
 * `window.__tmLoopback.addBot()` seats a scripted protocol-honest bot in the
 * page's current room.
 *
 * Flow under test: /servers → create room → host sets words/10 (fast match)
 * → addBot() joins + auto-readies → start → 3-2-1 countdown overlay → type
 * the real text through the same shadow-DOM harness as perf.spec.ts → both
 * players finish → standings table ranks both → re-ready returns to lobby.
 * Console errors collected across the whole flow must be empty.
 */
test('loopback lobby: create → bot joins → race → standings → re-ready', async ({ page }) => {
  test.setTimeout(90_000)

  // Environment noise, not app errors: the REST backend is absent in this
  // harness (VITE_API_URL → dead localhost:8090 ⇒ CORS/net failures on /me)
  // and the external recaptcha script fails its integrity check offline.
  // Dictionaries also come from that backend now, so they are stubbed below —
  // everything else must be clean.
  const IGNORED_SOURCES = ['localhost:8090', 'recaptcha']
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const source = `${msg.location().url} ${msg.text()}`
    if (IGNORED_SOURCES.some((needle) => source.includes(needle))) return
    consoleErrors.push(msg.text())
  })
  page.on('pageerror', (error) => {
    consoleErrors.push(`pageerror: ${error.message}`)
  })

  // Word lists come from the server; this harness has none, so stub the two
  // public dictionary endpoints before the app boots.
  await stubDictionaries(page)

  // Seed consent before app boot: the cookie dialog is modal (background goes
  // inert for role queries). Same approach as perf.spec.ts's replay test.
  await page.goto('/servers?mp=loopback')
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('cookieConsentGiven', 'true')
  })
  await page.reload()

  // Loopback connects instantly; the create-room control unlocks on `idle`.
  const createButton = page.getByRole('button', { name: 'Create room' })
  await expect(createButton).toBeEnabled()
  await createButton.click()

  // Seated → routed to /room; the players list shows the single host seat.
  await page.waitForURL('**/room')
  await expect(page.locator('.players__list li')).toHaveCount(1)

  // Host settings: words mode with the smallest count keeps the race short.
  // (Each settings_update resets ready flags; the bot re-readies on its own.)
  await page.locator('[aria-label="mode"]').getByText('words', { exact: true }).click()
  await expect(page.locator('[aria-label="word count"]')).toBeVisible()
  await page.locator('[aria-label="word count"]').getByText('10', { exact: true }).click()

  // Fake opponent: joins the page's current room and auto-readies.
  await page.evaluate(() => {
    const w = window as unknown as {
      __tmLoopback: { addBot(options?: { wpm?: number }): Promise<void> }
    }
    return w.__tmLoopback.addBot({ wpm: 90 })
  })
  await expect(page.locator('.players__list li')).toHaveCount(2)
  await expect(page.locator('.players__list .seat__ready')).toHaveCount(1)

  // Start gate satisfied (2 seats, non-host ready) → countdown overlay.
  const startButton = page.getByTestId('start-button')
  await expect(startButton).toBeEnabled()
  await startButton.click()
  await expect(page.locator('.room-match__countdown')).toBeVisible()

  // Field mounts during countdown; typing starts once the overlay clears (go).
  await page.waitForFunction(
    () =>
      (document.querySelector('.game__host')?.shadowRoot?.querySelectorAll('.word').length ?? 0) > 0
  )
  await expect(page.locator('.room-match__countdown')).toBeHidden({ timeout: 10_000 })

  // Type every word to completion — perf.spec.ts's shadow-DOM harness: words
  // live in the open shadow root of .game__host, driven via beforeinput
  // (insertText) + a Space keydown commit on the hidden .game-input.
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

    // Bounded loop — 10 words plus slack; stops when the field finishes.
    for (let w = 0; w < 20; w++) {
      const el = activeEl()
      if (!el) break
      const text = (el.textContent ?? '').replace(/\s+/g, '')
      for (const ch of text) {
        ins(ch)
        await raf()
      }
      commit()
      await raf()
      await raf()
    }
  })

  // Both players terminal → results. The 90-wpm bot needs a few seconds.
  await expect(page.getByTestId('re-ready-button')).toBeVisible({ timeout: 30_000 })

  // Standings: both players present and ranked, self row marked.
  const rows = page.locator('.standings__table tbody tr')
  await expect(rows).toHaveCount(2)
  await expect(rows.nth(0).locator('.standings__rank')).toHaveText('1')
  await expect(rows.nth(1).locator('.standings__rank')).toHaveText('2')
  await expect(page.getByTestId('standings-self')).toHaveCount(1)

  // Re-ready → back to the lobby grid with both seats still in the room.
  await page.getByTestId('re-ready-button').click()
  await expect(page.locator('.players__list li')).toHaveCount(2)
  await expect(page.getByTestId('start-button')).toBeVisible()

  expect(consoleErrors).toEqual([])
})
