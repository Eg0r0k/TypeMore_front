import { API_SCOPE } from '../keys'

export const adminKeys = {
  all: [...API_SCOPE, 'admin'] as const,
  reportQueues: () => [...adminKeys.all, 'report-queue'] as const,
  reportQueue: (type?: string) => [...adminKeys.reportQueues(), type ?? 'all'] as const,
  subjectReports: (type: string, id: string) =>
    [...adminKeys.all, 'subject-reports', type, id] as const
} as const
