import * as v from 'valibot'

/**
 * Layer 1 — Dictionary catalogue + body schemas.
 *
 * One row of `GET /dictionaries` is the public catalogue clients pick a
 * language from. `dictHash` is the core's FNV-1a fingerprint of the word list
 * AND the address of its body (`/static/dictionaries/{dictHash}.json`). See the
 * backend's `docs/DICTIONARIES.md`.
 *
 * `lang` and `name` are two different things and neither substitutes for the
 * other. `lang` is the canonical KEY (`code_css`) that travels in configs, run
 * submissions, match settings and leaderboard bucket keys. `name` is the HUMAN
 * name (`CSS (code)`) the server's catalogue owns — required, and required to
 * be non-empty, because a client that receives a blank one has no honest label
 * to render and must fail loudly rather than fall back to showing the key.
 */
export const DictionarySchema = v.object({
  lang: v.string(),
  name: v.pipe(v.string(), v.minLength(1)),
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
