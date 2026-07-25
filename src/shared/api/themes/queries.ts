import { queryOptions } from '@tanstack/vue-query'
import { queryClient } from '../query-client'
import { listThemes } from './endpoints'
import { themeKeys } from './keys'
import type { ThemeList } from './schemas'

/**
 * Layer 2 — Themes are a build-time asset: fetched once, never refetched. The
 * sort lives in the queryFn so imperative readers get the same order as
 * `useQuery` consumers (`select` only runs for observers).
 */
export const themesQueryOptions = () =>
  queryOptions({
    queryKey: themeKeys.list(),
    queryFn: async (): Promise<ThemeList> =>
      (await listThemes()).sort((a, b) => a.name.localeCompare(b.name)),
    staleTime: Infinity,
    gcTime: Infinity
  })

/** Imperative read for code outside the component tree (theme application). */
export const loadThemes = (): Promise<ThemeList> =>
  queryClient.ensureQueryData(themesQueryOptions())
