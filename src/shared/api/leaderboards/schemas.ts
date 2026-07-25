import * as v from 'valibot'

/**
 * Layer 1 — Leaderboard response schemas. Field names mirror the JSON in the
 * backend's `docs/LEADERBOARDS.md` (camelCase), field for field.
 */

/** How a bucket's text was produced. Only `seeded` runs are ranked today. */
export const TextSourceSchema = v.picklist(['seeded'])
export type TextSource = v.InferOutput<typeof TextSourceSchema>

/**
 * One row of `GET /leaderboards`. The dimension arrives under the name its mode
 * gives it — `durationMs` for time, `wordCount` for words — so a client never
 * has to know that "the number" means milliseconds here and words there.
 * Exactly one of the two is present.
 *
 * `entries` is the visible (ban-filtered) row count. Empty buckets are absent
 * from the catalogue entirely rather than reported as zero.
 */
export const BucketInfoSchema = v.object({
  bucket: v.string(),
  mode: v.picklist(['time', 'words']),
  durationMs: v.optional(v.number()),
  wordCount: v.optional(v.number()),
  lang: v.string(),
  textSource: TextSourceSchema,
  entries: v.number()
})
export type BucketInfo = v.InferOutput<typeof BucketInfoSchema>

export const BucketCatalogueSchema = v.object({
  buckets: v.array(BucketInfoSchema)
})
export type BucketCatalogue = v.InferOutput<typeof BucketCatalogueSchema>

/**
 * The mods a board row was played under.
 *
 * This is the RAW verifiable-mods slice of the run's setup, exactly as
 * `run_mods(setup)` builds it — NOT a display-ready distillation. That is
 * deliberate and documented in LEADERBOARDS.md: the client owns mod semantics,
 * because a server-side "chips" projection would be a second copy of that logic
 * in SQL and Go needing goja-fenced agreement tests like `grade` has. Anything
 * that turns these flags into labels belongs in the view layer.
 */
export const BoardModsSchema = v.object({
  punctuation: v.boolean(),
  numbers: v.boolean(),
  randomCase: v.boolean(),
  reverse: v.boolean(),
  nospace: v.boolean(),
  difficulty: v.picklist(['normal', 'expert', 'master']),
  minWpm: v.number(),
  blind: v.boolean(),
  fading: v.boolean(),
  flashlight: v.boolean()
})
export type BoardMods = v.InferOutput<typeof BoardModsSchema>

/**
 * One ranked entry. Every number here is the SERVER's — the client's own
 * metrics never reach a board. `rank` is counted per page, not carried in the
 * cursor, so it is exact rather than a snapshot from when the token was minted.
 */
export const BoardEntrySchema = v.object({
  rank: v.number(),
  userId: v.string(),
  displayName: v.string(),
  score: v.number(),
  wpm: v.number(),
  raw: v.number(),
  acc: v.number(),
  grade: v.string(),
  mods: BoardModsSchema,
  runId: v.string(),
  achievedAt: v.string()
})
export type BoardEntry = v.InferOutput<typeof BoardEntrySchema>

/** One page of a ranking. `nextCursor` is absent on the last page. */
export const BoardPageSchema = v.object({
  bucket: v.string(),
  entries: v.array(BoardEntrySchema),
  nextCursor: v.optional(v.string())
})
export type BoardPage = v.InferOutput<typeof BoardPageSchema>

/** `200 { bucket, entry }` from `/{bucket}/me`. A `204` becomes `null` instead. */
export const BoardMeSchema = v.object({
  bucket: v.string(),
  entry: BoardEntrySchema
})
export type BoardMe = v.InferOutput<typeof BoardMeSchema>
