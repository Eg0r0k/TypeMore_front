import { dictVersion } from '@typemore/core'

import { ApiError, apiBase, request } from '../transport'
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

/**
 * Fetches one hash-addressed body. Immutable: a new word list is a new hash.
 *
 * The downloaded words are re-fingerprinted through the CORE's own FNV
 * (`dictVersion` — the same function the server ran to mint the address) and
 * checked against the hash the body was requested by. A mismatch is a failed
 * load, never a silently-used body: whatever went wrong (truncated cache, a
 * proxy rewriting bytes, a server bug pairing hash and body), every downstream
 * consumer — word generation, run submission, replay — keys on this hash, and
 * a body that does not match it would produce runs the server must reject.
 */
export const getDictionaryBody = async (dictHash: string): Promise<DictionaryBody> => {
  const body = await request(dictionaryBodyUrl(dictHash), DictionaryBodySchema)
  const actual = dictVersion(body.words)
  if (actual !== dictHash) {
    throw new ApiError({
      status: 0,
      code: 'dict_hash_mismatch',
      message: `dictionary body for ${dictHash} hashes to ${actual}`
    })
  }
  return body
}
