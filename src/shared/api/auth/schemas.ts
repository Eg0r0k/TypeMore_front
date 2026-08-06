import * as v from 'valibot'

/**
 * Layer 1 — Auth response schemas. Field names mirror the JSON in the backend's
 * `docs/AUTH.md` (camelCase).
 */

export const UserSchema = v.object({
  id: v.string(),
  displayName: v.string(),
  /**
   * The account's picture. NOT SERVED YET — see the note on
   * `ProfileSummarySchema.avatarUrl`; `nullish` so today's `/me` parses
   * unchanged and the header renders initials until the field appears.
   */
  avatarUrl: v.nullish(v.string()),
  createdAt: v.string(),
  /**
   * True while the account is under an active ban.
   *
   * A bare boolean, and that is the whole contract: no reason, no expiry, no
   * issuer. The server keeps the moderation note internal and the banner this
   * drives is deliberately opaque (backend `docs/MODERATION.md`), so there is
   * nothing else here to render even if a surface wanted to.
   *
   * Defaulted rather than required so a server that predates the field, and the
   * flow responses that are not about moderation, both still parse.
   */
  restricted: v.optional(v.boolean(), false),
  /**
   * The account's two privacy switches (backend `docs/PROFILE.md`, "Public
   * profiles"). Defaults mirror the SERVER's migration defaults — open profile,
   * private keyboard portrait — so a server that predates the fields parses to
   * the same truth it enforces.
   */
  profilePublic: v.optional(v.boolean(), true),
  keyboardPublic: v.optional(v.boolean(), false),
  /**
   * Expanded capability set (backend `docs/MODERATION.md`, "The admin
   * surface"). OMITTED for a plain player — the wire stays byte-identical to
   * what it was before permissions existed — so an empty array and an absent
   * field must mean the same thing.
   */
  permissions: v.optional(v.array(v.string()), []),
  /**
   * Starts the rename cooldown (+30 days; PATCH /me/display-name). Omitted
   * while the name has never been changed — registration starts no clock.
   */
  displayNameChangedAt: v.nullish(v.string())
})
export type User = v.InferOutput<typeof UserSchema>

/** `{ authorizeUrl }` from a provider-link start. */
export const LinkStartSchema = v.object({
  authorizeUrl: v.string()
})
export type LinkStart = v.InferOutput<typeof LinkStartSchema>
