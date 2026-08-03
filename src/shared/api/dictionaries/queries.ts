import { queryOptions } from '@tanstack/vue-query'
import { queryClient } from '../query-client'
import { getDictionaryBody, listDictionaries } from './endpoints'
import { dictionaryKeys } from './keys'
import type { DictionaryBody, DictionaryCatalogue } from './schemas'

/**
 * Layer 2 — Dictionary server state.
 *
 * Word lists are hash-addressed and immutable, and the catalogue only changes
 * when the server publishes a new one — so nothing here ever goes stale within
 * a page load. The query cache IS the memoization: one in-flight request per
 * key, shared by every caller.
 */
const IMMUTABLE = { staleTime: Infinity, gcTime: Infinity } as const

export const dictionaryCatalogueQueryOptions = () =>
  queryOptions({
    queryKey: dictionaryKeys.catalogue(),
    queryFn: () => listDictionaries(),
    ...IMMUTABLE
  })

/**
 * `lang` → its human name, for the surfaces that hold a bare key and must show
 * it: the settings bar, the room panel, a leaderboard bucket. The server's
 * catalogue is the ONLY place a language is named — no client-side prettifying
 * of `code_css` into something that reads like a language.
 */
export const languageNamesQueryOptions = () =>
  queryOptions({
    ...dictionaryCatalogueQueryOptions(),
    select: (catalogue: DictionaryCatalogue): Readonly<Record<string, string>> =>
      Object.fromEntries(catalogue.map((d) => [d.lang, d.name]))
  })

/** Two hops by design: the catalogue resolves a language to its content hash. */
const fetchBody = async (lang: string): Promise<DictionaryBody> => {
  const catalogue = await loadDictionaryCatalogue()
  const entry = catalogue.find((d) => d.lang === lang)
  if (!entry) throw new Error(`No such dictionary: ${lang}`)
  return getDictionaryBody(entry.dictHash)
}

export const dictionaryBodyQueryOptions = (lang: string) =>
  queryOptions({
    queryKey: dictionaryKeys.body(lang),
    queryFn: () => fetchBody(lang),
    // No retry HERE: the catalogue hop inside `fetchBody` is a query of its own
    // and already retries. Retrying on top of it multiplies the attempts (3 × 3
    // with backoff ≈ 30s before the UI can say "no dictionary").
    retry: false,
    ...IMMUTABLE
  })

/**
 * A body by CONTENT HASH — the address a finished run recorded.
 *
 * Replay must not go through the language hop: `dictionaryBodyQueryOptions`
 * asks the catalogue what `ru-RU` means TODAY, and if that word list has been
 * republished since the run, the regenerated text would silently differ from
 * what the player actually typed. The hash names one immutable body forever, so
 * this is one request and no ambiguity — and a `404` here is the honest answer
 * that the run's dictionary is no longer published.
 */
export const dictionaryBodyByHashQueryOptions = (dictHash: string) =>
  queryOptions({
    queryKey: dictionaryKeys.bodyByHash(dictHash),
    queryFn: () => getDictionaryBody(dictHash),
    ...IMMUTABLE
  })

/**
 * Imperative reads for code outside the component tree (pinia actions, match
 * bootstrap, game setup). Same client, same cache, same dedupe as `useQuery`.
 */
export const loadDictionaryCatalogue = (): Promise<DictionaryCatalogue> =>
  queryClient.ensureQueryData(dictionaryCatalogueQueryOptions())

export const loadDictionaryBody = (lang: string): Promise<DictionaryBody> =>
  queryClient.ensureQueryData(dictionaryBodyQueryOptions(lang))
