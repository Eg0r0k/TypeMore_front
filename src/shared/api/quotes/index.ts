/** Quotes domain — public surface. */
export { quoteKeys } from './keys'
export {
  quotePageQueryOptions,
  languageHasQuotesQueryOptions,
  quoteByIdQueryOptions,
  loadQuotePage,
  loadQuoteById,
  loadRandomQuote
} from './queries'

export { quoteCorpusLang, isSizeVariant } from './lang'

export { QuoteLengthGroupSchema, QuoteMetaSchema, QuotePageSchema, QuoteSchema } from './schemas'
export type { QuoteLengthGroup, QuoteMeta, QuotePage, Quote } from './schemas'
export type { QuotePageParams, RandomQuoteParams } from './types'
