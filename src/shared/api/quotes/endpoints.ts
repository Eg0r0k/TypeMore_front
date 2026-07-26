import { request } from '../transport'
import { QuotePageSchema, QuoteSchema, type Quote, type QuotePage } from './schemas'
import type { QuotePageParams, RandomQuoteParams } from './types'

/**
 * Layer 1 — Quote registry endpoints, mirroring the backend's `docs/QUOTES.md`.
 * All three are public: a guest picking a text to type has no account yet,
 * exactly as with the dictionary catalogue.
 *
 * `undefined` query values are dropped by the transport, so an omitted filter
 * is an absent parameter — never `?group=undefined`, which the server would
 * reject with a `400`.
 */

/** `GET /quotes` — a page of metadata. Never the text. */
export const listQuotes = (params: QuotePageParams = {}): Promise<QuotePage> =>
  request('/quotes', QuotePageSchema, {
    query: { lang: params.lang, group: params.group, cursor: params.cursor, limit: params.limit }
  })

/**
 * `GET /quotes/random` — one quote WITH its text. Starting a quote run is this
 * call. A `404` means the filter matched nothing (e.g. no thicc german), which
 * is a real answer the caller must render, not a transport failure.
 */
export const getRandomQuote = (params: RandomQuoteParams = {}): Promise<Quote> =>
  request('/quotes/random', QuoteSchema, { query: { lang: params.lang, group: params.group } })

/**
 * `GET /quotes/{id}` — one quote by id, retired revisions included. This is how
 * a finished run resolves the text it was played on, long after that text was
 * superseded.
 */
export const getQuote = (id: string): Promise<Quote> =>
  request(`/quotes/${encodeURIComponent(id)}`, QuoteSchema)
