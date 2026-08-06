import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { resolveReports } from './endpoints'
import { adminKeys } from './keys'
import type { ResolveReportsInput } from './types'

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
