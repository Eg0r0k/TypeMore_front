import * as v from 'valibot'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { queryOptions } from '@tanstack/vue-query'
import { request } from '../transport'
import { UserLinkSchema, type LinkKind } from '../users/schemas'
import { profileKeys } from './keys'

/**
 * The OWNER's editable profile — `GET`/`PATCH /api/v1/me/profile` (backend
 * `docs/PROFILE.md`, migration 00029).
 *
 * Deliberately separate from `/me/settings`: those two switches decide who may
 * READ the profile, these are the profile. One request, one save button — the
 * server writes the bio, the links and the showcase in a single transaction, so
 * the client never has to explain a half-saved screen.
 */

/** Caps, mirroring the server's (which mirror the schema's CHECKs). */
export const BIO_MAX = 250
export const KEYBOARD_MAX = 100

/**
 * The handle grammars, duplicated from the backend (`internal/profile/links.go`)
 * for one purpose: a red border before a round trip. The SERVER is the source
 * of truth — anything that gets past this still has to get past it, and a
 * disagreement between the two is a bug in this copy, never a licence.
 */
export const LINK_PATTERNS: Record<LinkKind, RegExp> = {
  github: /^[A-Za-z0-9]([A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/,
  youtube: /^[A-Za-z0-9._-]{3,30}$/,
  twitch: /^[A-Za-z0-9_]{4,25}$/
}

/**
 * Where a handle becomes a link. THIS is the allowlist the whole "store a
 * handle, never a URL" decision exists for: the set of hosts this app can send
 * a reader to is these three lines, and nothing a user types can add to it.
 */
export const LINK_PREFIXES: Record<LinkKind, string> = {
  github: 'https://github.com/',
  youtube: 'https://youtube.com/@',
  twitch: 'https://twitch.tv/'
}

/** The full URL for a link, built from the prefix this client owns. */
export const linkUrl = (kind: LinkKind, handle: string): string =>
  LINK_PREFIXES[kind] + handle

/** One badge the account HOLDS — shown or not; `order` is its showcase slot. */
const OwnBadgeSchema = v.object({
  code: v.string(),
  shown: v.boolean(),
  order: v.nullish(v.number())
})

export const OwnProfileSchema = v.object({
  bio: v.nullish(v.string()),
  keyboard: v.nullish(v.string()),
  links: v.optional(v.array(UserLinkSchema), []),
  /** Every live grant — the pool the showcase is arranged out of. */
  badges: v.optional(v.array(OwnBadgeSchema), []),
  /** The codes the SERVER knows, so an unknown grant reads as unknown. */
  knownBadges: v.optional(v.array(v.string()), [])
})
export type OwnProfile = v.InferOutput<typeof OwnProfileSchema>
export type OwnBadge = v.InferOutput<typeof OwnBadgeSchema>

/**
 * A PATCH body. Every field is optional and each means "not mentioned" when
 * absent — `bio: ''` CLEARS, which is a different instruction the server
 * distinguishes explicitly.
 */
export interface ProfilePatchInput {
  bio?: string
  keyboard?: string
  /** kind → handle; `''` removes that link. */
  links?: Partial<Record<LinkKind, string>>
  /** The codes to show, in order. `[]` shows none. */
  showcase?: string[]
}

const getOwnProfile = (): Promise<OwnProfile> => request('/me/profile', OwnProfileSchema)

const patchOwnProfile = (input: ProfilePatchInput): Promise<OwnProfile> =>
  request('/me/profile', OwnProfileSchema, { method: 'PATCH', body: input })

export const ownProfileQueryOptions = () =>
  queryOptions({ queryKey: profileKeys.own(), queryFn: getOwnProfile })

export const useOwnProfileQuery = () => useQuery(ownProfileQueryOptions())

/**
 * The response IS the fresh profile, so it is written straight into the cache
 * rather than triggering a refetch for a state the server just described.
 */
export const useUpdateProfileMutation = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ProfilePatchInput) => patchOwnProfile(input),
    onSuccess: (profile) => qc.setQueryData(profileKeys.own(), profile)
  })
}
