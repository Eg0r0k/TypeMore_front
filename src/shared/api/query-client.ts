import { QueryClient, type QueryClientConfig } from '@tanstack/vue-query'
import { isApiError } from './transport'

/**
 * Layer 2 — QueryClient defaults.
 *
 * `refetchOnWindowFocus: false` app-wide, and `retry` never re-runs a query on a
 * 4xx (transport already sets `retry: 0`, so this governs query-level re-fetch
 * of transient network/5xx failures only).
 */
const MAX_QUERY_RETRIES = 2

export const shouldRetry = (failureCount: number, error: unknown): boolean => {
  if (isApiError(error) && error.status >= 400 && error.status < 500) return false
  return failureCount < MAX_QUERY_RETRIES
}

export const queryClientConfig: QueryClientConfig = {
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: shouldRetry
    },
    mutations: {
      retry: false
    }
  }
}

/** Standalone client for use outside the Vue component tree (tests, prefetch). */
export const queryClient = new QueryClient(queryClientConfig)
