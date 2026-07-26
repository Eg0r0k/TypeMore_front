import { useQuery } from '@tanstack/vue-query'
import { languageNamesQueryOptions } from '@shared/api'

/**
 * Resolves a language KEY to the name a human reads.
 *
 * Every surface that holds a bare `lang` — the settings bar, the room config
 * panel, a leaderboard bucket — renders it through here. The server's
 * dictionary catalogue is the single source of language naming: the client
 * never derives a label from the key, because keys like `code_css` and
 * `russian_empire` do not survive any amount of string mangling.
 *
 * The key itself is the ONLY fallback, and only while the catalogue is in
 * flight or failed to load: an identifier on screen is bad, an empty label is
 * worse. Every caller shares one cache entry, so this costs no extra request.
 */
export const useLanguageNames = () => {
  const { data: names } = useQuery(languageNamesQueryOptions())

  const languageName = (lang: string): string => names.value?.[lang] ?? lang

  return { languageName }
}
