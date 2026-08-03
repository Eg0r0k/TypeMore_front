import { queryOptions } from '@tanstack/vue-query'
import { queryClient } from '../query-client'
import { getQuote, getRandomQuote, listQuotes } from './endpoints'
import { quoteKeys } from './keys'
import { quoteCorpusLang } from './lang'
import type { Quote, QuotePage } from './schemas'
import type { QuotePageParams, RandomQuoteParams } from './types'

/**
 * Layer 2 — Quote server state.
 *
 * A published quote's bytes never change (QUOTES.md, "Immutability"): a new
 * revision is a new row with a new id, never an `UPDATE`. So a quote fetched by
 * id is as immutable as a hash-addressed dictionary body, and the index only
 * moves when the corpus is re-imported.
 */
const IMMUTABLE = { staleTime: Infinity, gcTime: Infinity } as const

export const quotePageQueryOptions = (params: QuotePageParams = {}) =>
  queryOptions({
    queryKey: quoteKeys.page(params.lang, params.group, params.cursor),
    queryFn: () => listQuotes(params),
    ...IMMUTABLE
  })

/**
 * Whether a language has ANY quote to draw — the question quote mode has to ask
 * before it can be offered.
 *
 * It has to be asked because the two corpora do not cover the same key space:
 * 430 served dictionaries against 86 quote corpora, and three of the missing
 * ones are languages the catalogue lists in full (`japanese`,
 * `traditional_chinese`, `russian_empire` — QUOTES.md, "Excluded"). So "no
 * quotes here" is a normal, permanent answer about a perfectly good language,
 * not an outage.
 *
 * The index answers it with `limit: 1`: an unknown or empty `lang` is an **empty
 * page** rather than an error, which is the one shape a caller can read without
 * catching — `/random` answers the same question with a `404`, and a 404 cannot
 * be told apart from the corpus being down. The page query underneath is already
 * immutable-cached, so this is one request per language for the whole session.
 *
 * The key goes through `quoteCorpusLang`, so asking about `russian_50k` asks
 * about `russian` — the corpus a draw for it would actually hit.
 */
export const languageHasQuotesQueryOptions = (language: string) =>
  queryOptions({
    ...quotePageQueryOptions({ lang: quoteCorpusLang(language), limit: 1 }),
    select: (page: QuotePage): boolean => page.quotes.length > 0
  })

export const quoteByIdQueryOptions = (id: string) =>
  queryOptions({
    queryKey: quoteKeys.byId(id),
    queryFn: () => getQuote(id),
    ...IMMUTABLE
  })

/**
 * Imperative reads for code outside the component tree (the game page's run
 * setup). Same client, same cache, same dedupe as `useQuery`.
 */
export const loadQuoteById = (id: string): Promise<Quote> =>
  queryClient.ensureQueryData(quoteByIdQueryOptions(id))

/**
 * Draw a fresh quote — the call that starts a quote run.
 *
 * NOT a query, and it must not become one: the whole point of `/random` is that
 * the server picks, and a cache entry keyed by the filter would hand the same
 * text back on every restart. A cached random draw is a fixed draw. It still
 * warms the by-id cache, so replaying or re-resolving the quote it returned
 * costs nothing.
 */
export const loadRandomQuote = async (params: RandomQuoteParams = {}): Promise<Quote> => {
  const quote = await getRandomQuote(params)
  queryClient.setQueryData(quoteKeys.byId(quote.id), quote)
  return quote
}
