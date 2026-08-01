import { expect, test, type Page } from '@playwright/test'

import { dictVersion } from '@typemore/core'

import { stubDictionaries, type ExtraDictionary } from './fixtures/dictionaries'

/**
 * Caret geometry against real layout. happy-dom has no metrics, so everything
 * here is a browser-only assertion.
 *
 * Two behaviours, both reported as "the caret is wrong":
 *  - in RTL text the caret marked the wrong edge of every letter, so it sat one
 *    whole cell away from where the next glyph appears;
 *  - changing the font size left the caret at its old size until the next
 *    keystroke re-measured it for unrelated reasons.
 */

const ARABIC_WORDS = ['مرحبا', 'كتاب', 'مدرسة', 'سلام', 'شمس', 'قمر', 'بيت', 'يوم'] as const
const LATIN_WORDS = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot'] as const

const ARABIC: ExtraDictionary = {
  lang: 'arabic',
  name: 'Arabic',
  dictHash: dictVersion(ARABIC_WORDS),
  words: ARABIC_WORDS,
  rightToleft: true
}

const LATIN: ExtraDictionary = {
  lang: 'e2e_latin',
  name: 'Latin (e2e)',
  dictHash: dictVersion(LATIN_WORDS),
  words: LATIN_WORDS
}

async function openRun(page: Page, dict: ExtraDictionary): Promise<void> {
  await stubDictionaries(page, { extra: [dict] })
  await page.goto('/')
  await page.evaluate((lang) => {
    localStorage.clear()
    localStorage.setItem('cookieConsentGiven', 'true')
    localStorage.setItem(
      'config',
      JSON.stringify({
        // smoothCaret off: the caret transitions its transform, and a rect read
        // mid-transition is the ANIMATED position, not the measured one.
        config: {
          language: lang,
          mode: 'words',
          words: 10,
          quoteGroup: 'all',
          fontSize: 32,
          smoothCaret: 'off'
        }
      })
    )
  }, dict.lang)
  await page.reload()
  await page.waitForFunction(
    () =>
      (document.querySelector('.game__host')?.shadowRoot?.querySelectorAll('.word').length ?? 0) > 0
  )
  await page.locator('textarea.game-input').focus()
}

/** Caret box and the active word's box, both relative to the words container. */
const geometry = (page: Page) =>
  page.evaluate(() => {
    const root = document.querySelector('.game__host')?.shadowRoot
    const container = root?.querySelector('.game__words') as HTMLElement
    const active = root?.querySelector('.word.active') as HTMLElement
    const caret = root?.querySelector('.game__caret') as HTMLElement
    const base = container.getBoundingClientRect()
    const word = active.getBoundingClientRect()
    const box = caret.getBoundingClientRect()
    return {
      caretLeft: box.left - base.left,
      caretRight: box.right - base.left,
      caretHeight: box.height,
      wordLeft: word.left - base.left,
      wordRight: word.right - base.left
    }
  })

test.describe('RTL caret', () => {
  test('starts at the RIGHT edge of the word, not the left', async ({ page }) => {
    await openRun(page, ARABIC)
    const g = await geometry(page)
    // A mirrored word is read right-to-left, so the first character lands at its
    // right edge. Anchoring on `left` put the caret a whole word away.
    expect(Math.abs(g.caretLeft - g.wordRight)).toBeLessThan(3)
  })

  test('travels leftwards as the word is typed and ends at its left edge', async ({ page }) => {
    await openRun(page, ARABIC)
    const word = await page.evaluate(
      () =>
        (document.querySelector('.game__host')?.shadowRoot?.querySelector('.word') as HTMLElement)
          .textContent ?? ''
    )

    const start = await geometry(page)
    const seen: number[] = [start.caretLeft]
    for (const char of [...word]) {
      await page.keyboard.insertText(char)
      seen.push((await geometry(page)).caretLeft)
    }

    // Monotonically leftwards, never back.
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeLessThanOrEqual(seen[i - 1] + 1)
    // And the far end of a fully-typed word is its LEFT edge — the cell the next
    // character would occupy is beyond it, not behind it.
    const end = await geometry(page)
    expect(Math.abs(end.caretLeft - end.wordLeft)).toBeLessThan(3)
  })

  test('LTR is unchanged — left edge, travelling rightwards', async ({ page }) => {
    await openRun(page, LATIN)
    const start = await geometry(page)
    expect(Math.abs(start.caretLeft - start.wordLeft)).toBeLessThan(3)

    await page.keyboard.insertText('a')
    const after = await geometry(page)
    expect(after.caretLeft).toBeGreaterThan(start.caretLeft)
  })
})

test.describe('caret follows the type size', () => {
  test('resizes as soon as the font size changes, with nothing typed', async ({ page }) => {
    await openRun(page, LATIN)
    const before = (await geometry(page)).caretHeight
    expect(before).toBeGreaterThan(0)

    // Driven through the real control, because the mechanism is the point: the
    // size lands as a custom property on the document root, and the field's
    // viewport is a fixed 160px box, so no resize observer anywhere sees it.
    await page.getByLabel('settings', { exact: true }).first().click()
    await page.getByRole('button', { name: 'appearance', exact: true }).click()
    // The label sits on the slider ROOT; the keyboard target is its thumb.
    const slider = page.getByLabel('font size', { exact: true })
    await expect(slider).toBeVisible()
    await slider.locator('[role="slider"]').focus()
    for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Escape')

    // No keystroke into the field in between — the bug was that it took one.
    await expect.poll(async () => (await geometry(page)).caretHeight).toBeGreaterThan(before)
  })
})
