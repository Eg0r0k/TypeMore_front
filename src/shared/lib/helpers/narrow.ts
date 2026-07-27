/**
 * Validated narrowing for a control payload (ToggleGroup/Select emit
 * `unknown`): the value comes back AS the union member it matches, or `null`.
 * The one cast lives here, behind the membership check — call sites narrow
 * without asserting.
 */
export const narrowTo = <T extends string>(allowed: readonly T[], value: unknown): T | null =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : null
