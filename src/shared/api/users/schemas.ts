import * as v from 'valibot'
import { RunStatusSchema } from '../runs/schemas'

/**
 * Layer 1 — Public profile schemas, mirroring the backend's `docs/PROFILE.md`
 * ("Public profiles"). The data payloads (summary/activity/histogram/
 * timeseries/pbs/portrait) reuse the profile domain's schemas verbatim — the
 * server serves them from the same aggregation code, and a second copy here
 * would be a contract that can drift.
 */

/** One social link: which service, and the handle on it (never a URL). */
export const UserLinkSchema = v.object({
  kind: v.picklist(['github', 'youtube', 'twitch']),
  handle: v.string()
})
export type UserLink = v.InferOutput<typeof UserLinkSchema>
export type LinkKind = UserLink['kind']

/**
 * `GET /users/{name}` — the header. The ONE payload a closed profile still
 * answers with: identity plus the fact of being closed. `public: false` is a
 * state the page renders, never a 404.
 */
export const PublicProfileSchema = v.object({
  /**
   * The account's uuid — what a REPORT names its subject by. Optional so a
   * server that predates the field still parses; a page without it simply
   * offers no report button.
   */
  id: v.optional(v.string()),
  name: v.string(),
  joined: v.string(),
  public: v.boolean(),
  /**
   * The picture, when the server grows one — see the note on
   * `ProfileSummarySchema.avatarUrl`. Modelled on the HEADER too because this
   * is the one payload a CLOSED profile still answers with, and a closed
   * profile's page shows a name and a face and nothing else.
   */
  avatarUrl: v.nullish(v.string()),
  /**
   * The IDENTITY half (backend 00029). Present only on an OPEN profile and
   * only for fields whose owner filled them in, so an untouched profile parses
   * exactly as it did before these existed — hence nullish/optional
   * throughout rather than defaulted-to-empty.
   *
   * `bio` is PLAIN TEXT and is rendered as text: no markdown, no HTML. The cap
   * (250) is the server's and the schema's; this copy exists so a malformed
   * response fails at the boundary rather than in a component.
   */
  bio: v.nullish(v.string()),
  keyboard: v.nullish(v.string()),
  /**
   * Social links as HANDLES, never URLs — the client owns the prefix list
   * (`LINK_PREFIXES`), which is what keeps the set of hosts this app can link
   * to a list in the source rather than data anybody can write.
   */
  links: v.optional(v.array(UserLinkSchema), []),
  /**
   * The badge showcase, in its owner's order. Codes only: what a badge looks
   * like lives in `entities/badge`, and a code this build cannot draw renders
   * as nothing at all.
   */
  badges: v.optional(v.array(v.string()), [])
})
export type PublicProfile = v.InferOutput<typeof PublicProfileSchema>

/**
 * `GET /users?q=` — one search hit is the profile HEADER, verbatim. The server
 * serves the identical shape on purpose ("so a client renders a hit and a
 * profile header through the same shape"), so this reuses the schema rather
 * than declaring a twin that could drift.
 *
 * Wrapped in an object rather than a bare array, again matching the server: the
 * envelope is what lets a "your query was truncated" signal appear later
 * without breaking a client that already parses this.
 */
export const UserSearchSchema = v.object({
  users: v.array(PublicProfileSchema)
})
export type UserSearch = v.InferOutput<typeof UserSearchSchema>

/**
 * One public-history row — the server-side ALLOWLIST twin of `RunSummary`:
 * verdict numbers and derived display cells only. Everything a row needs to
 * render in the shared runs table is here; everything the owner reported and
 * everything moderation recorded is not, by the backend's contract
 * (`TestPublicRunPayloadIsAnAllowlist` pins the exact key set server-side).
 */
export const PublicRunSchema = v.object({
  id: v.string(),
  mode: v.string(),
  durationMs: v.nullish(v.number()),
  wordCount: v.nullish(v.number()),
  lang: v.string(),
  serverMetrics: v.nullish(v.unknown()),
  serverScore: v.nullish(v.unknown()),
  createdAt: v.string(),
  /** Constant "accepted" by construction — only accepted runs are public. */
  status: RunStatusSchema,
  grade: v.nullish(v.string()),
  consistency: v.nullish(v.number()),
  chars: v.nullish(
    v.object({
      correct: v.number(),
      incorrect: v.number(),
      extra: v.number(),
      missed: v.number()
    })
  ),
  quoteId: v.nullish(v.string()),
  adoptedFromRunId: v.nullish(v.string()),
  mods: v.nullish(v.unknown())
})
export type PublicRun = v.InferOutput<typeof PublicRunSchema>

/** Keyset-paginated public history. `nextCursor` absent on the last page. */
export const PublicRunListSchema = v.object({
  runs: v.array(PublicRunSchema),
  nextCursor: v.optional(v.string())
})
export type PublicRunList = v.InferOutput<typeof PublicRunListSchema>
