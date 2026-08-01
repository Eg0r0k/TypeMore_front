import { expect, test } from '@playwright/test'

import { WORDS_SHADOW_STYLES } from '../src/widgets/test/game-styles'

/**
 * Layout invariance of the display canaries, on REAL browser layout (the unit
 * suite can only pin span counts — happy-dom has no metrics).
 *
 * The contract: weaving the invisible codepoint into a letter span changes NO
 * geometry — per-span offsetWidth/offsetHeight and the whole word box are
 * byte-equal to the canary-free render. That must hold:
 *  - for both canary codepoints (U+200B and U+2063);
 *  - in LTR and RTL runs (both are bidi-neutral, so the visual order and the
 *    measured advance must not move);
 *  - under the exact stylesheet the field injects into its shadow root, i.e.
 *    the same font stack — a font with no glyph for a default-ignorable
 *    codepoint MUST still shape it to zero width (the tofu check: a canary
 *    that renders a hollow box would widen its span and fail here).
 */
const CASES: { label: string; word: string; dir: 'ltr' | 'rtl'; slot: number }[] = [
  { label: 'LTR latin', word: 'question', dir: 'ltr', slot: 5 },
  { label: 'LTR cyrillic', word: 'привет', dir: 'ltr', slot: 2 },
  { label: 'RTL arabic', word: 'مرحبا', dir: 'rtl', slot: 3 },
  { label: 'RTL hebrew', word: 'שלום', dir: 'rtl', slot: 2 },
  // CJK: full-width glyphs, and the fallback font that carries them is not the
  // one that carries latin. A default-ignorable codepoint has to shape to zero
  // width THERE too — and these are also the scripts whose words most often sit
  // under the canary's 4-character floor, so the few that clear it must render
  // exactly like their canary-free twin.
  { label: 'CJK hangul', word: '한글입력', dir: 'ltr', slot: 2 },
  { label: 'CJK hanzi', word: '房子窗户', dir: 'ltr', slot: 3 },
  { label: 'CJK kana', word: 'にんげん', dir: 'ltr', slot: 1 }
]
const GRAPHEMES: { label: string; grapheme: string }[] = [
  { label: 'U+200B', grapheme: '\u200b' },
  { label: 'U+2063', grapheme: '\u2063' }
]

for (const { label, word, dir, slot } of CASES) {
  for (const g of GRAPHEMES) {
    test(`canary ${g.label} is layout-invariant on a ${label} word`, async ({ page }) => {
      await page.goto('about:blank')
      const metrics = await page.evaluate(
        ({ styles, word, dir, slot, grapheme }) => {
          const host = document.createElement('div')
          document.body.appendChild(host)
          const root = host.attachShadow({ mode: 'open' })
          const style = document.createElement('style')
          style.textContent = styles
          root.appendChild(style)

          const build = (withCanary: boolean) => {
            const words = document.createElement('div')
            words.className = 'game__words'
            words.dir = dir
            const box = document.createElement('div')
            box.className = 'word active'
            for (let i = 0; i < word.length; i++) {
              const span = document.createElement('span')
              span.className = 'letter'
              span.textContent = word[i] + (withCanary && i === slot - 1 ? grapheme : '')
              box.appendChild(span)
            }
            words.appendChild(box)
            root.appendChild(words)
            return box
          }

          const plain = build(false)
          const trapped = build(true)
          const boxOf = (el: HTMLElement) => ({ w: el.offsetWidth, h: el.offsetHeight })
          const spansOf = (el: HTMLElement) =>
            Array.from(el.querySelectorAll<HTMLElement>('.letter')).map(boxOf)
          return {
            plainWord: boxOf(plain),
            trappedWord: boxOf(trapped),
            plainSpans: spansOf(plain),
            trappedSpans: spansOf(trapped),
            // Sanity: the canary really is in the DOM text of the trapped copy.
            trappedText: trapped.textContent ?? ''
          }
        },
        { styles: WORDS_SHADOW_STYLES, word, dir, slot, grapheme: g.grapheme }
      )

      expect(metrics.trappedText).toContain(g.grapheme)
      expect(metrics.plainWord.w).toBeGreaterThan(0) // layout actually happened
      expect(metrics.trappedWord).toEqual(metrics.plainWord)
      expect(metrics.trappedSpans).toEqual(metrics.plainSpans)
      expect(metrics.trappedSpans).toHaveLength(word.length)
    })
  }
}
