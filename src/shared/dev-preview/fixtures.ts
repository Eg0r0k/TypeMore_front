/**
 * DEV-ONLY fixtures for the profile preview (see ./scenario.ts).
 *
 * Every builder returns the RAW shape of its endpoint, and the handler feeds it
 * back through `request()`'s ordinary valibot parse — so a fixture that drifts
 * from the contract fails loudly here instead of quietly rendering a lie.
 *
 * The numbers are deterministic (a seeded PRNG keyed by the profile's name), so
 * a reload redraws the same charts and a screenshot is comparable to the last
 * one. Only `Date.now()` moves: the calendar and the timeseries are anchored to
 * today, because a heatmap ending three months ago is not what the page looks
 * like.
 *
 * Type-only imports on purpose — this module must add nothing to the runtime
 * graph but its own functions.
 */

import type { User } from '../api/auth/schemas'
import type {
  ProfileActivity,
  ProfileHistogram,
  ProfileKeyboard,
  ProfilePBs,
  ProfileSummary,
  ProfileTimeseries
} from '../api/profile/schemas'
import type { Quote } from '../api/quotes/schemas'
import type { RunList } from '../api/runs/schemas'
import type { PublicProfile, PublicRunList } from '../api/users/schemas'
import { PREVIEW_ME } from './scenario'

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000

/** `offset` days ago as an ISO instant. */
const instant = (offsetDays: number): string =>
  new Date(Date.now() - offsetDays * DAY_MS).toISOString()

/** `offset` days ago as the `YYYY-MM-DD` day the profile aggregates bucket on. */
const day = (offsetDays: number): string => instant(offsetDays).slice(0, 10)

const round = (value: number, digits: number): number => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

/** mulberry32 over an FNV-1a seed: same name, same page, forever. */
const seeded = (seed: string): (() => number) => {
  let state = 2166136261
  for (let i = 0; i < seed.length; i++) state = Math.imul(state ^ seed.charCodeAt(i), 16777619)
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── Session ────────────────────────────────────────────────────────────────

export const me = (name: string = PREVIEW_ME): User => ({
  id: '00000000-0000-4000-8000-0000000000de',
  displayName: name,
  createdAt: instant(512),
  restricted: false,
  profilePublic: true,
  keyboardPublic: true,
  permissions: []
})

// ── /profile/summary, /users/{name}/summary ────────────────────────────────

/**
 * Twelve languages with four- and five-digit counts — what the header's chip
 * row has to survive (`stress`).
 */
const STRESS_LANGUAGES = [
  { lang: 'english', tests: 18_432 },
  { lang: 'english_1k', tests: 12_907 },
  { lang: 'english_10k', tests: 9_214 },
  { lang: 'russian', tests: 8_760 },
  { lang: 'german', tests: 7_431 },
  { lang: 'french', tests: 6_018 },
  { lang: 'spanish', tests: 5_402 },
  { lang: 'italian', tests: 4_876 },
  { lang: 'portuguese', tests: 3_945 },
  { lang: 'ukrainian', tests: 2_610 },
  { lang: 'code_typescript', tests: 1_874 },
  { lang: 'code_python', tests: 1_203 }
]

/**
 * A picture for the `stress` scenario, so the avatar's IMAGE path is something
 * that can be looked at before the server serves any: an inline SVG data URI,
 * because a preview may not depend on a host being reachable.
 */
const PREVIEW_AVATAR =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
      '<rect width="64" height="64" fill="#2b6cb0"/>' +
      '<circle cx="32" cy="25" r="11" fill="#e2e8f0"/>' +
      '<path d="M8 64c0-13 11-21 24-21s24 8 24 21z" fill="#e2e8f0"/>' +
      '</svg>'
  )

export const summary = (name: string, empty: boolean, stress = false): ProfileSummary => {
  if (empty) {
    const zero = { highest: 0, average: 0, averageLast10: 0 }
    return {
      displayName: name,
      joined: instant(0),
      testsStarted: 0,
      testsCompleted: 0,
      restartsPerCompleted: 0,
      timeTypingMs: 0,
      estimatedWordsTyped: 0,
      wpm: zero,
      raw: zero,
      acc: zero,
      consistency: zero,
      streak: { current: 0, best: 0 },
      languages: []
    }
  }

  return {
    displayName: name,
    avatarUrl: stress ? PREVIEW_AVATAR : null,
    joined: instant(512),
    testsStarted: 4187,
    testsCompleted: 3126,
    restartsPerCompleted: 1.34,
    timeTypingMs: 47 * HOUR_MS + 18 * 60_000,
    estimatedWordsTyped: 248_310,
    wpm: { highest: 148.2, average: 96.4, averageLast10: 108.7 },
    raw: { highest: 161.5, average: 104.8, averageLast10: 116.2 },
    acc: { highest: 1, average: 0.947, averageLast10: 0.962 },
    consistency: { highest: 0.94, average: 0.786, averageLast10: 0.831 },
    streak: { current: stress ? 365 : 12, best: stress ? 365 : 47 },
    languages: stress
      ? STRESS_LANGUAGES
      : [
          { lang: 'english', tests: 1842 },
          { lang: 'english_1k', tests: 631 },
          { lang: 'russian', tests: 408 },
          { lang: 'german', tests: 245 }
        ]
  }
}

// ── /profile/activity ──────────────────────────────────────────────────────

const ACTIVITY_DAYS = 365

export const activity = (name: string, days: number, empty: boolean): ProfileActivity => {
  const span = days > 0 ? days : ACTIVITY_DAYS
  if (empty) {
    return {
      days: Array.from({ length: span }, (_, i) => ({
        date: day(span - 1 - i),
        tests: 0,
        timeMs: 0
      }))
    }
  }

  const rand = seeded(`${name}:activity`)
  return {
    days: Array.from({ length: span }, (_, i) => {
      const offset = span - 1 - i
      const roll = rand()
      // A two-week hole three months back: a real year has one, and the
      // calendar's empty cells are as much a state as its dark ones.
      const away = offset > 96 && offset < 118
      const tests = away || roll < 0.19 ? 0 : Math.round(2 + roll * 26)
      return { date: day(offset), tests, timeMs: tests * (26_000 + Math.round(rand() * 24_000)) }
    })
  }
}

// ── /profile/histogram ─────────────────────────────────────────────────────

export const histogram = (name: string, empty: boolean): ProfileHistogram => {
  if (empty) return { buckets: [] }

  const rand = seeded(`${name}:histogram`)
  const peak = 100
  const buckets = []
  for (let wpm = 30; wpm <= 150; wpm += 10) {
    // A bell around the average, with the right tail a typist actually has.
    const distance = (wpm - peak) / 26
    const weight = Math.exp(-distance * distance)
    buckets.push({ wpm, tests: Math.round(weight * 720 * (0.85 + rand() * 0.3)) })
  }
  return { buckets }
}

// ── /profile/timeseries ────────────────────────────────────────────────────

const SERIES_DAYS = 180

/**
 * The header stat, computed the way the SERVER computes it (PROFILE.md): the
 * OLS slope of wpm over cumulative hours typed in the range. Deriving it here
 * rather than making one up keeps the number and the chart telling the same
 * story when the range presets change.
 */
const wpmPerHour = (days: ProfileTimeseries['days']): number => {
  let hours = 0
  const points = days.map((d) => {
    hours += d.timeTypingMs / HOUR_MS
    return { x: hours, y: d.avgWpm }
  })
  if (points.length < 2) return 0

  const meanX = points.reduce((sum, p) => sum + p.x, 0) / points.length
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / points.length
  let covariance = 0
  let variance = 0
  for (const p of points) {
    covariance += (p.x - meanX) * (p.y - meanY)
    variance += (p.x - meanX) ** 2
  }
  return variance === 0 ? 0 : round(covariance / variance, 2)
}

export const timeseries = (
  name: string,
  from: string | undefined,
  to: string | undefined,
  empty: boolean
): ProfileTimeseries => {
  if (empty) return { days: [], wpmPerHour: 0 }

  const rand = seeded(`${name}:timeseries`)
  const all = Array.from({ length: SERIES_DAYS }, (_, i) => {
    const offset = SERIES_DAYS - 1 - i
    const progress = (SERIES_DAYS - offset) / SERIES_DAYS
    const wobble = (rand() - 0.5) * 9
    return {
      date: day(offset),
      timeTypingMs: Math.round(600_000 + rand() * 2_600_000),
      avgWpm: round(78 + progress * 26 + wobble, 1),
      avgAcc: round(Math.min(0.995, 0.929 + progress * 0.03 + (rand() - 0.5) * 0.03), 3)
    }
  })

  // The whole series is generated first and filtered after, so a day keeps the
  // same numbers whichever range preset asked for it.
  const days = all.filter(
    (d) => (from === undefined || d.date >= from) && (to === undefined || d.date <= to)
  )
  return { days, wpmPerHour: wpmPerHour(days) }
}

// ── /profile/pbs ───────────────────────────────────────────────────────────

interface PBSeed {
  readonly bucket: string
  readonly mode: string
  readonly durationMs: number | null
  readonly wordCount: number | null
  readonly lang: string
  readonly wpm: number
  readonly acc: number
  readonly grade: string
  readonly score: number
  readonly agoDays: number
  readonly quoteId?: string
}

const PB_SEEDS: readonly PBSeed[] = [
  {
    bucket: 'time:15000',
    mode: 'time',
    durationMs: 15_000,
    wordCount: null,
    lang: 'english',
    wpm: 148.2,
    acc: 0.972,
    grade: 'SS',
    score: 21_480,
    agoDays: 4
  },
  {
    bucket: 'time:30000',
    mode: 'time',
    durationMs: 30_000,
    wordCount: null,
    lang: 'english',
    wpm: 134.7,
    acc: 0.981,
    grade: 'S',
    score: 19_260,
    agoDays: 11
  },
  {
    bucket: 'time:60000',
    mode: 'time',
    durationMs: 60_000,
    wordCount: null,
    lang: 'english',
    wpm: 121.3,
    acc: 0.968,
    grade: 'S',
    score: 17_940,
    agoDays: 2
  },
  {
    bucket: 'time:120000',
    mode: 'time',
    durationMs: 120_000,
    wordCount: null,
    lang: 'english_1k',
    wpm: 112.8,
    acc: 0.959,
    grade: 'A',
    score: 15_120,
    agoDays: 38
  },
  {
    bucket: 'words:10',
    mode: 'words',
    durationMs: null,
    wordCount: 10,
    lang: 'english',
    wpm: 141.6,
    acc: 1,
    grade: 'SS',
    score: 20_310,
    agoDays: 7
  },
  {
    bucket: 'words:25',
    mode: 'words',
    durationMs: null,
    wordCount: 25,
    lang: 'english',
    wpm: 128.4,
    acc: 0.984,
    grade: 'S',
    score: 18_450,
    agoDays: 19
  },
  {
    bucket: 'words:50',
    mode: 'words',
    durationMs: null,
    wordCount: 50,
    lang: 'russian',
    wpm: 96.5,
    acc: 0.951,
    grade: 'A',
    score: 12_870,
    agoDays: 63
  },
  {
    bucket: 'words:100',
    mode: 'words',
    durationMs: null,
    wordCount: 100,
    lang: 'german',
    wpm: 88.1,
    acc: 0.943,
    grade: 'B',
    score: 10_640,
    agoDays: 91
  },
  {
    bucket: 'quote:short',
    mode: 'quote',
    durationMs: null,
    wordCount: null,
    lang: 'english',
    wpm: 118.9,
    acc: 0.976,
    grade: 'S',
    score: 16_030,
    agoDays: 26,
    quoteId: 'en-0142'
  }
]

export const pbs = (name: string, empty: boolean): ProfilePBs => {
  if (empty) return { pbs: [] }

  return {
    pbs: PB_SEEDS.map((seed, index) => ({
      bucket: seed.bucket,
      mode: seed.mode,
      durationMs: seed.durationMs,
      wordCount: seed.wordCount,
      lang: seed.lang,
      textSource: seed.quoteId === undefined ? 'dictionary' : 'quote',
      quoteId: seed.quoteId ?? null,
      source: 'solo',
      runId: `preview-pb-${index}`,
      score: seed.score,
      wpm: seed.wpm,
      raw: round(seed.wpm * 1.08, 1),
      acc: seed.acc,
      grade: seed.grade,
      mods:
        index % 3 === 0
          ? { punctuation: true }
          : index % 3 === 1
            ? { numbers: true, punctuation: true }
            : {},
      achievedAt: instant(seed.agoDays)
    }))
  }
}

// ── /profile/keyboard, /users/{name}/portrait ──────────────────────────────

/** Relative English letter frequency — enough for a heatmap that reads right. */
const LETTER_WEIGHT: Readonly<Record<string, number>> = {
  E: 1,
  T: 0.91,
  A: 0.82,
  O: 0.77,
  I: 0.75,
  N: 0.72,
  S: 0.63,
  R: 0.6,
  H: 0.59,
  L: 0.41,
  D: 0.43,
  C: 0.28,
  U: 0.28,
  M: 0.24,
  F: 0.22,
  P: 0.19,
  G: 0.2,
  W: 0.24,
  Y: 0.2,
  B: 0.15,
  V: 0.098,
  K: 0.077,
  X: 0.015,
  J: 0.015,
  Q: 0.01,
  Z: 0.007
}

/** Keys a typist is slower and clumsier on — the map should show them. */
const AWKWARD = new Set([
  'KeyQ',
  'KeyZ',
  'KeyX',
  'KeyP',
  'Semicolon',
  'Quote',
  'BracketLeft',
  'BracketRight'
])

export const keyboard = (name: string, empty: boolean): ProfileKeyboard => {
  if (empty) return { layout: 'qwerty', keys: [] }

  const rand = seeded(`${name}:keyboard`)
  const keys = Object.entries(LETTER_WEIGHT).map(([letter, weight]) => {
    const keyId = `Key${letter}`
    const count = Math.round(weight * 24_000 * (0.85 + rand() * 0.3))
    const awkward = AWKWARD.has(keyId)
    return {
      keyId,
      count,
      errorRate: round((awkward ? 0.05 : 0.012) + rand() * 0.02, 4),
      avgIntervalMs: Math.round((awkward ? 210 : 118) + rand() * 60),
      intervals: count
    }
  })

  const punctuation = ['Comma', 'Period', 'Slash', 'Semicolon', 'Quote', 'Minus'].map((keyId) => {
    const count = Math.round(400 + rand() * 1400)
    return {
      keyId,
      count,
      errorRate: round(0.03 + rand() * 0.04, 4),
      avgIntervalMs: Math.round(190 + rand() * 90),
      intervals: count
    }
  })

  const digits = Array.from({ length: 10 }, (_, i) => {
    // Digits are the low-data corner on purpose: the map's own "too few
    // observations" treatment needs something to apply to.
    const count = Math.round(20 + rand() * 90)
    return {
      keyId: `Digit${(i + 1) % 10}`,
      count,
      errorRate: round(0.06 + rand() * 0.06, 4),
      avgIntervalMs: Math.round(260 + rand() * 120),
      intervals: Math.round(count * 0.4)
    }
  })

  const space = {
    keyId: 'Space',
    count: 61_400,
    errorRate: 0.0031,
    avgIntervalMs: 104,
    intervals: 61_400
  }

  return { layout: 'qwerty', keys: [...keys, ...punctuation, ...digits, space] }
}

// ── /quotes/{id} ───────────────────────────────────────────────────────────

/**
 * The runs table resolves a quote row's TEXT by id, so a preview without this
 * would leave a real cell of both pages permanently loading.
 */
const QUOTE_TEXTS: readonly { readonly text: string; readonly source: string }[] = [
  {
    text: 'You cannot buy the revolution. You cannot make the revolution. You can only be the revolution.',
    source: 'Ursula K. Le Guin, The Dispossessed'
  },
  {
    text: 'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.',
    source: 'Jane Austen, Pride and Prejudice'
  },
  {
    text: 'The past is never dead. It is not even past.',
    source: 'William Faulkner, Requiem for a Nun'
  }
]

export const quote = (id: string): Quote => {
  const pick = QUOTE_TEXTS[Math.floor(seeded(id)() * QUOTE_TEXTS.length)] ?? QUOTE_TEXTS[0]!
  return {
    id,
    lang: 'english',
    upstreamId: 4212,
    source: pick.source,
    length: pick.text.length,
    lenGroup: pick.text.length > 100 ? 'medium' : 'short',
    textHash: 'preview-quote-hash',
    text: pick.text,
    superseded: false
  }
}

// ── /users/{name} ──────────────────────────────────────────────────────────

export const publicProfile = (name: string, isPublic: boolean): PublicProfile => ({
  name,
  joined: instant(512),
  public: isPublic,
  restricted: false,
  // The identity half, so the preview exercises the parts of the header that
  // only exist once somebody has filled them in. A CLOSED profile carries
  // none of it — that is the server's rule, and a fixture that broke it would
  // preview a page the API cannot produce.
  ...(isPublic
    ? {
        bio: 'preview account — types words, sometimes correctly',
        keyboard: 'Keychron Q1 / Gateron Brown',
        links: [
          { kind: 'github' as const, handle: 'typemore' },
          { kind: 'twitch' as const, handle: 'typemore_tv' }
        ],
        badges: ['staff', 'beta_tester']
      }
    : { links: [], badges: [] })
})

// ── /runs, /users/{name}/runs ──────────────────────────────────────────────

const PAGE_SIZE = 10
/** One page then a shorter one: the table's "load more" has something to do. */
const PAGE_TWO_CURSOR = 'preview-cursor-2'
const LAST_PAGE_SIZE = 6

interface RunSeedRow {
  readonly id: string
  readonly mode: string
  readonly durationMs: number | null
  readonly wordCount: number | null
  readonly lang: string
  readonly wpm: number
  readonly raw: number
  readonly accuracy: number
  readonly grade: string | null
  readonly consistency: number
  readonly score: number
  readonly agoDays: number
  readonly status: 'pending' | 'accepted' | 'flagged' | 'rejected'
  readonly mods: Record<string, unknown>
  readonly quoteId: string | null
}

const runSeeds = (name: string, page: number, size: number): RunSeedRow[] => {
  const rand = seeded(`${name}:runs:${page}`)
  const MODES = [
    { mode: 'time', durationMs: 15_000, wordCount: null },
    { mode: 'time', durationMs: 30_000, wordCount: null },
    { mode: 'time', durationMs: 60_000, wordCount: null },
    { mode: 'words', durationMs: null, wordCount: 25 },
    { mode: 'words', durationMs: null, wordCount: 50 },
    { mode: 'quote', durationMs: null, wordCount: null }
  ] as const
  const LANGS = ['english', 'english_1k', 'russian', 'german'] as const
  const GRADES = ['SS', 'S', 'A', 'B', 'C'] as const

  return Array.from({ length: size }, (_, i) => {
    const index = page * PAGE_SIZE + i
    const shape = MODES[Math.floor(rand() * MODES.length)]!
    const wpm = round(82 + rand() * 46, 1)
    // The freshest row is still under review — the table renders a status
    // where a grade would be, and that cell needs to be looked at too.
    const pending = index === 0
    return {
      id: `preview-run-${index}`,
      mode: shape.mode,
      durationMs: shape.durationMs,
      wordCount: shape.wordCount,
      // The quote fixtures are English, and a row that says "german" over an
      // English quote is a preview lying about a cell it is there to show.
      lang: shape.mode === 'quote' ? 'english' : LANGS[Math.floor(rand() * LANGS.length)]!,
      wpm,
      raw: round(wpm * (1.05 + rand() * 0.08), 1),
      accuracy: round(0.92 + rand() * 0.075, 3),
      grade: pending
        ? null
        : GRADES[Math.min(GRADES.length - 1, Math.floor(rand() * GRADES.length))]!,
      consistency: round(0.66 + rand() * 0.3, 3),
      score: Math.round(9_000 + rand() * 11_000),
      agoDays: index * 0.7 + rand(),
      status: pending ? 'pending' : 'accepted',
      mods: rand() > 0.55 ? { punctuation: true, numbers: rand() > 0.7 } : {},
      quoteId: shape.mode === 'quote' ? `en-0${100 + index}` : null
    }
  })
}

/** The cells both feeds share — a public row is a strict subset of the own row. */
const publicRunOf = (seed: RunSeedRow): PublicRunList['runs'][number] => ({
  id: seed.id,
  mode: seed.mode,
  durationMs: seed.durationMs,
  wordCount: seed.wordCount,
  lang: seed.lang,
  serverMetrics:
    seed.status === 'pending' ? null : { wpm: seed.wpm, raw: seed.raw, accuracy: seed.accuracy },
  serverScore: seed.status === 'pending' ? null : { points: seed.score },
  createdAt: instant(seed.agoDays),
  status: seed.status,
  grade: seed.grade,
  consistency: seed.consistency,
  chars: { correct: 312, incorrect: 7, extra: 2, missed: 1 },
  quoteId: seed.quoteId,
  adoptedFromRunId: null,
  mods: seed.mods
})

const pageOf = (
  cursor: string | undefined
): { index: number; size: number; next: string | undefined } =>
  cursor === PAGE_TWO_CURSOR
    ? { index: 1, size: LAST_PAGE_SIZE, next: undefined }
    : { index: 0, size: PAGE_SIZE, next: PAGE_TWO_CURSOR }

export const runs = (name: string, cursor: string | undefined, empty: boolean): RunList => {
  if (empty) return { runs: [] }
  const { index, size, next } = pageOf(cursor)
  const rows = runSeeds(name, index, size).map((seed) => ({
    ...publicRunOf(seed),
    // The own feed carries the submission's own half as well.
    seed: 1_337_000 + index,
    dictHash: 'preview0000000000000000000000000000000000000000000000000000000000',
    setup: { mode: seed.mode, lang: seed.lang },
    clientMetrics: { wpm: seed.wpm, raw: seed.raw, accuracy: seed.accuracy },
    clientScore: { points: seed.score },
    scoreVersion: 3,
    validatedAt: seed.status === 'pending' ? null : instant(seed.agoDays),
    logBytes: 4_812,
    restartsSinceLastSubmit: seed.status === 'pending' ? 2 : 0
  }))
  return next === undefined ? { runs: rows } : { runs: rows, nextCursor: next }
}

export const publicRuns = (
  name: string,
  cursor: string | undefined,
  empty: boolean
): PublicRunList => {
  if (empty) return { runs: [] }
  const { index, size, next } = pageOf(cursor)
  // Only ACCEPTED runs are public (users/schemas.ts), so the under-review row
  // the own feed shows is absent here rather than hidden by the table.
  const rows = runSeeds(name, index, size)
    .filter((seed) => seed.status === 'accepted')
    .map(publicRunOf)
  return next === undefined ? { runs: rows } : { runs: rows, nextCursor: next }
}
