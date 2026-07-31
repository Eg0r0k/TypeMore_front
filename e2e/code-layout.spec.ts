import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { stubDictionaries } from './fixtures/dictionaries'
import { installVisibleText } from './support/visible-text'

test.beforeEach(async ({ page }) => {
  await installVisibleText(page)
})

/**
 * Code-quote layout, on the exact text from the owner's report.
 *
 * `generateWords` splits a quote's text on spaces, so this text's newlines land
 * mid-target and its tabs never start one. The field therefore cuts a target
 * into one box per visual line — this spec pins the RESULT of that (real line
 * breaks at every newline, indented continuations) rather than the mechanism,
 * plus the node budget and the keystroke budget over Enter/Tab input.
 */
const TEXT = 'p.center {\n\ttext-align: center;\n\tcolor: red;\n}\n\np.large {\n\tfont-size: 300%\n;}'

/** The eight lines the source has, in order. Spaces are word gaps, not glyphs. */
const EXPECTED_LINES = [
  'p.center{↵',
  '→text-align:center;↵',
  '→color:red;↵',
  '}↵',
  '↵',
  'p.large{↵',
  '→font-size:300%↵',
  ';}'
]

const QUOTE = {
  id: '34173500-3ac6-4edb-a21b-00f02c1acf6e',
  lang: 'code_css',
  upstreamId: 3,
  source: 'W3Schools CSS Class Selector',
  length: TEXT.length,
  lenGroup: 'short',
  textHash: 'e5a563fc',
  text: TEXT,
  superseded: false
}

async function openQuoteRun(page: Page): Promise<void> {
  await stubDictionaries(page)
  await page.route('**/api/v1/quotes/random*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(QUOTE) })
  )
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.setItem('cookieConsentGiven', 'true')
    const raw = JSON.parse(localStorage.getItem('config') ?? '{}') as {
      config?: Record<string, unknown>
    }
    const config = raw.config ?? {}
    config.mode = 'quote'
    config.language = 'code_css'
    config.quoteGroup = 'all'
    localStorage.setItem('config', JSON.stringify({ ...raw, config }))
  })
  await page.reload()
  await page.waitForFunction(
    () =>
      (document.querySelector('.game__host')?.shadowRoot?.querySelectorAll('.word').length ?? 0) > 0
  )
}

/** Group the rendered boxes into visual lines by their measured top edge. */
async function linesOf(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const root = (document.querySelector('.game__host') as HTMLElement).shadowRoot as ShadowRoot
    const byTop = new Map<number, string[]>()
    for (const box of root.querySelectorAll<HTMLElement>('.word')) {
      const top = Math.round(box.getBoundingClientRect().top)
      const bucket = byTop.get(top) ?? []
      bucket.push(window.__visibleText!(box).replace(/\s+/g, ''))
      byTop.set(top, bucket)
    }
    return [...byTop.entries()].sort((a, b) => a[0] - b[0]).map(([, texts]) => texts.join(''))
  })
}

test('a code quote breaks at every newline and indents every tab', async ({ page }) => {
  await openQuoteRun(page)

  expect(await linesOf(page)).toEqual(EXPECTED_LINES)
})

test('every newline glyph ends its visual line, and the tab is a real indent', async ({ page }) => {
  await openQuoteRun(page)

  const result = await page.evaluate(() => {
    const root = (document.querySelector('.game__host') as HTMLElement).shadowRoot as ShadowRoot
    const boxes = [...root.querySelectorAll<HTMLElement>('.word')]
    const top = (el: HTMLElement) => Math.round(el.getBoundingClientRect().top)

    // A box whose text ends in the newline glyph must be the last one on its line.
    const newlineBoxesThatAreNotLast = boxes.filter((box, i) => {
      if (!window.__visibleText!(box).endsWith('↵')) return false
      const next = boxes[i + 1]
      return next !== undefined && top(next) === top(box)
    }).length

    const tab = root.querySelector<HTMLElement>('.letter--tab')
    const plain = [...root.querySelectorAll<HTMLElement>('.letter')].find(
      (l) => !l.classList.contains('letter--ws')
    )

    return {
      newlineBoxesThatAreNotLast,
      lineCount: new Set(boxes.map(top)).size,
      boxCount: boxes.length,
      tabWidth: tab?.offsetWidth ?? 0,
      letterWidth: plain?.offsetWidth ?? 0,
      // A target that opens with a tab must open its line: nothing to its left.
      indentedNotAtLineStart: boxes.filter(
        (box, i) =>
          window.__visibleText!(box).startsWith('→') && i > 0 && top(boxes[i - 1]) === top(box)
      ).length
    }
  })

  expect(result.newlineBoxesThatAreNotLast).toBe(0)
  expect(result.indentedNotAtLineStart).toBe(0)
  expect(result.lineCount).toBe(EXPECTED_LINES.length)
  // 13 targets for this text; the corridor stays bounded, not one box per char.
  expect(result.boxCount).toBe(13)
  // One tab stop is several characters wide — this is the indent, not a glyph.
  expect(result.tabWidth).toBeGreaterThan(result.letterWidth * 2)
})

test('typing the quote through Enter and Tab keeps the keystroke budget and skips nothing', async ({
  page
}) => {
  await openQuoteRun(page)

  const result = await page.evaluate(async (text: string) => {
    const root = () => (document.querySelector('.game__host') as HTMLElement).shadowRoot as ShadowRoot
    const input = document.querySelector('.game-input') as HTMLTextAreaElement
    input.focus()
    const raf = () => new Promise<void>((r) => requestAnimationFrame(() => r()))

    const key = (init: KeyboardEventInit) =>
      input.dispatchEvent(new KeyboardEvent('keydown', { ...init, bubbles: true, cancelable: true }))
    const insert = (data: string) =>
      input.dispatchEvent(
        new InputEvent('beforeinput', {
          inputType: 'insertText',
          data,
          bubbles: true,
          cancelable: true
        })
      )

    const counter = globalThis as { __wordUpdates?: number }
    let worstUpdates = 0
    let maxBoxes = 0

    // Type the text exactly as a player would: Tab for indentation, Enter at a
    // line end, Space between words, characters otherwise.
    for (const char of text) {
      counter.__wordUpdates = 0
      if (char === '\t') key({ key: 'Tab' })
      else if (char === '\n') key({ key: 'Enter' })
      else if (char === ' ') key({ key: ' ', code: 'Space' })
      else insert(char)
      await raf()
      worstUpdates = Math.max(worstUpdates, counter.__wordUpdates ?? 0)
      maxBoxes = Math.max(maxBoxes, root().querySelectorAll('.word').length)
    }
    delete counter.__wordUpdates
    await raf()

    return {
      worstUpdates,
      maxBoxes,
      // Nothing was truncated or skipped: no box carries the error underline.
      erroredBoxes: root().querySelectorAll('.word--error').length
    }
  }, TEXT)

  // The fence: at most two Word components re-render per keystroke.
  expect(result.worstUpdates).toBeLessThanOrEqual(2)
  expect(result.maxBoxes).toBeLessThanOrEqual(60)
  // The word-skip regression: a mid-target newline must not commit its target.
  expect(result.erroredBoxes).toBe(0)
})
