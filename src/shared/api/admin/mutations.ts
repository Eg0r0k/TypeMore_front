import { useMutation, useQueryClient } from '@tanstack/vue-query'
import {
  grantBadge,
  issueBan,
  overrideRunStatus,
  resolveReports,
  revokeBadge,
  revokeBan
} from './endpoints'
import { adminKeys } from './keys'
import type { IssueBanInput, OverrideRunInput, ResolveReportsInput } from './types'

/** Resolving closes the whole subject group, so every queue view is stale. */
export const useResolveReportsMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ResolveReportsInput) => resolveReports(input),
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.reportQueues() })
      void queryClient.invalidateQueries({
        queryKey: adminKeys.subjectReports(input.subject.type, input.subject.id)
      })
    }
  })
}

/**
 * The three player-card mutations invalidate the WHOLE player family: the card
 * may be keyed by nick, uuid or email for the same account, and a ban also
 * moves `restricted`, which lives on the bans read.
 */
const usePlayerMutation = <TInput, TResult>(mutationFn: (input: TInput) => Promise<TResult>) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.players() })
    }
  })
}

export const useIssueBanMutation = () => usePlayerMutation((input: IssueBanInput) => issueBan(input))

export const useRevokeBanMutation = () => usePlayerMutation((userId: string) => revokeBan(userId))

export const useGrantBadgeMutation = () =>
  usePlayerMutation((input: { identifier: string; code: string }) =>
    grantBadge(input.identifier, input.code)
  )

export const useRevokeBadgeMutation = () =>
  usePlayerMutation((input: { identifier: string; code: string }) =>
    revokeBadge(input.identifier, input.code)
  )

export const useOverrideRunMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: OverrideRunInput) => overrideRunStatus(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.reviews() })
    }
  })
}
