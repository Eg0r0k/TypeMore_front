/**
 * Root cache-key namespace.
 *
 * Every domain owns its key factory next to its queries (`auth/keys.ts`,
 * `runs/keys.ts`) and builds it on top of this scope, so a new domain never
 * edits a central registry — it only extends `API_SCOPE`.
 */
export const API_SCOPE = ['api'] as const
