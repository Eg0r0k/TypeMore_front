import { expect, test, type Page } from '@playwright/test'

import { dictVersion } from '@typemore/core'

import { stubDictionaries, type ExtraDictionary } from './fixtures/dictionaries'
import { installVisibleText } from './support/visible-text'

/**
 * IME composition against a REAL browser, driven by a REAL IME.
 *
 * The unit suite replays hand-written event sequences; only Chromium can
 * actually compose. `Input.imeSetComposition` is a CDP command — Playwright has
 * no cross-browser equivalent, and neither WebKit nor Firefox exposes one — so
 * this file is Chromium-only by necessity and the other engines are covered by
 * `src/__tests__/input-composition.test.ts`. That is a real gap, not an
 * oversight: a Firefox composition bug would have to be found by hand.
 *
 * What only this file can prove: that the events our listeners expect are the
 * events an engine actually emits, in that order. The fixtures assert our
 * handling of a sequence; this asserts the sequence.
 */

/** Korean, so a syllable is genuinely assembled rather than typed. */
const KOREAN_WORDS = [
  '한글',
  '입력',
  '하다',
  '있다',
  '되다',
  '보다',
  '주다',
  '가다',
  '오다',
  '살다'
] as const

const KOREAN: ExtraDictionary = {
  lang: 'korean',
  name: 'Korean',
  dictHash: dictVersion(KOREAN_WORDS),
  words: KOREAN_WORDS
}

/** The active word's target, read out of the shadow root. */
const activeTarget = (page: Page): Promise<string> =>
  page.evaluate(() =>
    window
      .__visibleText!(document.querySelector('.game__host')?.shadowRoot?.querySelector('.word'))
      .trim()
  )

/** What the player has actually typed into the active word. */
const typedLetters = (page: Page): Promise<number> =>
  page.evaluate(
    () =>
      document
        .querySelector('.game__host')
        ?.shadowRoot?.querySelectorAll('.word.active .letter.correct:not(.letter--dead)').length ?? 0
  )

const deadLetters = (page: Page): Promise<number> =>
  page.evaluate(
    () =>
      document.querySelector('.game__host')?.shadowRoot?.querySelectorAll('.letter--dead').length ??
      0
  )

/** The hidden capture surface must never keep anything after a session. */
const scratchValue = (page: Page): Promise<string> =>
  page.evaluate(() => (document.querySelector('textarea.game-input') as HTMLTextAreaElement).value)

async function openKoreanRun(page: Page): Promise<void> {
  await installVisibleText(page)
  await stubDictionaries(page, { extra: [KOREAN] })
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('cookieConsentGiven', 'true')
    // Straight to a short korean run: the picker is another spec's subject.
    const config = { language: 'korean', mode: 'words', words: 10, quoteGroup: 'all' }
    localStorage.setItem('config', JSON.stringify({ config }))
  })
  await page.reload()
  await page.waitForFunction(
    () =>
      (document.querySelector('.game__host')?.shadowRoot?.querySelectorAll('.word').length ?? 0) > 0
  )
  await page.locator('textarea.game-input').focus()
}

/**
 * Drive a real composition session through CDP. `stages` are the intermediate
 * strings the IME would show; the last one is committed.
 */
async function compose(page: Page, stages: readonly string[], commit: string): Promise<void> {
  const cdp = await page.context().newCDPSession(page)
  for (const text of stages) {
    await cdp.send('Input.imeSetComposition', {
      text,
      selectionStart: text.length,
      selectionEnd: text.length
    })
  }
  await cdp.send('Input.insertText', { text: commit })
  await cdp.detach()
}

test.describe('composition on a real engine', () => {
  test('a korean syllable assembled by the IME lands as typed text', async ({ page }) => {
    await openKoreanRun(page)
    const target = await activeTarget(page)
    const first = [...target][0]

    // ㅎ → 하 → 한, then commit — the shape a hangul IME really produces.
    await compose(page, ['ㅎ', '하', first], first)

    await expect.poll(() => typedLetters(page)).toBe(1)
    expect(await deadLetters(page)).toBe(0)
    expect(await scratchValue(page)).toBe('')
  })

  test('the in-flight syllable is shown before it is committed', async ({ page }) => {
    await openKoreanRun(page)

    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Input.imeSetComposition', { text: 'ㅎ', selectionStart: 1, selectionEnd: 1 })

    // Rendered, but nothing is typed yet: the session is still open.
    await expect.poll(() => deadLetters(page)).toBe(1)
    expect(await typedLetters(page)).toBe(0)

    await cdp.send('Input.imeSetComposition', { text: '', selectionStart: 0, selectionEnd: 0 })
    await cdp.detach()
  })

  test('an abandoned composition types nothing', async ({ page }) => {
    await openKoreanRun(page)

    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Input.imeSetComposition', { text: 'ㅎ', selectionStart: 1, selectionEnd: 1 })
    // An empty composition is how CDP cancels the session.
    await cdp.send('Input.imeSetComposition', { text: '', selectionStart: 0, selectionEnd: 0 })
    await cdp.detach()

    await expect.poll(() => deadLetters(page)).toBe(0)
    expect(await typedLetters(page)).toBe(0)
    expect(await scratchValue(page)).toBe('')
  })

  /**
   * The run must not hang on the final word with a session still open. An IME
   * holds one until the player types past it, and past the last word there is
   * nothing left to type — so without quick-end the composed text never reaches
   * the store and the separator that would end the run is swallowed by the
   * session instead.
   *
   * Quick-end SETTLES the session; it does not commit the word. Finishing a
   * count-mode run on its last character is what the `quickEnd` CONFIG does, and
   * conflating the two would make an IME run end differently from a typed one.
   * So the assertion is the one that matters: the text landed, and the very next
   * space finishes the run like it would for anybody else.
   */
  test('the last word does not hang on an open composition', async ({ page }) => {
    await openKoreanRun(page)

    // Type every word but the last through the ordinary path.
    const words = await page.evaluate(() =>
      [...(document.querySelector('.game__host')?.shadowRoot?.querySelectorAll('.word') ?? [])].map(
        (el) => window.__visibleText!(el).trim()
      )
    )
    for (const word of words.slice(0, -1)) {
      await page.keyboard.insertText(word)
      await page.keyboard.press('Space')
    }

    const last = words[words.length - 1]
    const cdp = await page.context().newCDPSession(page)
    // Compose the whole last word and leave the session OPEN — no commit.
    await cdp.send('Input.imeSetComposition', {
      text: last,
      selectionStart: last.length,
      selectionEnd: last.length
    })

    // Settled without the browser ever sending compositionend: the word is typed
    // and nothing is left rendering as in-flight.
    await expect.poll(() => typedLetters(page)).toBe([...last].length)
    expect(await deadLetters(page)).toBe(0)

    // And the space is not swallowed — it commits, which ends the run.
    await page.keyboard.press('Space')
    // (No scratch-buffer check here: the results screen unmounts the field, so
    // the textarea is gone by now. The other cases assert it while it exists.)
    await expect(page.getByTestId('results-score')).toBeVisible({ timeout: 10_000 })
    await cdp.detach()
  })
})
