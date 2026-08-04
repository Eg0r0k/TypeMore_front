import { useMutation } from '@tanstack/vue-query'
import { fileReport } from './endpoints'
import type { FileReportInput } from './types'

/**
 * Layer 2 — the only way components file a report. No cache to invalidate:
 * filing changes nothing the client reads back (the queue is an admin
 * surface), so the mutation is fire-and-report-the-outcome.
 */
export const useFileReportMutation = () =>
  useMutation({ mutationFn: (input: FileReportInput) => fileReport(input) })
