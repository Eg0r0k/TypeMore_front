import * as v from 'valibot'

/**
 * Layer 1 — Auth response schemas. Field names mirror the JSON in the backend's
 * `docs/AUTH.md` (camelCase).
 */

export const UserSchema = v.object({
  id: v.string(),
  displayName: v.string(),
  createdAt: v.string()
})
export type User = v.InferOutput<typeof UserSchema>

/** `{ authorizeUrl }` from a provider-link start. */
export const LinkStartSchema = v.object({
  authorizeUrl: v.string()
})
export type LinkStart = v.InferOutput<typeof LinkStartSchema>
