import { queryOptions } from '@tanstack/vue-query'
import { queryClient } from '../query-client'
import { getQuote, getRandomQuote, listQuotes } from './endpoints'
import { quoteKeys } from './keys'
import type { Quote } from './schemas'
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
export const loadQuotePage = (params: QuotePageParams = {}) =>
  queryClient.ensureQueryData(quotePageQueryOptions(params))

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
