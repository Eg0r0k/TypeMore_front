/**
 * Public API surface. Components import ONLY from here.
 *
 * Layout: transport + query-client are cross-cutting core; everything else
 * lives in a domain folder (`auth/`, `runs/`, `dictionaries/`, `themes/`,
 * `leaderboards/`, `quotes/`, `rooms/`) that
 * owns its schemas, request types, endpoints, cache keys, queries and
 * mutations. A new domain is a new folder plus one line here — no existing
 * file grows.
 *
 * Endpoint functions stay internal: components reach the server through the
 * query/mutation layer, either reactively (`useQuery(xQueryOptions())`) or
 * imperatively outside setup (`loadX()`, which shares the same cache). The one
 * exception is `oauthStartUrl`, a URL builder for a full-page redirect.
 */
export * from './auth'
export * from './runs'
export * from './dictionaries'
export * from './themes'
export * from './leaderboards'
export * from './quotes'
export * from './rooms'
export * from './profile'
export * from './users'

export { queryClient } from './query-client'
export { API_SCOPE } from './keys'

export { ApiError, isApiError } from './transport'
export type { ApiErrorShape } from './transport'
