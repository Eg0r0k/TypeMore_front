/**
 * Attach an `enabled` gate to a `queryOptions()` result while keeping the
 * options type INTACT. Spreading into an inline object literal widens the
 * branded `queryKey` and collapses the intersection `queryOptions()` returns,
 * so vue-query's `useQuery` overloads stop matching; the generic spread
 * preserves the exact type. The factory describes a request — the consumer
 * decides whether to make it.
 */
export const gatedBy = <T extends object>(
  options: T,
  enabled: boolean
): T & { enabled: boolean } => ({
  ...options,
  enabled
})
