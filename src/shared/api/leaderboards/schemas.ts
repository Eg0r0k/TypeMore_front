import * as v from 'valibot'

/**
 * Layer 1 — Leaderboard response schemas. Field names mirror the JSON in the
 * backend's `docs/LEADERBOARDS.md` (camelCase), field for field.
 */

/** How a bucket's text was produced. Only `seeded` runs are ranked today. */
export const TextSourceSchema = v.picklist(['seeded'])
export type TextSource = v.InferOutput<typeof TextSourceSchema>

/**
 * One row of `GET /leaderboards`. TWO shapes, because there are two kinds of
 * board and a quote board genuinely lacks a language board's fields — the
 * server omits them rather than sending `"mode": ""`, so that a client cannot
 * read a mode off a board that has none (LEADERBOARDS.md).
 *
 * `entries` is the visible (ban-filtered) row count. Empty buckets are absent
 * from the catalogue entirely rather than reported as zero.
 */

/**
 * A language board: seeded runs ranked per mode/dimension/language. The
 * dimension arrives under the name its mode gives it — `durationMs` for time,
 * `wordCount` for words — so a client never has to know that "the number" means
 * milliseconds here and words there. Exactly one of the two is present.
 */
export const LanguageBucketSchema = v.object({
  bucket: v.string(),
  mode: v.picklist(['time', 'words']),
  durationMs: v.optional(v.number()),
  wordCount: v.optional(v.number()),
  lang: v.string(),
  textSource: TextSourceSchema,
  entries: v.number()
})
export type LanguageBucket = v.InferOutput<typeof LanguageBucketSchema>

/**
 * A quote board: everyone types the same fixed text, so it is ranked within the
 * quote and has no mode, dimension or language to be keyed by. `quoteId`
 * resolves through `GET /quotes/{id}` for the text and its attribution.
 */
export const QuoteBucketSchema = v.object({
  bucket: v.string(),
  quoteId: v.string(),
  entries: v.number()
})
export type QuoteBucket = v.InferOutput<typeof QuoteBucketSchema>

/**
 * Discriminated by the presence of `quoteId` rather than a tag field, because
 * that is what the server actually sends. A language bucket carries no
 * `quoteId` and a quote bucket carries no `mode`, so neither shape can satisfy
 * the other's schema and the union is unambiguous.
 */
export const BucketInfoSchema = v.union([QuoteBucketSchema, LanguageBucketSchema])
export type BucketInfo = v.InferOutput<typeof BucketInfoSchema>

/** Narrow a catalogue row to the quote shape. */
export const isQuoteBucket = (bucket: BucketInfo): bucket is QuoteBucket => 'quoteId' in bucket

/**
 * The bucket key of a quote's board.
 *
 * The server owns the key format (`LEADERBOARDS.md`: `leaderboard.Bucket.Key`
 * is its one producer, deliberately), and this is the single place on the
 * client that reproduces any of it. It exists because a finished quote run
 * knows its quote id and needs to LINK to that board, and looking the key up in
 * the catalogue does not work at the moment it is needed: a board only appears
 * there once a run on it has been accepted, which happens after this screen is
 * drawn.
 *
 * `bucket-schema.test.ts` asserts this against a real catalogue payload, so if
 * the server's format ever moves, the mirror fails rather than producing a link
 * to a board that does not exist.
 */
export const quoteBucketKey = (quoteId: string): string => `quote:${quoteId}`

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
  /**
   * The quote's attribution, present on a QUOTE board only. Snapshotted onto
   * the winning row server-side (a published quote is never edited, so it
   * cannot go stale) rather than joined per read, so a language board pays
   * nothing for a column that is null on every one of its rows.
   */
  source: v.optional(v.string()),
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
