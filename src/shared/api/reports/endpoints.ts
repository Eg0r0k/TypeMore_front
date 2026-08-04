import { request } from '../transport'
import { FiledReportSchema, type FiledReport } from './schemas'
import type { FileReportInput } from './types'

/**
 * Layer 1 — the one report endpoint a player has. The admin queue endpoints
 * under `/admin/reports` are a separate surface and deliberately absent here:
 * this module is the FILING side only.
 */
export const fileReport = (input: FileReportInput): Promise<FiledReport> =>
  request('/reports', FiledReportSchema, { method: 'POST', body: input })
