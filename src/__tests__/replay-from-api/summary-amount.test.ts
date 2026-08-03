/**
 * `summaryAmountOf` — the one `ResultSummary.amount` rule shared by the solo
 * page, the match results and the public replay. Pins the regression that
 * motivated it: a quote replay used to read the generation `length`, which a
 * quote deliberately stores as 0, and reported "amount: 0".
 */
import { describe, expect, it } from 'vitest'

import { summaryAmountOf } from '@/features/test/results'

describe('summaryAmountOf', () => {
  it('counts seconds in time mode', () => {
    expect(
      summaryAmountOf({ mode: 'time', isQuote: false, seconds: 30, wordTarget: 50, quoteWords: 0 })
    ).toBe(30)
  })

  it('counts the configured target in words mode', () => {
    expect(
      summaryAmountOf({ mode: 'words', isQuote: false, seconds: 0, wordTarget: 25, quoteWords: 0 })
    ).toBe(25)
  })

  it('counts the typed text itself for a quote — never the generation length of 0', () => {
    expect(
      summaryAmountOf({ mode: 'quote', isQuote: true, seconds: 0, wordTarget: 0, quoteWords: 17 })
    ).toBe(17)
  })

  it('lets the quote flag win over the mode string (a race replay of a quote)', () => {
    expect(
      summaryAmountOf({ mode: 'time', isQuote: true, seconds: 60, wordTarget: 0, quoteWords: 12 })
    ).toBe(12)
  })
})
