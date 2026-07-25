import { API_SCOPE } from '../keys'

/**
 * Layer 2 — Dictionary cache keys. Bodies are keyed by language (what callers
 * hold), not by hash: the catalogue is what resolves one to the other.
 *
 * `bodyByHash` is the exception, for replay: a finished run names the exact
 * word list it was played against, and resolving its language again could hand
 * back a dictionary that has been republished since.
 */
export const dictionaryKeys = {
  all: [...API_SCOPE, 'dictionaries'] as const,
  catalogue: () => [...dictionaryKeys.all, 'catalogue'] as const,
  body: (lang: string) => [...dictionaryKeys.all, 'body', lang] as const,
  bodyByHash: (dictHash: string) => [...dictionaryKeys.all, 'body-by-hash', dictHash] as const
} as const
