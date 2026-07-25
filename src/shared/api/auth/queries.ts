import { queryOptions } from '@tanstack/vue-query'
import { me } from './endpoints'
import { authKeys } from './keys'

/**
 * Layer 2 — Auth queryOptions factories. Components pass these straight to
 * `useQuery(...)`.
 */

export const meQueryOptions = () =>
  queryOptions({
    queryKey: authKeys.me(),
    queryFn: () => me(),
    refetchOnWindowFocus: false
  })
