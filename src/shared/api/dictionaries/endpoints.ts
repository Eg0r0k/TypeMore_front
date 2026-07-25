import { apiBase, request } from '../transport'
import {
  DictionaryBodySchema,
  DictionaryCatalogueSchema,
  type DictionaryBody,
  type DictionaryCatalogue
} from './schemas'

/**
 * Layer 1 — Dictionaries. No session: word lists are public static assets and
 * guests need them too.
 */

/** `GET /dictionaries` — the public catalogue of word lists the server publishes. */
export const listDictionaries = (): Promise<DictionaryCatalogue> =>
  request('/dictionaries', DictionaryCatalogueSchema)

/**
 * Absolute URL of a dictionary body. Bodies are addressed by content hash and
 * served `immutable`, so they live at the API host's root (a CDN origin), not
 * under `/api/v1` — hence a URL built from the API base rather than a path.
 */
export const dictionaryBodyUrl = (dictHash: string): string =>
  new URL(`/static/dictionaries/${dictHash}.json`, apiBase()).toString()

/** Fetches one hash-addressed body. Immutable: a new word list is a new hash. */
export const getDictionaryBody = (dictHash: string): Promise<DictionaryBody> =>
  request(dictionaryBodyUrl(dictHash), DictionaryBodySchema)
