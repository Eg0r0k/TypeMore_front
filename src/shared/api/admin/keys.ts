import { API_SCOPE } from '../keys'

export const adminKeys = {
  all: [...API_SCOPE, 'admin'] as const,
  reportQueues: () => [...adminKeys.all, 'report-queue'] as const,
  reportQueue: (type?: string) => [...adminKeys.reportQueues(), type ?? 'all'] as const,
  subjectReports: (type: string, id: string) =>
    [...adminKeys.all, 'subject-reports', type, id] as const,
  players: () => [...adminKeys.all, 'player'] as const,
  playerBans: (identifier: string) => [...adminKeys.players(), identifier, 'bans'] as const,
  playerBadges: (identifier: string) => [...adminKeys.players(), identifier, 'badges'] as const,
  reviews: () => [...adminKeys.all, 'review'] as const,
  reviewQueue: (floor?: number) => [...adminKeys.reviews(), 'queue', floor ?? 'default'] as const,
  runOverrides: (runId: string) => [...adminKeys.reviews(), 'overrides', runId] as const
} as const
