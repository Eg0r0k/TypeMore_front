import * as v from 'valibot'

/**
 * Layer 1 — Quote registry schemas. Field names mirror the JSON in the
 * backend's `docs/QUOTES.md`, field for field.
 *
 * There are TWO quote shapes here, deliberately not one shape with an optional
 * `text`. The list endpoint's lack of a body is a guarantee enforced in SQL
 * (`ListQuotes` does not select the column), not an omission a client should
 * shrug at: a schema that tolerated a missing `text` would stop telling the two
 * endpoints apart, and the caller that forgot which one it called would type-
 * check anyway.
 */

/** `short | medium | long | thicc` — the band, not the ordinal. Thresholds are per corpus. */
export const QuoteLengthGroupSchema = v.picklist(['short', 'medium', 'long', 'thicc'])
export type QuoteLengthGroup = v.InferOutput<typeof QuoteLengthGroupSchema>

/**
 * One row of `GET /quotes` — metadata only, NEVER the text.
 *
 * `textHash` is the core's FNV-1a of the text (`dictVersion([text])`), the same
 * artefact a dictionary's `dictHash` is, and what a run records beside the id.
 */
export const QuoteMetaSchema = v.object({
  id: v.string(),
  lang: v.string(),
  /** The quote's id inside its upstream corpus. Not unique on its own. */
  upstreamId: v.number(),
  /** Upstream's attribution, verbatim. Displayed under the typing field. */
  source: v.string(),
  /** Characters in the text (`char_length`). */
  length: v.number(),
  lenGroup: QuoteLengthGroupSchema,
  textHash: v.string()
})
export type QuoteMeta = v.InferOutput<typeof QuoteMetaSchema>

/** One page of `GET /quotes`. `nextCursor` is absent on the last page. */
export const QuotePageSchema = v.object({
  quotes: v.array(QuoteMetaSchema),
  nextCursor: v.optional(v.string())
})
export type QuotePage = v.InferOutput<typeof QuotePageSchema>

/**
 * One quote WITH its text — `GET /quotes/random` and `GET /quotes/{id}`.
 *
 * The metadata entries are spread rather than restated so the two shapes cannot
 * drift; what makes this a different schema is that `text` and `superseded` are
 * REQUIRED. `/random` never draws a retired revision (so `superseded` is always
 * `false` there); `/{id}` is the only read that serves them, which is what
 * keeps a run played on a since-replaced text watchable.
 */
export const QuoteSchema = v.object({
  ...QuoteMetaSchema.entries,
  text: v.string(),
  superseded: v.boolean()
})
export type Quote = v.InferOutput<typeof QuoteSchema>
