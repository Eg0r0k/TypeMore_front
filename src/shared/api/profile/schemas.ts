import * as v from 'valibot'

/**
 * Layer 1 — Profile response schemas, mirroring the backend's `docs/PROFILE.md`
 * (camelCase, acc/consistency as [0, 1] fractions — formatting as % is the
 * display edge's job).
 */

export const ProfileMetricStatsSchema = v.object({
  highest: v.number(),
  average: v.number(),
  averageLast10: v.number()
})
export type ProfileMetricStats = v.InferOutput<typeof ProfileMetricStatsSchema>

export const ProfileSummarySchema = v.object({
  displayName: v.string(),
  /**
   * The account's picture, when it has one.
   *
   * NOT SERVED YET — no backend route returns an avatar today. It is modelled
   * here, and modelled as `nullish`, so that the day it appears the client
   * needs no new plumbing: the header already hands this to `UserAvatar`, and
   * an absent field parses to `undefined`, which renders exactly what a missing
   * picture renders now (the player's initials). If the server names it
   * something other than `avatarUrl`, this line is the only place to change.
   */
  avatarUrl: v.nullish(v.string()),
  joined: v.string(),
  testsStarted: v.number(),
  testsCompleted: v.number(),
  restartsPerCompleted: v.number(),
  timeTypingMs: v.number(),
  estimatedWordsTyped: v.number(),
  wpm: ProfileMetricStatsSchema,
  raw: ProfileMetricStatsSchema,
  acc: ProfileMetricStatsSchema,
  consistency: ProfileMetricStatsSchema,
  streak: v.object({ current: v.number(), best: v.number() }),
  languages: v.array(v.object({ lang: v.string(), tests: v.number() }))
})
export type ProfileSummary = v.InferOutput<typeof ProfileSummarySchema>

/**
 * The FUTURE hover mini-card's payload (name, speed averages, top %), defined
 * now so the card is a rendering task, not an API design one, when it lands.
 * Everything but `topPercent` is a straight selection of the /summary response;
 * the percentile arrives with public profiles and stays optional until then.
 */
export interface ProfileCompactSummary {
  readonly displayName: string
  readonly avgWpm: number
  readonly avgRaw: number
  readonly topPercent?: number
}

/** Selects the compact card out of a full summary. */
export const compactSummaryOf = (summary: ProfileSummary): ProfileCompactSummary => ({
  displayName: summary.displayName,
  avgWpm: summary.wpm.average,
  avgRaw: summary.raw.average
})

export const ProfileActivitySchema = v.object({
  days: v.array(v.object({ date: v.string(), tests: v.number(), timeMs: v.number() }))
})
export type ProfileActivity = v.InferOutput<typeof ProfileActivitySchema>

export const ProfileHistogramSchema = v.object({
  buckets: v.array(v.object({ wpm: v.number(), tests: v.number() }))
})
export type ProfileHistogram = v.InferOutput<typeof ProfileHistogramSchema>

export const ProfileTimeseriesSchema = v.object({
  days: v.array(
    v.object({
      date: v.string(),
      timeTypingMs: v.number(),
      avgWpm: v.number(),
      avgAcc: v.number()
    })
  ),
  /** OLS slope of wpm over cumulative hours typed in the range (PROFILE.md). */
  wpmPerHour: v.number()
})
export type ProfileTimeseries = v.InferOutput<typeof ProfileTimeseriesSchema>

/** One PB card: a leaderboard entry decorated with its parsed bucket. */
export const ProfilePBSchema = v.object({
  bucket: v.string(),
  mode: v.nullish(v.string()),
  durationMs: v.nullish(v.number()),
  wordCount: v.nullish(v.number()),
  lang: v.nullish(v.string()),
  textSource: v.nullish(v.string()),
  quoteId: v.nullish(v.string()),
  source: v.nullish(v.string()),
  runId: v.string(),
  score: v.number(),
  wpm: v.number(),
  raw: v.number(),
  acc: v.number(),
  grade: v.string(),
  mods: v.unknown(),
  achievedAt: v.string()
})
export type ProfilePB = v.InferOutput<typeof ProfilePBSchema>

export const ProfilePBsSchema = v.object({ pbs: v.array(ProfilePBSchema) })
export type ProfilePBs = v.InferOutput<typeof ProfilePBsSchema>

/** The keyboard heatmap's aggregates (own profile only — PROFILE.md, Privacy). */
export const ProfileKeyboardSchema = v.object({
  layout: v.string(),
  keys: v.array(
    v.object({
      keyId: v.string(),
      count: v.number(),
      errorRate: v.number(),
      avgIntervalMs: v.number(),
      /** Observation count behind avgIntervalMs — the low-data gate. */
      intervals: v.number()
    })
  )
})
export type ProfileKeyboard = v.InferOutput<typeof ProfileKeyboardSchema>

/** One layout of the layouts asset (GET /api/v1/layouts). */
export const KeyboardLayoutSchema = v.object({
  name: v.string(),
  label: v.string(),
  keys: v.array(
    v.object({
      id: v.string(),
      row: v.number(),
      col: v.number(),
      finger: v.string(),
      hand: v.string(),
      chars: v.array(v.string()),
      width: v.nullish(v.number())
    })
  )
})
export type KeyboardLayout = v.InferOutput<typeof KeyboardLayoutSchema>

export const KeyboardLayoutsSchema = v.object({ layouts: v.array(KeyboardLayoutSchema) })
export type KeyboardLayouts = v.InferOutput<typeof KeyboardLayoutsSchema>
