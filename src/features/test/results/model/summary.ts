/**
 * `ResultSummary.amount` — the run's magnitude, ONE rule for the three
 * surfaces that render `TestResults` (the solo page, the match results, the
 * public replay): time mode counts the window's seconds, words mode counts
 * its configured target, and a QUOTE counts the typed text's own words.
 *
 * A quote has no configured amount, and each surface used to substitute its
 * own number — the solo page the text's length, the match the host's drawn
 * `wordCount`, the replay the generation `length` a quote deliberately stores
 * as 0 — so the same run reported three different magnitudes, one of them
 * always zero.
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
