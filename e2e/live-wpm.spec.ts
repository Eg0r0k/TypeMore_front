import { expect, test } from '@playwright/test'
import { stubDictionaries } from './fixtures/dictionaries'
import { installVisibleText } from './support/visible-text'

/**
 * The live speed over the first second of a run.
 *
 * It used to read `0 wpm` on the very first keystroke — the window is zero wide
 * there, and the formula's guard reports that as a speed rather than as no
 * reading — and then `117` on the second, two characters divided by 200ms, from
 * where it spent half a minute falling towards the truth while the player typed
 * at a perfectly steady pace.
 *
 * The denominator is now held at one second until the run has lasted one, so
 * the reading climbs from nothing to the real speed as the characters arrive.
 * Both halves of that are asserted below, because either one alone is easy to
 * satisfy by accident.
 */
test('the live speed climbs to the real one instead of spiking past it', async ({ page }) => {
  await installVisibleText(page)
  await stubDictionaries(page)
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('cookieConsentGiven', 'true')
  })
  await page.reload()
  await page.waitForSelector('.settings-bar')
  await page.waitForFunction(
    () =>
      (document.querySelector('.game__host')?.shadowRoot?.querySelectorAll('.word').length ?? 0) > 0
  )

  // One character every 200ms — a steady 60 wpm, so the reading has an obvious
  // right answer to be measured against.
  const readings = await page.evaluate(async () => {
    const root = (document.querySelector('.game__host') as HTMLElement).shadowRoot as ShadowRoot
    const input = document.querySelector('.game-input') as HTMLTextAreaElement
    const visibleText = (window as unknown as { __visibleText: (el: HTMLElement) => string })
      .__visibleText
    const activeWord = () => root.querySelector<HTMLElement>('.word.active')
    const type = (char: string): void => {
      input.dispatchEvent(
        new InputEvent('beforeinput', {
          inputType: 'insertText',
          data: char,
          bubbles: true,
          cancelable: true
        })
      )
    }
    const commit = (): void => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true })
      )
    }
    const sleep = (ms: number): Promise<unknown> => new Promise((r) => setTimeout(r, ms))
    const wpm = (): number =>
      Number.parseInt(document.querySelector('.score-hud__speed')?.textContent ?? '', 10)

    const firstSecond: number[] = []
    const started = performance.now()
    let settled = 0

    for (let word = 0; word < 6; word++) {
      const element = activeWord()
      if (!element) break
      for (const char of visibleText(element).replace(/\s+/g, '')) {
        type(char)
        await sleep(200)
        const elapsed = performance.now() - started
        if (elapsed < 1000) firstSecond.push(wpm())
        settled = wpm()
      }
      commit()
      await sleep(200)
    }
    return { firstSecond, settled }
  })

  const { firstSecond, settled } = readings
  expect(firstSecond.length).toBeGreaterThan(2)

  // Never zero once a key has been pressed: characters have been typed, and
  // "no window yet" is not a speed of nought.
  expect(Math.min(...firstSecond)).toBeGreaterThan(0)

  // Never above the truth. With the denominator pinned at a second the reading
  // can only rise as characters land, so it approaches the real speed from
  // below rather than overshooting it and sagging back.
  for (let i = 1; i < firstSecond.length; i++) {
    expect(firstSecond[i]).toBeGreaterThanOrEqual(firstSecond[i - 1]!)
  }
  expect(Math.max(...firstSecond)).toBeLessThanOrEqual(settled + 5)

  // And the steady reading is the speed that was actually typed.
  expect(settled).toBeGreaterThan(45)
  expect(settled).toBeLessThan(80)
})
