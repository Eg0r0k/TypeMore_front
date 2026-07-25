import * as v from 'valibot'

/**
 * Layer 1 — Dictionary catalogue + body schemas.
 *
 * One row of `GET /dictionaries` is the public catalogue clients pick a
 * language from. `dictHash` is the core's FNV-1a fingerprint of the word list
 * AND the address of its body (`/static/dictionaries/{dictHash}.json`). See the
 * backend's `docs/DICTIONARIES.md`.
 */
export const DictionarySchema = v.object({
  lang: v.string(),
  name: v.string(),
  dictHash: v.string(),
  wordCount: v.number(),
  bytes: v.number()
})
export type DictionaryInfo = v.InferOutput<typeof DictionarySchema>

export const DictionaryCatalogueSchema = v.array(DictionarySchema)
export type DictionaryCatalogue = v.InferOutput<typeof DictionaryCatalogueSchema>

/**
 * A dictionary body. `bcp47` and `rightToleft` are omitted for most word lists,
 * so the schema defaults them rather than making every consumer re-check.
 */
export const DictionaryBodySchema = v.object({
  name: v.string(),
  words: v.array(v.string()),
  bcp47: v.optional(v.string()),
  rightToleft: v.optional(v.boolean(), false)
})
export type DictionaryBody = v.InferOutput<typeof DictionaryBodySchema>
