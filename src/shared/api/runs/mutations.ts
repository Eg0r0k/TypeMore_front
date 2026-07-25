import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { submitRun } from './endpoints'
import { runKeys } from './keys'
import type { RunSubmitInput } from './types'

/** Layer 2 — Run mutations. A submit makes every cached list page stale. */

export const useSubmitRunMutation = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RunSubmitInput) => submitRun(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: runKeys.all })
  })
}
