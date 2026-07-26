/** Quotes domain — public surface. */
export { quoteKeys } from './keys'
export {
  quotePageQueryOptions,
  quoteByIdQueryOptions,
  loadQuotePage,
  loadQuoteById,
  loadRandomQuote
} from './queries'

export { QuoteLengthGroupSchema, QuoteMetaSchema, QuotePageSchema, QuoteSchema } from './schemas'
export type { QuoteLengthGroup, QuoteMeta, QuotePage, Quote } from './schemas'
export type { QuotePageParams, RandomQuoteParams } from './types'
