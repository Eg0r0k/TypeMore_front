import { createServer } from 'node:http'
import { gzipSync } from 'node:zlib'
import type { Page } from '@playwright/test'
import { dictVersion, generateWords, makeSeedContext } from '../../src/shared/core/words'
import type { Dictionary, GenerationConfig } from '../../src/shared/core/words'

/**
 * Leaderboards + public-replay stubs for the backend-less E2E harness.
 *
 * Same shape and same reasoning as `dictionaries.ts`: `page.route` +
 * `route.fulfill`, one exported `stubX(page, options)` per subsystem, installed
 * before the first `goto`. Bodies mirror `TypeMore_back/docs/LEADERBOARDS.md`
 * field for field, so the client path under test — catalogue → bucket → page,
 * and metadata → log → dictionary — is the real one.
 *
 * Each stub returns a handle rather than only installing routes: a spec needs
 * to make ONE route fail and then let it recover (retry paths), and flipping a
 * flag on the handle is how that happens without a second fixture.
 *
 * THE LOG ROUTE IS GZIPPED FOR REAL (`zlib.gzipSync`, `Content-Encoding: gzip`),
 * and it is the one route served off a real socket rather than fulfilled in
 * process — `route.fulfill` injects its body BELOW content decoding, so a
 * fulfilled gzip response would reach the page as unparseable bytes. See
 * `startLogServer`. That split is the whole point of the two-request design:
 * the server hands the STORED gzip blob straight to the socket and the browser's
 * HTTP stack decompresses it, with no base64 and no `DecompressionStream` in the
 * client. A mock that fulfilled plain JSON here would make every replay spec
 * pass while proving nothing about the thing under test.
 */

// ── Dictionary ───────────────────────────────────────────────────────────────
// One word list, hashed with the APP'S OWN `dictVersion`, used for both the
// served body and the run's advertised `dictHash`. Hard-coding a hash would
// make the replay page's mismatch check pass for the wrong reason (or fail for
// no reason the day the hash function changes).

const DICT_NAME = 'german'

const DICT_WORDS: readonly string[] = [
  'der',
  'die',
  'das',
  'und',
  'ist',
  'nicht',
  'mit',
  'sich',
  'auf',
  'eine',
  'auch',
  'aber',
  'noch',
  'nach',
  'wenn',
  'schon',
  'immer',
  'sehr',
  'unter',
  'gegen',
  'ohne',
  'durch',
  'wieder',
  'jeder'
]

/** The address the body is served at AND the hash a run must have been played on. */
export const DICT_HASH = dictVersion(DICT_WORDS)

const DICT_BODY = { name: DICT_NAME, words: DICT_WORDS, bcp47: 'de-DE' }

export interface DictionaryStubOptions {
  /**
   * Also serve this body at a SECOND address. The body then hashes to something
   * other than the address it was fetched from — which is exactly what a
   * republished word list looks like to a replay, and the only honest way to
   * reach the mismatch panel (a hash nobody serves is a 404, a different state).
   */
  readonly alsoServeAt?: string
}

/**
 * The catalogue + hash-addressed body, as the app's root setup and the replay
 * page ask for them. Separate from `stubDictionaries` because a replay's word
 * list is addressed by a hash this fixture COMPUTES; the other fixture's hashes
 * are opaque stand-ins and would 404 for it.
 */
export async function stubDictionary(
  page: Page,
  options: DictionaryStubOptions = {}
): Promise<void> {
  const catalogue = [
    {
      lang: DICT_NAME,
      name: DICT_NAME,
      dictHash: DICT_HASH,
      wordCount: DICT_WORDS.length,
      bytes: new TextEncoder().encode(JSON.stringify(DICT_BODY)).length
    }
  ]

  await page.route(/\/api\/v1\/dictionaries(\?|$)/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(catalogue) })
  )

  await page.route(/\/static\/dictionaries\/[^/?]+\.json(\?|$)/, (route) => {
    const hash = new URL(route.request().url()).pathname.split('/').pop()?.replace('.json', '')
    if (hash !== DICT_HASH && hash !== options.alsoServeAt) {
      return route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: '{"error":"not_found","message":"no dictionary with that hash"}'
      })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'cache-control': 'public, max-age=31536000, immutable' },
      body: JSON.stringify(DICT_BODY)
    })
  })
}

// ── Leaderboards ─────────────────────────────────────────────────────────────

export interface BucketFixture {
  readonly bucket: string
  readonly mode: 'time' | 'words'
  readonly durationMs?: number
  readonly wordCount?: number
  readonly lang: string
  readonly textSource: 'seeded'
  readonly entries: number
}

export interface BoardRowFixture {
  readonly rank: number
  readonly userId: string
  readonly displayName: string
  readonly score: number
  readonly wpm: number
  readonly raw: number
  /** A FRACTION, exactly as the wire carries it (1 = 100%). */
  readonly acc: number
  readonly grade: string
  readonly mods: Record<string, unknown>
  readonly runId: string
  readonly achievedAt: string
}

/** No mod is on: the shape `run_mods(setup)` produces for a plain run. */
const CLEAN_MODS = {
  punctuation: false,
  numbers: false,
  randomCase: false,
  reverse: false,
  nospace: false,
  difficulty: 'normal',
  minWpm: 0,
  blind: false,
  fading: false,
  flashlight: false
} as const

const row = (
  rank: number,
  displayName: string,
  runId: string,
  score: number,
  mods: Record<string, unknown> = CLEAN_MODS
): BoardRowFixture => ({
  rank,
  userId: `user-${runId}`,
  displayName,
  score,
  wpm: 120 - rank * 7,
  raw: 128 - rank * 7,
  acc: 0.99 - rank * 0.01,
  grade: rank === 1 ? 'SS' : 'S',
  mods,
  runId,
  achievedAt: '2026-07-20T10:15:00.000Z'
})

export const WORDS_10_DE = 'words:10:german:seeded'
export const TIME_15_DE = 'time:15000:german:seeded'
export const TIME_60_RU = 'time:60000:russian:seeded'

/**
 * The busiest bucket is deliberately NOT first in the array: landing on it can
 * only be `mostPopulatedBucket` doing its job, never array order passing by
 * accident.
 */
export const DEFAULT_BUCKETS: readonly BucketFixture[] = [
  {
    bucket: TIME_15_DE,
    mode: 'time',
    durationMs: 15_000,
    lang: 'german',
    textSource: 'seeded',
    entries: 3
  },
  {
    bucket: WORDS_10_DE,
    mode: 'words',
    wordCount: 10,
    lang: 'german',
    textSource: 'seeded',
    entries: 42
  },
  {
    bucket: TIME_60_RU,
    mode: 'time',
    durationMs: 60_000,
    lang: 'russian',
    textSource: 'seeded',
    entries: 7
  }
]

/** Pages per bucket, in load order. Page `n + 1` is reached by page `n`'s cursor. */
export type BoardFixture = Record<string, readonly (readonly BoardRowFixture[])[]>

export const DEFAULT_BOARDS: BoardFixture = {
  [WORDS_10_DE]: [
    [row(1, 'Ada', 'run-ada', 12_480), row(2, 'Grace', 'run-grace', 11_910)],
    [row(3, 'Linus', 'run-linus', 10_040), row(4, 'Ken', 'run-ken', 9_620)]
  ],
  [TIME_15_DE]: [
    [row(1, 'Barbara', 'run-barbara', 8_800), row(2, 'Margaret', 'run-margaret', 8_120)]
  ],
  [TIME_60_RU]: [[row(1, 'Ivan', 'run-ivan', 7_400)]]
}

export interface LeaderboardsStubOptions {
  /** Catalogue to serve. `[]` is a real 200 meaning "no bucket has entries". */
  readonly buckets?: readonly BucketFixture[]
  readonly boards?: BoardFixture
  /** Fail `GET /leaderboards` with this status instead of answering. */
  readonly catalogueStatus?: number
  /** Fail every `GET /leaderboards/{bucket}` with this status until `recoverBoards()`. */
  readonly boardStatus?: number
  /** What `/{bucket}/me` answers. `401` (signed out) by default — a public page. */
  readonly meStatus?: number
}

export interface LeaderboardsStub {
  readonly buckets: readonly BucketFixture[]
  /** The bucket `/boards` must land on with no `?bucket=`. */
  readonly busiestBucket: string
  /** Rows on one page of a board, as the fixture will serve them. */
  readonly rowsOf: (bucket: string, page?: number) => readonly BoardRowFixture[]
  /** Stop failing board pages; the next request (a retry) succeeds. */
  readonly recoverBoards: () => void
}

/** Installs the catalogue, the paged boards and `/{bucket}/me`. Call before `goto`. */
export async function stubLeaderboards(
  page: Page,
  options: LeaderboardsStubOptions = {}
): Promise<LeaderboardsStub> {
  const buckets = options.buckets ?? DEFAULT_BUCKETS
  const boards = options.boards ?? DEFAULT_BOARDS
  const meStatus = options.meStatus ?? 401
  let boardStatus = options.boardStatus ?? null

  await page.route(/\/api\/v1\/leaderboards(\?|$)/, (route) => {
    if (options.catalogueStatus !== undefined) {
      return route.fulfill({
        status: options.catalogueStatus,
        contentType: 'application/json',
        body: '{"error":"internal","message":"catalogue unavailable"}'
      })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ buckets })
    })
  })

  // Registered before the page route below, so Playwright's reverse-order
  // matching is irrelevant: the two patterns are mutually exclusive on segment
  // count. Kept explicit anyway — `/me` is a different resource, not a page.
  await page.route(/\/api\/v1\/leaderboards\/[^/?]+\/me(\?|$)/, (route) => {
    if (meStatus === 204) return route.fulfill({ status: 204, body: '' })
    if (meStatus === 401) {
      return route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: '{"error":"unauthorized","message":"sign in first"}'
      })
    }
    const bucket = decodeURIComponent(
      new URL(route.request().url()).pathname.split('/').at(-2) ?? ''
    )
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ bucket, entry: (boards[bucket]?.[0] ?? [])[0] })
    })
  })

  await page.route(/\/api\/v1\/leaderboards\/[^/?]+(\?|$)/, (route) => {
    if (boardStatus !== null) {
      return route.fulfill({
        status: boardStatus,
        contentType: 'application/json',
        body: '{"error":"internal","message":"board unavailable"}'
      })
    }
    const url = new URL(route.request().url())
    const bucket = decodeURIComponent(url.pathname.split('/').pop() ?? '')
    const pages = boards[bucket] ?? []
    // The cursor IS the index of the page it points at — opaque to the client,
    // which is all the contract promises.
    const index = Number(url.searchParams.get('cursor') ?? '0')
    const entries = pages[index] ?? []
    const nextCursor = index + 1 < pages.length ? String(index + 1) : undefined
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ bucket, entries, ...(nextCursor === undefined ? {} : { nextCursor }) })
    })
  })

  const busiestBucket = [...buckets].sort(
    (a, b) => b.entries - a.entries || (a.bucket < b.bucket ? -1 : 1)
  )[0]?.bucket

  return {
    buckets,
    busiestBucket: busiestBucket ?? '',
    rowsOf: (bucket, pageIndex = 0) => boards[bucket]?.[pageIndex] ?? [],
    recoverBoards: () => {
      boardStatus = null
    }
  }
}

// ── Public replay ────────────────────────────────────────────────────────────

const SEED = 20_260_720

const GENERATION: GenerationConfig = {
  mode: 'words',
  length: 10,
  punctuation: false,
  numbers: false,
  randomCase: false,
  reverse: false
}

const CONFIG = {
  mode: 'words',
  durationMs: 0,
  maxExtraChars: 20,
  difficulty: 'normal',
  nospace: false,
  minWpm: 0
} as const

const DECLARATION = { blind: false, fading: false, flashlight: false } as const

const DICTIONARY: Dictionary = { name: DICT_NAME, bcp47: 'de-DE', words: DICT_WORDS }

/**
 * The exact words this run was played on — regenerated the way the replay page
 * regenerates them, from the same seed and the same list. A log that typed
 * anything else would still play, but it would not be a run of this text.
 */
const REPLAY_WORDS = ((): readonly string[] => {
  const generated = generateWords(DICTIONARY, makeSeedContext(DICTIONARY, SEED, GENERATION))
  if (generated.isErr()) throw new Error(`replay fixture: ${generated.error.message}`)
  return generated.value.words
})()

/** One keystroke every 60ms, a commit per word — a plain, clean run. */
const KEYSTROKE_MS = 60

const REPLAY_LOG = ((): { version: number; events: unknown[] } => {
  const events: unknown[] = []
  let seq = 0
  let t = 0
  for (const word of REPLAY_WORDS) {
    for (const char of word) {
      t += KEYSTROKE_MS
      events.push({ kind: 'insert', seq: seq++, t, text: char })
    }
    t += KEYSTROKE_MS
    events.push({ kind: 'commit', seq: seq++, t })
  }
  return { version: 1, events }
})()

const LOG_JSON = JSON.stringify(REPLAY_LOG)
/** The bytes that actually go on the wire — gzipped here, decompressed by Chromium. */
const LOG_GZIP = gzipSync(Buffer.from(LOG_JSON, 'utf8'))

/**
 * A REAL socket for the log, and the one place this file departs from plain
 * `route.fulfill`.
 *
 * `route.fulfill` injects its body BELOW content decoding: a fulfilled
 * `Content-Encoding: gzip` response reaches the page as raw gzip bytes and the
 * JSON parse fails. Faking it the other way — fulfilling plain JSON while
 * claiming the header — would make the replay specs pass without exercising the
 * decompression this whole change is about. So the log is served by a tiny
 * local server and the request is REDIRECTED to it with
 * `route.continue({ url })`: the gzip crosses a real socket and Chromium
 * decompresses it exactly as it will in production.
 *
 * The path is preserved, so `page.on('request')` still reports the app's own
 * `/api/v1/runs/{id}/replay/log` and `page.on('response')` reports the same
 * path off this origin.
 */
let logOrigin: string | null = null

const startLogServer = async (): Promise<string> => {
  if (logOrigin !== null) return logOrigin
  const server = createServer((request, response) => {
    const runId = (request.url ?? '').split('/').at(-2) ?? ''
    response.writeHead(200, {
      'content-type': 'application/json',
      'content-encoding': 'gzip',
      'content-length': String(LOG_GZIP.byteLength),
      'cache-control': 'public, max-age=31536000, immutable',
      etag: `"${runId}"`,
      // The page's origin is the vite server, never the API host.
      'access-control-allow-origin': request.headers.origin ?? '*',
      'access-control-allow-credentials': 'true',
      // No keep-alive: a lingering socket would outlive the test that opened it.
      connection: 'close'
    })
    response.end(LOG_GZIP)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  // Never hold the worker open — the suite's lifetime is this server's.
  server.unref()
  logOrigin = `http://127.0.0.1:${typeof address === 'object' && address !== null ? address.port : 0}`
  return logOrigin
}

export const DEFAULT_RUN_ID = 'run-ada'
export const REPLAY_DISPLAY_NAME = 'Ada'

export interface ReplayStubOptions {
  /** Answer the metadata route with this status instead of the run (404 = gone). */
  readonly metaStatus?: number
  /** Fail the log route with this status until `recoverLog()` is called. */
  readonly logStatus?: number
  /** Advertise a `dictHash` the served dictionary does not hash to. */
  readonly dictHash?: string
}

export interface ReplayStub {
  readonly displayName: string
  /** The hash the run advertises. Equals {@link DICT_HASH} unless overridden. */
  readonly dictHash: string
  /** Wire size vs. decompressed size — the gzip claim, in numbers. */
  readonly logBytes: { readonly gzip: number; readonly json: number }
  /** Stop failing the log route; the next request (a retry) succeeds. */
  readonly recoverLog: () => void
}

/**
 * Installs the two replay routes. The metadata carries `seed` + `dictHash` and
 * NO `log` field — the log is its own request, and its body is real gzip.
 */
export async function stubReplay(page: Page, options: ReplayStubOptions = {}): Promise<ReplayStub> {
  const dictHash = options.dictHash ?? DICT_HASH
  const origin = await startLogServer()
  let logStatus = options.logStatus ?? null

  // Registered first; the log pattern below is the more specific one and, being
  // registered later, is also the one Playwright tries first.
  await page.route(/\/api\/v1\/runs\/[^/?]+\/replay(\?|$)/, (route) => {
    const runId = new URL(route.request().url()).pathname.split('/').at(-2) ?? ''
    if (options.metaStatus !== undefined) {
      return route.fulfill({
        status: options.metaStatus,
        contentType: 'application/json',
        body: '{"error":"not_found","message":"no such run"}'
      })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        runId,
        displayName: REPLAY_DISPLAY_NAME,
        mode: 'words',
        wordCount: GENERATION.length,
        lang: DICT_NAME,
        seed: SEED,
        dictHash,
        setup: { config: CONFIG, generation: GENERATION, declaration: DECLARATION },
        serverMetrics: { wpm: 113, raw: 118, acc: 0.98, consistency: 0.84 },
        serverScore: {
          version: 1,
          total: 12_480,
          base: 11_200,
          comboPeak: 34,
          accMultiplier: 1.07,
          timeBonus: null,
          modMultiplier: 1
        },
        grade: 'S',
        achievedAt: '2026-07-20T10:15:00.000Z'
      })
    })
  })

  await page.route(/\/api\/v1\/runs\/[^/?]+\/replay\/log(\?|$)/, (route) => {
    if (logStatus !== null) {
      return route.fulfill({
        status: logStatus,
        contentType: 'application/json',
        body: '{"error":"internal","message":"log unavailable"}'
      })
    }
    // Off to the real socket, same path. The STORED gzip bytes come back with
    // `Content-Encoding: gzip`, immutable, ETag'd by run id — see the note on
    // `startLogServer` for why this one route is not fulfilled in-process.
    return route.continue({ url: `${origin}${new URL(route.request().url()).pathname}` })
  })

  return {
    displayName: REPLAY_DISPLAY_NAME,
    dictHash,
    logBytes: { gzip: LOG_GZIP.byteLength, json: Buffer.byteLength(LOG_JSON, 'utf8') },
    recoverLog: () => {
      logStatus = null
    }
  }
}
