/** Layer 1 — Quote request types. */
import type { QuoteLengthGroup } from './schemas'

/**
 * A page of the quote index. Both filters are optional; an unknown `lang` is an
 * empty page, an unknown `group` is a `400` — which is why `group` is typed as
 * the picklist rather than a bare string. `limit` defaults to 50 server-side
 * and is clamped to `[1, 200]`.
 */
export interface QuotePageParams {
  readonly lang?: string
  readonly group?: QuoteLengthGroup
  readonly cursor?: string
  readonly limit?: number
}

/** The filter a run start draws through. Omitting `group` means "any length". */
export interface RandomQuoteParams {
  readonly lang?: string
  readonly group?: QuoteLengthGroup
}
