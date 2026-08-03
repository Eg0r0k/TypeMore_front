/**
 * `ResultSummary.amount`, one rule for the three surfaces rendering
 * `TestResults`: time counts the window's seconds, words its configured
 * target, and a quote the typed text's own words — a quote has no configured
 * amount, only the text it is.
 */
export function summaryAmountOf(input: {
  readonly mode: string
  readonly isQuote: boolean
  /** The run window in seconds (time mode). */
  readonly seconds: number
  /** The configured word target (words mode). */
  readonly wordTarget: number
  /** The typed text's own word count — a quote's only honest magnitude. */
  readonly quoteWords: number
}): number {
  if (input.isQuote) return input.quoteWords
  return input.mode === 'time' ? input.seconds : input.wordTarget
}
