import { computed } from 'vue'
import { useCurrentUser } from './session'

/**
 * The capability vocabulary the server can expand a role into
 * (backend `internal/auth/permissions.go`). The wire stays `string[]` — a
 * capability this build predates must not fail the `/me` parse — so this union
 * types only what CALLERS may ask about.
 */
export type Permission =
  | 'bans:read'
  | 'bans:write'
  | 'reports:read'
  | 'reports:write'
  | 'quotes:write'
  | 'runs:review'
  | 'runs:override'

/**
 * Capability checks over the `/me` cache. Not a store: the query owns the
 * fetch and the lifecycle, exactly like `useCurrentUser` — this only derives.
 * UI renders from capabilities, never from a role (docs/MODERATION.md).
 */
export function usePermissions() {
  const { data } = useCurrentUser()

  const permissions = computed<readonly string[]>(() => data.value?.permissions ?? [])
  /** Any capability at all — whether the account has an admin surface to see. */
  const isModerator = computed(() => permissions.value.length > 0)
  const can = (permission: Permission): boolean => permissions.value.includes(permission)

  return { permissions, isModerator, can }
}
