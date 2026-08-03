/**
 * Match session store — the C1 realtime match client (TypeMore_back/docs/PROTOCOL.md,
 * TypeMore_back/docs/MATCH.md) over an injected `MatchTransport`.
 *
 * DI mirrors the timer seam: `init(transport?)` takes the transport (tests
 * pass a `LoopbackTransport`; production defaults to `createMatchTransport()`)
 * — no global singleton. `DemoFeed` stays a test harness behind the same
 * `GhostDriver.append` seam this store feeds from `peer_batch`.
 *
 * Timing (game-architecture.md "Match timing model"): the server announces
 * `goAtServerMs`; the NTP offset schedules the local go, which anchors the
 * match clock. One local timer (teed through `attachTimer`) plus a coarse
 * interval drive ghost settling; `advance()` is the optional smooth-display
 * hook (rAF on the match screen).
 *
 * Authority: results come from LOGS, never from network arrival — standings
 * fold each player's relayed log (words mode: the log's completion instant;
 * time mode: scoreV2 under that player's OWN frozen freemods, MATCH.md §3).
 * Match runs are NEVER POSTed to /api/v1/runs — the server captures them.
 *
 * Protocol honesty: the dictionary fetched for `settings.lang` must hash
 * (`dictVersion`, FNV-1a) to `settings.dictHash`; a mismatch is a blocking
 * `matchError` — REPORTED, never silently adapted. Per-peer `GameEvent.seq`
 * gaps (server-side slow-consumer drop) freeze that ghost as `desynced`;
 * duplicates (reconnect backlog) are idempotently ignored.
 */
import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'

import {
  type CharCounts,
  type CoreConfig,
  type Dictionary,
  type FailReason,
  type GameEvent,
  type GameState,
  type GenerationConfig,
  type GenerationTextSource,
  type ModsDeclaration,
  asMs,
  computeMetrics,
  dictVersion,
  foldLog,
  generateWords,
  initialState,
  makeSeedContext,
  minSpeedFailInstant,
  modMultiplierV1,
  progressOf,
  scoreV2OfLog,
  settle
} from '@typemore/core'
import { liveMeasureAt } from '@shared/lib/helpers/live-window'
import {
  type ChatFrame,
  type ChatKind,
  type ClientCommand,
  type CountdownFrame,
  type ErrorCode,
  type Freemods,
  type MatchEndFrame,
  type MatchEndReason,
  type MatchEndResult,
  type MatchTransport,
  type NtpSync,
  type PeerBatchEvent,
  type PeerStatusFrame,
  type RoomSettings,
  type RoomStateFrame,
  type TransportEvent,
  type TransportState,
  type Unsubscribe,
  EventBatcher,
  measureRtt,
  sampleNtp
} from '@shared/match-transport'
import {
  type GameSession,
  type GameStore,
  type GameView,
  releaseGameStore,
  useGameStore
} from '@entities/game'
import { useConfigStore } from '@/entities/config/model/store'
import { type GameTimer, type TimerWorkerLike, useGameTimer } from '@shared/lib/hooks/useGameTimer'

import { DEFAULT_GHOST_DELAY_MS, GhostDriver } from './ghost-driver'
import { createMatchTransport } from './create-transport'
import {
  freemodsConfig,
  isQuoteMatch,
  loadMatchDictionary,
  loadMatchQuote,
  matchGeneration,
  scoringGeneration
} from './match-setup'
import { rankStandings } from './standings'

/**
 * Stand-in for the word list a quote match never reads: the core takes a
 * dictionary to derive the seed context's content hash, and for a quote that
 * hash comes from the text instead (`makeSeedContext`, shared/core).
 */
const EMPTY_DICTIONARY: Dictionary = { name: '', bcp47: '', words: [] }

/** The session's dedicated local game-store id — never 'local' (the solo run). */
export const MATCH_SESSION_STORE_ID = 'match:session'

export type MatchPhase =
  'idle' | 'lobby' | 'countdown' | 'running' | 'waiting' | 'eliminated' | 'results' | 'error'

export interface ChatEntry {
  readonly id: string
  /** Sender playerId, or 'system'. */
  readonly from: 'system' | string
  readonly nick?: string
  readonly kind?: ChatKind
  readonly text: string
  readonly ts: number
}

export interface ConnectionError {
  readonly kind: 'version-mismatch' | 'protocol-violation' | 'transport'
  readonly message: string
}

export interface MatchError {
  readonly kind: 'dict-hash-mismatch' | 'setup-failed'
  readonly message: string
}

export interface PeerMetrics {
  readonly wpm: number
  /** Unadjusted speed — what they typed, mistakes included. */
  readonly raw: number
  /** Accuracy fraction in [0, 1]. */
  readonly acc: number
  /** correct / incorrect / extra / missed, as the results table shows them. */
  readonly chars: CharCounts
  /** Canonical target-based progress in [0, 1] (`progressOf`, shared/core) — extras never advance it. */
  readonly progress: number
}

export type PeerViewStatus =
  'racing' | 'finished' | 'eliminated' | 'dnf' | 'left' | 'disconnected' | 'desynced'

/**
 * A peer's position in the TARGET text, in field coordinates — the anchor the
 * in-field ghost carets render at. Same rule as the canonical progress: extra
 * (over-typed) characters move a caret on the typist's OWN screen but occupy no
 * target position, so `charIndex` is clamped to the word's length. Without the
 * clamp a peer who over-types drifts ahead of where they actually are.
 */
export interface GhostCaretAnchor {
  readonly wordIndex: number
  readonly charIndex: number
}

export interface PeerView {
  readonly playerId: string
  readonly nick: string
  readonly view: GameView
  readonly metrics: PeerMetrics
  /**
   * Live race points: the ghost fold's combo base × this peer's frozen mod
   * multiplier — the same pair the final standings' scoreV2 total is built
   * from, minus the finalize-only factors (acc², time bonus). Comparable
   * across seats because every seat is measured the same way.
   */
  readonly points: number
  /** Current scoring streak of the ghost fold (0 right after a break). */
  readonly combo: number
  readonly status: PeerViewStatus
  /** Why this peer is out, replayed from ITS log under ITS frozen freemods; `null` while racing/finished. */
  readonly failReason: FailReason | null
  /** Where to draw this peer's caret in the local field (see {@link GhostCaretAnchor}). */
  readonly caret: GhostCaretAnchor
}

export interface StandingRow {
  rank: number
  readonly playerId: string
  readonly nick: string
  readonly isSelf: boolean
  readonly status: 'finished' | 'dnf' | 'left'
  /** Words mode, finishers only: the LOG's completion instant (ms from the run start). */
  readonly finishTimeMs?: number
  /** scoreV2 total under this player's OWN frozen freemods (MATCH.md §3). */
  readonly score?: number
  readonly wpm?: number
  /** Unadjusted speed — every keystroke, right or wrong. */
  readonly raw?: number
  /** Accuracy fraction in [0, 1]. */
  readonly acc?: number
  /** correct / incorrect / extra / missed at the row's measurement instant. */
  readonly chars?: CharCounts
  /**
   * Set when the run ended on a freemod rule (master/expert miss, MinSpeed floor).
   * The wire status is a plain `finished` — the reason is proven by replaying the
   * player's own log, and it ranks them BELOW every true finisher (MATCH.md §1).
   */
  readonly failReason?: FailReason
  /** Canonical progress at the run's end instant — the tie-break among eliminated players. */
  readonly progress: number
  readonly freemods: Freemods
  /**
   * Server-measured idle share of this seat's match window, 0..1 (`match_end`).
   * Arrival-derived — the server never parses events — so it is the ONE metric
   * here that survives a client with no log at all.
   */
  readonly afkShare?: number
}

/**
 * Why the local run ended. `'reload'` is not a game rule: the page was
 * reloaded mid-match, so the run was forfeited (see `forfeitStaleSeat`).
 */
export type OutcomeReason = FailReason | 'reload' | 'idle'

/** The local player's own result while the match runs on without them (elimination screen). */
export interface SelfOutcome {
  readonly reason: OutcomeReason
  readonly wpm: number
  /** Accuracy fraction in [0, 1]. */
  readonly acc: number
  readonly score: number | null
  readonly progress: number
}

export interface MatchSessionOptions {
  /** Dictionary source; defaults to the shared server-dictionary fetch. */
  readonly loadDictionary?: (lang: string) => Promise<Dictionary>
  /** Timer-worker factory; defaults to the real worker (dynamic import keeps tests transform-free). */
  readonly createTimerWorker?: () => TimerWorkerLike
  /** Ghost jitter-buffer display delay. Default {@link DEFAULT_GHOST_DELAY_MS}. */
  readonly ghostDelayMs?: number
  /**
   * Client idle-kick tuning (tests scale the clocks down). Defaults to the
   * exported AFK_KICK_* constants — the production numbers documented in
   * MATCH.md next to the server's.
   */
  readonly afkKick?: {
    readonly streakMs?: number
    readonly shareThreshold?: number
    readonly warmupMs?: number
  }
}

interface PeerRecord {
  readonly playerId: string
  readonly nick: string
  readonly freemods: Freemods
  readonly config: CoreConfig
  /** Built once the dictionary/words resolve; events buffer in `log` meanwhile. */
  driver: GhostDriver | null
  readonly log: GameEvent[]
  /** Last applied event seq — the dup filter and gap detector read this. */
  lastSeq: number
  wireStatus: 'racing' | 'finished' | 'dnf' | 'left' | 'disconnected'
  desynced: boolean
}

/**
 * The match's AFK accounting granularity (PROTOCOL.md §6, mirrored by the
 * loopback server): idle time is counted in whole GO-anchored one-second
 * buckets, and a bucket with at least one relayed event is active.
 */
const AFK_BUCKET_MS = 1000

/**
 * Client idle-kick rule (TypeMore_back/docs/MATCH.md "AFK") — the client kick is a COURTESY,
 * the server's sweep is the AUTHORITY. The server judges two rules
 * (protocol.go / loopback mirror): TRAILING — 15 000 ms with no accepted
 * batch, every mode; SHARE — idle ≥ 0.6 of the GO-anchored window after a
 * 10 000 ms warmup, words mode. Every client number below sits strictly
 * INSIDE its server counterpart, so an honest seat always leaves by its own
 * rule, with its own screen, before the sweep; the margins also absorb the
 * batcher's flush latency and the sweep's one-second cadence. The pairs are
 * asserted against the loopback constants by `afk-kick.test.ts`.
 */
export const AFK_KICK_STREAK_MS = 12_000
export const AFK_KICK_SHARE_CLIENT = 0.55
export const AFK_KICK_WARMUP_MS = 8_000

const NO_DECLARATION: ModsDeclaration = { blind: false, fading: false, flashlight: false }
/** A peer with no ghost core yet has typed nothing — not "unknown", zero. */
const EMPTY_CHARS: CharCounts = { correct: 0, incorrect: 0, extra: 0, missed: 0 }
/** Defensive only: a match_end result whose seat is missing from the frozen countdown roster. */
const FALLBACK_FREEMODS: Freemods = { difficulty: 'normal', minWpm: 0, nospace: false }
/**
 * The reload forfeit's outcome. Every number is zero/null on purpose: the
 * event log, the seq counter and the t = 0 anchor died with the page, so there
 * is nothing left to measure — claiming a wpm here would be inventing one.
 */
const RELOAD_FORFEIT: SelfOutcome = { reason: 'reload', wpm: 0, acc: 0, score: null, progress: 0 }
const ADVANCE_INTERVAL_MS = 50
const COUNTDOWN_TICK_MS = 50
/**
 * The match clock runs until `match_end`, not until the local run ends, so it is
 * armed for far longer than any match: the session stops it explicitly.
 */
const MATCH_CLOCK_MS = 86_400_000
const EMPTY_STATE: GameState = initialState()
const EMPTY_WORDS: readonly string[] = []
const EMPTY_VIEW: GameView = {
  snapshot: EMPTY_STATE,
  words: EMPTY_WORDS,
  wordIndex: 0,
  finished: false,
  blind: false
}

/**
 * Δ2 reload-resume: the resume token lives in sessionStorage (per-tab — two
 * tabs in one browser hold distinct seats) so an accidental page reload can
 * reclaim the seat within the server's grace window. Cleared on kick/leave.
 */
const RESUME_TOKEN_KEY = 'typemore:matchResume'

function readStoredResumeToken(): string | null {
  try {
    return globalThis.sessionStorage?.getItem(RESUME_TOKEN_KEY) ?? null
  } catch {
    return null
  }
}

function storeResumeToken(token: string): void {
  try {
    globalThis.sessionStorage?.setItem(RESUME_TOKEN_KEY, token)
  } catch {
    /* storage unavailable (SSR/tests) — reload-resume simply degrades */
  }
}

function clearStoredResumeToken(): void {
  try {
    globalThis.sessionStorage?.removeItem(RESUME_TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

export const useMatchSessionStore = defineStore('matchSession', () => {
  const config = useConfigStore().config

  // ── reactive surface ────────────────────────────────────────────────────
  const connection = ref<TransportState>('disconnected')
  const connectionError = ref<ConnectionError | null>(null)
  const room = ref<RoomStateFrame | null>(null)
  const selfId = ref<string | null>(null)
  /** True when init presented a stored resume token (Δ2 reload-resume) — the /room guard waits on it. */
  const resumeAttempted = ref(false)
  const isHost = computed(
    () => room.value !== null && selfId.value !== null && room.value.hostPlayerId === selfId.value
  )
  const chatLog = ref<ChatEntry[]>([])
  const lastError = ref<{ code: ErrorCode; message: string } | null>(null)
  const phase = ref<MatchPhase>('idle')
  const countdownMsLeft = ref<number | null>(null)
  /**
   * The server's 32-bit match seed (PROTOCOL.md §4 `countdown.seed`), held for
   * the match surface: the field schedules its display canaries from it. Set
   * the moment the countdown frame lands — quote matches carry one too, and
   * the canary schedule is generation-independent, so it applies to both text
   * paths. `null` outside a match.
   */
  const matchSeed = ref<number | null>(null)
  const matchError = ref<MatchError | null>(null)
  const standings = ref<StandingRow[] | null>(null)
  /** Δ3: why the server ended the match — the results screen may surface it. */
  const matchEndReason = ref<MatchEndReason | null>(null)
  /** Δ2: this seat forfeited a match the page cannot play (see `forfeitStaleSeat`). */
  const reloadForfeit = ref(false)
  /** This seat gave its run up for going idle (see `judgeIdle`). */
  const afkForfeit = ref(false)
  /**
   * How far this seat is into the idle rule, 0…1 — a meter the match screen can
   * fill so the kick is never a surprise. Only meaningful while `running`.
   */
  const afkProgress = ref(0)
  /** Match-clock instant of the last relayed local event; GO is activity zero. */
  let lastActivityMs = 0
  /** How many GO-anchored one-second buckets carried at least one local event. */
  let activeBucketCount = 0
  let lastActiveBucket = -1

  /**
   * Round-trip time to the server in ms, or `null` while it has never been
   * measured. This is OUR ping and only ours: the protocol carries no peer
   * latency, so a room cannot show anybody else's without a new frame.
   */
  const pingMs = ref<number | null>(null)

  const localRef = shallowRef<GameStore | null>(null)
  const peerRecords = shallowRef<readonly PeerRecord[]>([])
  /** Bumped on non-reactive record mutations (status/desync) to refresh `peers`. */
  const peersRev = ref(0)

  // ── non-reactive internals ──────────────────────────────────────────────
  let transport: MatchTransport | null = null
  let batcher: EventBatcher | null = null
  let batcherArmed = false
  let ntp: NtpSync | null = null
  let unsubs: Unsubscribe[] = []
  let initPromise: Promise<void> | null = null
  let deps: Required<Pick<MatchSessionOptions, 'loadDictionary'>> & {
    createTimerWorker: (() => TimerWorkerLike) | null
    ghostDelayMs: number
    afkStreakMs: number
    afkShareThreshold: number
    afkWarmupMs: number
  } = {
    loadDictionary: loadMatchDictionary,
    createTimerWorker: null,
    ghostDelayMs: DEFAULT_GHOST_DELAY_MS,
    afkStreakMs: AFK_KICK_STREAK_MS,
    afkShareThreshold: AFK_KICK_SHARE_CLIENT,
    afkWarmupMs: AFK_KICK_WARMUP_MS
  }

  const peerMap = new Map<string, PeerRecord>()
  let countdownFrame: CountdownFrame | null = null
  let matchId: string | null = null
  /** Δ2: the match already forfeited by this store — the re-send guard. */
  let forfeitedMatchId: string | null = null
  let matchWords: readonly string[] = []
  let scoreGen: GenerationConfig | null = null
  let selfConfig: CoreConfig | null = null
  let selfFreemods: Freemods | null = null
  let selfNick = ''
  let setupReady = false
  let goReached = false
  let matchToken = 0
  let pendingFinish = false
  let outCursor = 0
  let goAnchorPerf: number | null = null
  let countdownTimer: number | null = null
  /** Local `Date.now()` instant of the server's go — the anchor's zero point. */
  let goLocalMs: number | null = null
  /** Session-owned cadence for the ghost fan-out (see `startMatchClock`). */
  let matchClock: GameTimer | null = null
  /** Which arming of the match clock is current — see `startMatchClock`. */
  let matchClockEpoch = 0
  let advanceTimer: number | null = null
  let chatCounter = 0

  // ── views ───────────────────────────────────────────────────────────────
  const peers = computed<PeerView[]>(() => {
    void peersRev.value
    return peerRecords.value.map((rec) => {
      const metrics = rec.driver?.metrics.value ?? null
      const live = rec.driver?.liveScore.value ?? null
      return {
        playerId: rec.playerId,
        nick: rec.nick,
        view: rec.driver?.view ?? EMPTY_VIEW,
        metrics: {
          wpm: metrics?.wpm ?? 0,
          // The ghost's core computes the whole `Metrics`; publishing only wpm
          // meant the results table could show a peer's speed but not what it
          // cost them. Same fold, two more fields.
          raw: metrics?.raw ?? 0,
          acc: metrics?.accuracy ?? 0,
          chars: metrics?.chars ?? EMPTY_CHARS,
          progress: peerProgress(rec)
        },
        points: (live?.base ?? 0) * peerModMultiplier(rec),
        combo: live?.streak ?? 0,
        status: statusOf(rec),
        failReason: rec.driver?.view.snapshot.failReason ?? null,
        caret: caretOf(rec)
      }
    })
  })

  /**
   * The peer's frozen mod multiplier — exactly the one `scoreV2OfLog` will
   * apply to this seat at match end (own freemods, no visual-mod declaration:
   * those never travel the wire). Pure arithmetic over two small configs, so
   * recomputing per `peers` evaluation costs nothing worth caching.
   */
  function peerModMultiplier(rec: PeerRecord): number {
    if (scoreGen === null) return 1
    return modMultiplierV1({ generation: scoreGen, config: rec.config }, NO_DECLARATION)
  }

  function statusOf(rec: PeerRecord): PeerViewStatus {
    if (rec.wireStatus === 'dnf' || rec.wireStatus === 'left') return rec.wireStatus
    // A freemod fail is proven by the peer's OWN ghost core (same frozen
    // config) — the wire only ever reports a plain `finished` for it.
    if ((rec.driver?.view.snapshot.failReason ?? null) !== null) return 'eliminated'
    if (rec.wireStatus === 'finished') return 'finished'
    return rec.desynced ? 'desynced' : rec.wireStatus
  }

  /**
   * Canonical progress (shared/core `progressOf`): committed target characters
   * plus filled target positions of the active word. Extra characters shift a
   * caret, never a player's position in the race — the one definition the HUD,
   * this rail and the standings tie-breaks all read.
   */
  function peerProgress(rec: PeerRecord): number {
    const driver = rec.driver
    if (driver === null) return 0
    return progressOf({ config: rec.config, words: matchWords }, driver.view.snapshot)
  }

  /** The peer's caret in target coordinates — see {@link GhostCaretAnchor}. */
  function caretOf(rec: PeerRecord): GhostCaretAnchor {
    const snapshot = rec.driver?.view.snapshot
    if (snapshot === undefined) return { wordIndex: 0, charIndex: 0 }
    const wordIndex = snapshot.wordIndex
    const target = (matchWords[wordIndex] ?? '').length
    const typed = (snapshot.input[wordIndex] ?? '').length
    return { wordIndex, charIndex: typed < target ? typed : target }
  }

  /** GameView + input sink for `<GameField>`. Input is gated to the running phase. */
  const selfView: GameSession = {
    get snapshot() {
      return localRef.value?.snapshot ?? EMPTY_STATE
    },
    get words() {
      return localRef.value?.words ?? EMPTY_WORDS
    },
    get wordIndex() {
      return localRef.value?.wordIndex ?? 0
    },
    get finished() {
      return localRef.value?.phase === 'finished'
    },
    get blind() {
      // Personal visual mod: client-local, never on the wire, never scored (MATCH.md §2.3).
      return config.blind === true
    },
    insert: (text) => withInput((local) => local.insert(text)),
    replace: (from, to, text, source) =>
      withInput((local) => local.replace(from, to, text, source)),
    deleteBackward: (unit) => withInput((local) => local.deleteBackward(unit)),
    commit: () => withInput((local) => local.commit())
  }

  function withInput(action: (local: GameStore) => void): void {
    const local = localRef.value
    if (local === null || phase.value !== 'running') return
    action(local)
    drainOutgoing()
  }

  /** Feed every newly-accepted local event into the batcher (input → core → batcher → wire). */
  function drainOutgoing(): void {
    const local = localRef.value
    if (local === null || batcher === null || !batcherArmed) return
    const data = local.getReplayData()
    if (data === null) return
    const before = outCursor
    while (outCursor < data.log.length) {
      batcher.push(data.log[outCursor])
      outCursor += 1
    }
    // Idle accounting rides the SAME stream the server sees: anything that
    // just went to the batcher is activity, stamped on the match clock. Drain
    // lags the keystroke by at most one advance tick — noise against
    // one-second buckets.
    if (outCursor > before && goAnchorPerf !== null) {
      const matchNow = performance.now() - goAnchorPerf
      lastActivityMs = matchNow
      const bucket = Math.floor(matchNow / AFK_BUCKET_MS)
      if (bucket >= 0 && bucket !== lastActiveBucket) {
        lastActiveBucket = bucket
        activeBucketCount += 1
      }
    }
  }

  // ── lifecycle ───────────────────────────────────────────────────────────
  /**
   * Idempotent: connects the (injected or default) transport, samples the NTP
   * offset, and subscribes the frame handlers. Failures surface on
   * `connectionError` — init itself never rejects.
   */
  async function init(injected?: MatchTransport, options?: MatchSessionOptions): Promise<void> {
    if (initPromise !== null) return initPromise
    const attempt = doInit(injected, options).catch((error: unknown) => {
      connectionError.value ??= {
        kind: 'transport',
        message: error instanceof Error ? error.message : String(error)
      }
      initPromise = null
    })
    initPromise = attempt
    return attempt
  }

  async function doInit(injected?: MatchTransport, options?: MatchSessionOptions): Promise<void> {
    deps = {
      loadDictionary: options?.loadDictionary ?? loadMatchDictionary,
      createTimerWorker: options?.createTimerWorker ?? null,
      ghostDelayMs: options?.ghostDelayMs ?? DEFAULT_GHOST_DELAY_MS,
      afkStreakMs: options?.afkKick?.streakMs ?? AFK_KICK_STREAK_MS,
      afkShareThreshold: options?.afkKick?.shareThreshold ?? AFK_KICK_SHARE_CLIENT,
      afkWarmupMs: options?.afkKick?.warmupMs ?? AFK_KICK_WARMUP_MS
    }
    transport = injected ?? createMatchTransport()
    // Batcher first: its hello_ok listener must drain parked batches BEFORE the
    // session's own hello_ok handler re-sends a pending `finish`.
    batcher = new EventBatcher({ transport })
    unsubs.push(transport.onState((state) => (connection.value = state)))
    unsubs.push(transport.onEvent(handleEvent))
    connection.value = transport.state
    if (deps.createTimerWorker === null) {
      // Dynamic on purpose: the real factory carries the Vite `?worker` build
      // transform, which must stay out of the unit-test module graph (tests
      // always inject their own factory; see the game store's timer seam note).
      const module = await import('@shared/lib/hooks/createTimerWorker')
      deps.createTimerWorker = module.createTimerWorker
    }
    const storedToken = readStoredResumeToken()
    resumeAttempted.value = storedToken !== null
    await transport.connect({ resumeToken: storedToken ?? undefined })
    selfId.value = transport.playerId
    ntp = await sampleNtp(transport)
    // The sync already paid for the round trips; `minRtt` is the same number a
    // later `measurePing` would go and fetch.
    pingMs.value = Math.round(ntp.minRtt)
  }

  /** Guards against two overlapping measurements racing for the same pongs. */
  let pinging = false

  /**
   * Re-measure the round trip. Silent on failure: a ping that times out is a
   * number missing from a status line, and turning that into a visible error
   * would be louder than the fact deserves. Returns once the value has landed.
   */
  async function measurePing(): Promise<void> {
    if (transport === null || pinging) return
    pinging = true
    try {
      pingMs.value = Math.round(await measureRtt(transport))
    } catch {
      pingMs.value = null
    } finally {
      pinging = false
    }
  }

  function dispose(): void {
    stopCountdownTicker()
    stopAdvance()
    stopMatchClock()
    for (const unsub of unsubs) unsub()
    unsubs = []
    batcher?.dispose()
    batcher = null
    batcherArmed = false
    transport?.disconnect()
    transport = null
    ntp = null
    initPromise = null
    matchToken += 1
    resetMatchState()
    if (localRef.value !== null) {
      localRef.value = null
      releaseGameStore(MATCH_SESSION_STORE_ID)
    }
    room.value = null
    chatLog.value = []
    selfId.value = null
    connection.value = 'disconnected'
    connectionError.value = null
    pingMs.value = null
    lastError.value = null
    standings.value = null
    matchError.value = null
    phase.value = 'idle'
    matchEndReason.value = null
  }

  /** Clears per-match state (records, clocks, buffers). Leaves room/phase to the caller. */
  function resetMatchState(): void {
    stopCountdownTicker()
    stopAdvance()
    stopMatchClock()
    if (batcherArmed) {
      batcher?.endMatch()
      batcherArmed = false
    }
    peerMap.clear()
    peerRecords.value = []
    peersRev.value += 1
    countdownFrame = null
    matchId = null
    matchSeed.value = null
    forfeitedMatchId = null
    reloadForfeit.value = false
    matchWords = []
    scoreGen = null
    selfConfig = null
    selfFreemods = null
    matchEndReason.value = null
    setupReady = false
    goReached = false
    pendingFinish = false
    outCursor = 0
    afkForfeit.value = false
    afkProgress.value = 0
    lastActivityMs = 0
    activeBucketCount = 0
    lastActiveBucket = -1
    goAnchorPerf = null
    goLocalMs = null
    countdownMsLeft.value = null
  }

  // ── inbound frames ──────────────────────────────────────────────────────
  function handleEvent(event: TransportEvent): void {
    switch (event.type) {
      case 'hello_ok':
        selfId.value = event.playerId
        // Δ2: persist the rotated token so a page reload can reclaim the seat.
        storeResumeToken(event.resumeToken)
        if (pendingFinish) trySendFinish()
        return
      case 'error':
        lastError.value = { code: event.code, message: event.message }
        return
      case 'room_state':
        onRoomState(event)
        return
      case 'countdown':
        void onCountdown(event)
        return
      case 'chat':
        onChat(event)
        return
      case 'kicked':
        resetMatchState()
        room.value = null
        phase.value = 'idle'
        clearStoredResumeToken() // a reload must not rejoin a room we were kicked from
        return
      case 'peer_batch':
        onPeerBatch(event)
        return
      case 'peer_status':
        onPeerStatus(event)
        return
      case 'match_end':
        onMatchEnd(event)
        return
      case 'version-mismatch':
        connectionError.value = { kind: 'version-mismatch', message: event.message }
        return
      case 'protocol-violation':
        connectionError.value = {
          kind: 'protocol-violation',
          message: `${event.violation.reason}${event.violation.frameType ? ` (${event.violation.frameType})` : ''}: ${event.violation.message}`
        }
        return
      default:
        // ntp_pong (consumed by sampleNtp), connection, reconnecting, resumed.
        return
    }
  }

  function onRoomState(frame: RoomStateFrame): void {
    // The chat lives with the ROOM, not with the connection: a different code
    // is a different lobby, and the old one's history must not follow the
    // player there. (Leaving already nulls `room`, so a re-join — even to the
    // same code — starts clean too.)
    if (room.value?.code !== frame.code) chatLog.value = []
    room.value = frame
    const self = frame.players.find((player) => player.playerId === selfId.value)
    if (self !== undefined) selfNick = self.nick
    if (phase.value === 'idle') phase.value = 'lobby'
    forfeitStaleSeat(frame)
  }

  /**
   * Δ2 reload FORFEIT. `room_state.match` says this seat sits in a RUNNING
   * match; when that is not the match this store is playing, the page cannot
   * play it: a reload took the event log, the `seq` counter and the t = 0
   * anchor with it, and restarting `seq` would corrupt every peer's ghost core
   * and the server's capture. The run is unrecoverable, so the honest move is
   * to give the seat up at once — otherwise the server keeps us `racing` and
   * everyone else waits out the AFK rule or the hard deadline.
   *
   * A phase of countdown/running/waiting/eliminated means this page IS playing
   * a match, so a foreign matchId there is a stale frame, never a reload.
   */
  function forfeitStaleSeat(frame: RoomStateFrame): void {
    const running = frame.match
    if (
      running === undefined ||
      running.matchId === matchId ||
      running.matchId === forfeitedMatchId
    )
      return
    if (
      phase.value === 'countdown' ||
      phase.value === 'running' ||
      phase.value === 'waiting' ||
      phase.value === 'eliminated'
    )
      return
    forfeitedMatchId = running.matchId
    // Adopt it as the active match so the `match_end` this forfeit provokes
    // passes `onMatchEnd`'s guard and the results screen actually appears.
    matchId = running.matchId
    reloadForfeit.value = true
    phase.value = 'eliminated'
    trySendFinish()
  }

  function onChat(frame: ChatFrame): void {
    chatCounter += 1
    const sender =
      frame.from === 'system'
        ? undefined
        : room.value?.players.find((player) => player.playerId === frame.from)
    chatLog.value.push({
      id: `chat-${chatCounter}`,
      from: frame.from,
      nick: sender?.nick,
      kind: frame.kind,
      text: frame.text,
      ts: frame.ts
    })
  }

  /**
   * peer_batch → seq bookkeeping → GhostDriver. Duplicates (seq ≤ last applied,
   * reconnect backlog overlap) are ignored idempotently; a GAP freezes the peer
   * as `desynced` — nothing past the gap is ever dispatched, others unaffected.
   */
  function onPeerBatch(event: PeerBatchEvent): void {
    const rec = peerMap.get(event.playerId)
    if (rec === undefined || rec.desynced) return
    const fresh = event.events.filter((entry) => entry.seq > rec.lastSeq)
    if (fresh.length === 0) return
    let expected = rec.lastSeq + 1
    for (const entry of fresh) {
      if (entry.seq !== expected) {
        rec.desynced = true
        peersRev.value += 1
        return
      }
      expected += 1
    }
    rec.lastSeq = expected - 1
    rec.log.push(...fresh)
    rec.driver?.append(fresh)
    peersRev.value += 1
  }

  function onPeerStatus(frame: PeerStatusFrame): void {
    const rec = peerMap.get(frame.playerId)
    switch (frame.status) {
      case 'finished':
      case 'dnf':
      case 'left':
        // Δ3: presentation only — the match ends solely on `match_end`.
        if (rec !== undefined) {
          rec.wireStatus = frame.status
          peersRev.value += 1
        }
        return
      case 'disconnected':
        if (rec !== undefined && rec.wireStatus === 'racing') {
          rec.wireStatus = 'disconnected'
          peersRev.value += 1
        }
        return
      case 'reconnected':
        if (rec !== undefined && rec.wireStatus === 'disconnected') {
          rec.wireStatus = 'racing'
          peersRev.value += 1
        }
        return
      case 'joined':
        return
    }
  }

  // ── countdown → server-authoritative setup ────────────────────────────────
  async function onCountdown(frame: CountdownFrame): Promise<void> {
    resetMatchState()
    matchToken += 1
    const token = matchToken
    countdownFrame = frame
    matchId = frame.matchId
    matchSeed.value = frame.seed
    matchError.value = null
    standings.value = null
    phase.value = 'countdown'

    // Sync bookkeeping FIRST: peer batches may arrive while the dictionary loads.
    const roomPlayers = room.value?.players ?? []
    const selfEntry = frame.players.find((player) => player.playerId === selfId.value)
    selfFreemods = selfEntry?.freemods ?? null
    selfConfig = selfEntry !== undefined ? freemodsConfig(frame.settings, selfEntry.freemods) : null
    const records: PeerRecord[] = frame.players
      .filter((player) => player.playerId !== selfId.value)
      .map((player) => ({
        playerId: player.playerId,
        nick:
          roomPlayers.find((seat) => seat.playerId === player.playerId)?.nick ??
          player.playerId.slice(0, 8),
        freemods: player.freemods,
        config: freemodsConfig(frame.settings, player.freemods),
        driver: null,
        log: [],
        lastSeq: 0,
        wireStatus: 'racing',
        desynced: false
      }))
    peerMap.clear()
    for (const rec of records) peerMap.set(rec.playerId, rec)
    peerRecords.value = records
    peersRev.value += 1
    startCountdownTicker(frame)

    if (selfEntry === undefined || selfConfig === null) {
      failSetup(
        `countdown does not list this client (${selfId.value ?? 'no playerId'}) among its players`
      )
      return
    }
    /*
     * Two text paths, and only one of them involves a dictionary. A QUOTE match
     * resolves its bytes by id and needs neither a word list nor a hash check —
     * the quote is immutable, so the id IS the guarantee that every seat types
     * the same characters, and quote-only languages (`code_python`) have no
     * dictionary to fetch in the first place. A seeded match keeps the fetch and
     * the fingerprint check exactly as before.
     */
    const quoteMatch = isQuoteMatch(frame.settings)
    let quoteSource: GenerationTextSource | undefined
    if (quoteMatch) {
      try {
        quoteSource = await loadMatchQuote(frame.settings)
      } catch (error) {
        if (token === matchToken)
          failSetup(
            `quote '${frame.settings.textSource.quoteId ?? ''}' failed to load: ${error instanceof Error ? error.message : String(error)}`
          )
        return
      }
      if (token !== matchToken) return
    }

    const generation = matchGeneration(frame.settings, quoteSource)
    if (generation === null) {
      failSetup(
        `countdown settings are missing ${frame.settings.mode === 'time' ? 'durationMs' : 'wordCount'} for mode '${frame.settings.mode}'`
      )
      return
    }

    let dictionary: Dictionary = EMPTY_DICTIONARY
    if (!quoteMatch) {
      try {
        dictionary = await deps.loadDictionary(frame.settings.lang)
      } catch (error) {
        if (token === matchToken)
          failSetup(
            `dictionary '${frame.settings.lang}' failed to load: ${error instanceof Error ? error.message : String(error)}`
          )
        return
      }
      if (token !== matchToken) return

      const actualHash = dictVersion(dictionary.words)
      if (actualHash !== frame.settings.dictHash) {
        matchError.value = {
          kind: 'dict-hash-mismatch',
          message: `dictionary '${frame.settings.lang}' hashes to ${actualHash}, server expects ${frame.settings.dictHash}`
        }
        phase.value = 'error'
        stopCountdownTicker()
        return
      }
    }

    const generated = generateWords(dictionary, makeSeedContext(dictionary, frame.seed, generation))
    if (generated.isErr()) {
      failSetup(`word generation failed: ${generated.error.kind}`)
      return
    }
    matchWords = generated.value.words
    scoreGen = scoringGeneration(generation)

    const local = localRef.value ?? (localRef.value = useGameStore(MATCH_SESSION_STORE_ID))
    local.setup({
      config: selfConfig,
      words: matchWords,
      generation: scoreGen,
      declaration: NO_DECLARATION
    })
    outCursor = 0
    // The local run's OWN timer (deadline settling). The ghost fan-out has its
    // own clock — see `startMatchClock` — so it survives this one stopping.
    if (deps.createTimerWorker !== null) local.attachTimer(deps.createTimerWorker)

    for (const rec of records) {
      rec.driver = new GhostDriver(
        { config: rec.config, words: matchWords },
        { delayMs: deps.ghostDelayMs }
      )
      if (rec.log.length > 0) rec.driver.append(rec.log.slice())
    }
    peersRev.value += 1
    setupReady = true
    if (goReached) startRun()
  }

  function failSetup(message: string): void {
    matchError.value = { kind: 'setup-failed', message }
    phase.value = 'error'
    stopCountdownTicker()
  }

  // ── go scheduling & the match clock ─────────────────────────────────────
  function startCountdownTicker(frame: CountdownFrame): void {
    const goAt = ntp !== null ? ntp.toLocalTime(frame.goAtServerMs) : frame.goAtServerMs
    goLocalMs = goAt
    countdownMsLeft.value = Math.max(0, goAt - Date.now())
    countdownTimer = window.setInterval(() => {
      const left = goAt - Date.now()
      if (left <= 0) {
        stopCountdownTicker()
        countdownMsLeft.value = 0
        startRun()
      } else {
        countdownMsLeft.value = left
      }
    }, COUNTDOWN_TICK_MS)
  }

  /**
   * GO. `t = 0` is the server's go instant (NTP-converted) for EVERY core in
   * this client — never the first keystroke: the local run starts here whether
   * or not the player ever types, so a timed match settles at the deadline with
   * an empty log and reports `finish` like any other completion.
   *
   * The anchor is back-dated by however late the ticker (or a slow dictionary
   * load) noticed the go instant, so the local timebase matches the server's
   * window instead of silently granting the player extra time.
   */
  function startRun(): void {
    if (phase.value !== 'countdown') return
    goReached = true
    if (!setupReady || matchId === null || batcher === null) return
    countdownMsLeft.value = null
    const lateBy = goLocalMs === null ? 0 : Math.max(0, Date.now() - goLocalMs)
    goAnchorPerf = performance.now() - lateBy
    // The batch frames carry THIS run's event-log version (v2 ⇒ telemetry
    // events ride along in the batches; the relay treats them as opaque).
    batcher.startMatch(matchId, localRef.value?.logVersion)
    batcherArmed = true
    phase.value = 'running'
    localRef.value?.start(goAnchorPerf)
    startMatchClock()
    advanceTimer = window.setInterval(() => advance(), ADVANCE_INTERVAL_MS)
  }

  /**
   * Advance the shared match clock (ghost fan-out). Driven by the coarse
   * interval, the match-clock worker tick, and optionally a rAF loop on the
   * screen. Deliberately independent of local input AND of the local run's
   * state: opponents keep settling to their own deadlines after the local
   * player finishes, is eliminated, or never types at all.
   */
  function advance(): void {
    if (goAnchorPerf === null) return
    const matchNow = performance.now() - goAnchorPerf
    for (const rec of peerRecords.value) rec.driver?.advance(matchNow)
    judgeIdle(matchNow)
  }

  /**
   * The idle kick, judged client-side first. The client's kick is a COURTESY,
   * the server's sweep is the AUTHORITY: a modified client that ignores this
   * simply sits out to the server's sweep and is dnf'd there — no honesty hole,
   * the rule only improves the exit for honest players. That courtesy carries
   * an obligation: BOTH client triggers sit strictly inside the server's rule
   * (share margin AND warmup margin — TypeMore_back/docs/MATCH.md "AFK"), so an honest seat
   * always leaves by its own rule, with its own screen, before the sweep.
   *
   * Two triggers, and the meter is the max of their progress — it reaches 1
   * exactly when the kick fires, so the kick is never a surprise:
   *
   * - STREAK — continuous silence since the last relayed local event, with GO
   *   as activity zero. This is the predictable, linear rule a player actually
   *   experiences ("touch nothing for 15s and you are out"), and it covers the
   *   canonical walked-away seat — including one that never typed at all.
   * - SHARE MIRROR — the server's own accounting (idle share of the whole
   *   GO-anchored one-second-bucket window) with a margin on both axes. A
   *   streak alone cannot dominate a share rule (scattered sub-streak idling
   *   still accumulates share), so the mirror is what makes the
   *   client-before-server guarantee hold for EVERY idling pattern.
   *
   * The kick itself is the ordinary give-up path: `finish{forfeit:true}` (a
   * frame the wire already has — recorded dnf, no phantom result) and the
   * eliminated screen. No new wire entity.
   */
  function judgeIdle(matchNow: number): void {
    if (phase.value !== 'running' || matchId === null) return
    const streak = (matchNow - lastActivityMs) / deps.afkStreakMs
    const elapsed = Math.floor(matchNow / AFK_BUCKET_MS)
    const idle = Math.max(0, elapsed - activeBucketCount)
    const share = elapsed > 0 ? idle / elapsed : 0
    // Both share AND warmup must be met — min() gates the mirror the same way
    // the server gates its sweep.
    const mirror = Math.min(share / deps.afkShareThreshold, matchNow / deps.afkWarmupMs)
    const progress = Math.min(1, Math.max(0, streak, mirror))
    afkProgress.value = progress
    if (progress < 1) return
    afkForfeit.value = true
    reloadForfeit.value = true // `finish{forfeit:true}` — recorded dnf, no phantom result
    /*
     * Stop the local run's OWN clock. A run that ends by rule (master, MinSpeed)
     * or by running out of text settles its core, which stops the timer with it;
     * an idle forfeit settles nothing — the core is still `running`, so without
     * this its timer keeps ticking and the seat keeps watching its own seconds
     * and wpm move after it is already out. The ghost fan-out is unaffected: the
     * match clock is a separate timer (see `startMatchClock`).
     */
    localRef.value?.detachTimer()
    endLocalRun()
  }

  /**
   * The MATCH clock — a session-owned timer worker, separate from the local
   * run's. The local store stops its timer the instant the local core finishes
   * (right for solo), so it cannot carry the ghost fan-out past that point;
   * this one runs from go to `match_end` and keeps opponents settling in a
   * frozen/backgrounded tab, where the coarse interval is throttled.
   */
  function startMatchClock(): void {
    const createWorker = deps.createTimerWorker
    if (createWorker === null || matchClock !== null) return
    matchClock = useGameTimer(createWorker)
    // A real counter, not a constant. `stopMatchClock` calls `terminate()`,
    // which kills the worker thread but does NOT revoke messages already queued
    // on this thread — a tick posted a moment before termination is still
    // delivered, and a rematch arms the next clock right afterwards. The stale
    // tick reaches the PREVIOUS timer's handler, which closes over this same
    // session-scoped counter and therefore reads the value the new clock minted.
    matchClockEpoch += 1
    const armed = matchClockEpoch
    // Cadence only: `advance` reads the anchor itself, never the tick payload.
    matchClock.onTick((_nowMs, epoch) => {
      if (epoch !== armed) return
      advance()
    })
    matchClock.start(MATCH_CLOCK_MS, armed)
  }

  function stopMatchClock(): void {
    matchClock?.dispose()
    matchClock = null
  }

  function stopCountdownTicker(): void {
    if (countdownTimer !== null) {
      window.clearInterval(countdownTimer)
      countdownTimer = null
    }
  }

  function stopAdvance(): void {
    if (advanceTimer !== null) {
      window.clearInterval(advanceTimer)
      advanceTimer = null
    }
  }

  // ── local run end → finish ──────────────────────────────────────────────
  watch(
    () => localRef.value?.phase,
    (next) => {
      if (next === 'finished') onSelfFinished()
    }
  )

  /**
   * The local run ended — normally, or on a freemod rule (master/expert miss,
   * MinSpeed floor). Both are the SAME wire event (`finish`, PROTOCOL §4): the
   * seat is done, the match is not. A failed run enters the `eliminated` phase
   * instead of `waiting`: the transport stays connected, `peer_batch` keeps
   * flowing and the ghosts keep ticking, so being out means spectating.
   */
  function onSelfFinished(): void {
    endLocalRun()
  }

  /**
   * Hand this seat's run in. One path for all three ways a run can end — the
   * text ran out, a freemod rule ended it, or the player stopped typing — because
   * the wire has one frame for all three and the batcher has to be closed the
   * same way whichever it was.
   */
  function endLocalRun(): void {
    if (phase.value !== 'running' || batcher === null || matchId === null) return
    drainOutgoing()
    batcher.flush()
    batcher.endMatch()
    batcherArmed = false
    trySendFinish()
    // Δ3: our run is over but the match is not — others may still race.
    // `match_end` (and only it) moves the session on to the results. An idle
    // forfeit lands on the same screen as a freemod fail: the run is over and
    // the player is now a spectator.
    const out = afkForfeit.value || (localRef.value?.snapshot.failReason ?? null) !== null
    phase.value = out ? 'eliminated' : 'waiting'
  }

  /**
   * `finish{matchId}` — the one frame that ends a seat's run, for a completion,
   * a freemod fail and a forfeit alike. `forfeit: true` (the reload case) tells
   * the server there is no result behind it: the seat is recorded `dnf`, never a
   * phantom finisher, and it does not open the words-mode finish window.
   */
  function trySendFinish(): void {
    if (transport === null || matchId === null) return
    try {
      transport.send(
        reloadForfeit.value
          ? { type: 'finish', matchId, forfeit: true }
          : { type: 'finish', matchId }
      )
      pendingFinish = false
      // Δ3: no local self-settle — the server owns match end and broadcasts
      // `match_end` to every seat, ourselves included.
    } catch {
      // Disconnected mid-finish: re-sent on the next hello_ok (after the
      // batcher drained its outbox — listener order guarantees that).
      pendingFinish = true
    }
  }

  // ── match end → standings (MATCH.md §1/§3, Δ3) ──────────────────────────
  function onMatchEnd(frame: MatchEndFrame): void {
    // Desync/dup guard: only the ACTIVE match's end is meaningful here.
    if (matchId === null || frame.matchId !== matchId) return
    if (
      phase.value !== 'running' &&
      phase.value !== 'waiting' &&
      phase.value !== 'eliminated' &&
      phase.value !== 'countdown'
    )
      return
    matchEndReason.value = frame.reason
    finishMatch(frame.results)
  }

  function finishMatch(results: readonly MatchEndResult[]): void {
    stopAdvance()
    stopCountdownTicker()
    if (batcherArmed) {
      // Force-ended while still racing (deadline / finish window): disarm.
      batcher?.endMatch()
      batcherArmed = false
    }
    // Fast-forward displays so final ghost views settle (cosmetic only —
    // standings below fold the raw logs).
    const matchNow = goAnchorPerf === null ? 0 : performance.now() - goAnchorPerf
    for (const rec of peerRecords.value) rec.driver?.advance(matchNow + deps.ghostDelayMs + 2000)
    peersRev.value += 1
    standings.value = computeStandings(results)
    countdownMsLeft.value = null
    phase.value = 'results'
  }

  /**
   * Standings for a client that never saw the countdown (the reloaded seat):
   * with no frozen roster there is nothing to fold logs against, and the logs
   * are gone anyway — but the player must still see the table they forfeited
   * into instead of an empty screen. Everything here comes off the wire.
   */
  function wireOnlyStandings(results: readonly MatchEndResult[]): StandingRow[] {
    const seats = room.value?.players ?? []
    const rows = results.map((result) => {
      const seat = seats.find((player) => player.playerId === result.playerId)
      const row: StandingRow = {
        rank: 0,
        playerId: result.playerId,
        nick: seat?.nick ?? result.playerId.slice(0, 8),
        isSelf: result.playerId === selfId.value,
        status: result.status,
        progress: 0,
        freemods: seat?.freemods ?? FALLBACK_FREEMODS,
        afkShare: result.afkShare
      }
      return row
    })
    // Finishers first; nothing finer is provable without the logs.
    rows.sort((a, b) => (a.status === 'finished' ? 0 : 1) - (b.status === 'finished' ? 0 : 1))
    rows.forEach((row, index) => (row.rank = index + 1))
    return rows
  }

  function computeStandings(results: readonly MatchEndResult[]): StandingRow[] {
    const frame = countdownFrame
    if (frame === null) return wireOnlyStandings(results)
    const settings = frame.settings
    const deadline = settings.mode === 'time' ? asMs(settings.durationMs ?? 0) : undefined

    // Δ3 counted-mode rank key: the LOG's completion instant among finishers;
    // FALLBACK `match_end.finishedAtMs` for a truncated/desynced log. Server
    // receipt time is epoch ms — orders of magnitude above any run-relative
    // instant — so log-proven finishers always rank ahead, and fallback
    // finishers order among themselves by server receipt.
    const countedRankKey = new Map<string, number>()

    const rows = results.map((result) => {
      const isSelf = result.playerId === selfId.value
      const rec = isSelf ? undefined : peerMap.get(result.playerId)
      const roster = frame.players.find((player) => player.playerId === result.playerId)
      const rosterFreemods = roster?.freemods ?? FALLBACK_FREEMODS
      const status = result.status
      const log = isSelf ? (localRef.value?.getReplayData()?.log ?? []) : (rec?.log ?? [])
      const playerConfig = isSelf
        ? (selfConfig ?? freemodsConfig(settings, rosterFreemods))
        : (rec?.config ?? freemodsConfig(settings, rosterFreemods))
      const ctx = { config: playerConfig, words: matchWords }

      // Authority is the LOG: the fold's completion instant, never network arrival.
      const folded = foldLog(ctx, log, deadline)
      let finalState = folded.isOk() ? folded.value : null
      // MinSpeed can be breached AFTER the last event (the player stopped
      // typing); mirror validateLog and surface that derived fail instant.
      if (finalState !== null && playerConfig.minWpm > 0 && finalState.phase === 'running') {
        const failAt = minSpeedFailInstant(ctx, finalState)
        if (failAt !== null) finalState = settle(ctx, finalState, failAt)
      }
      const lastT = log.length > 0 ? log[log.length - 1].t : asMs(0)
      // A row for a seat that is STILL RACING is a live reading, and measuring
      // it to that seat's last event opens the same zero-wide window the local
      // HUD had. A finished seat measures to its own instant, untouched.
      const end = finalState?.finishedAt ?? liveMeasureAt(finalState?.startedAt ?? null, lastT)
      const metrics = computeMetrics(ctx, log, end)
      const score =
        log.length > 0 && scoreGen !== null
          ? scoreV2OfLog(
              log,
              { config: playerConfig, words: matchWords, generation: scoreGen },
              NO_DECLARATION
            )
          : null
      const failReason = finalState?.failReason ?? undefined

      const row: StandingRow = {
        rank: 0,
        playerId: result.playerId,
        nick: isSelf
          ? selfNick || result.playerId.slice(0, 8)
          : (rec?.nick ?? result.playerId.slice(0, 8)),
        isSelf,
        status,
        // Every COUNTED mode ranks by the clock — words and quote alike, since
        // everyone typed the same text. Naming `words` here is what left a quote
        // match's standings with no finish time to show at all.
        finishTimeMs:
          settings.mode !== 'time' &&
          status === 'finished' &&
          failReason === undefined &&
          typeof finalState?.finishedAt === 'number'
            ? finalState.finishedAt
            : undefined,
        score: score?.total,
        wpm: metrics.wpm,
        raw: metrics.raw,
        acc: metrics.accuracy,
        chars: metrics.chars,
        failReason,
        progress: finalState === null ? 0 : progressOf(ctx, finalState),
        freemods: isSelf ? (selfFreemods ?? rosterFreemods) : (rec?.freemods ?? rosterFreemods),
        afkShare: result.afkShare
      }
      if (status === 'finished' && failReason === undefined) {
        countedRankKey.set(
          result.playerId,
          row.finishTimeMs ?? result.finishedAtMs ?? Number.POSITIVE_INFINITY
        )
      }
      return row
    })

    // MATCH.md §1 tiers, and the tie-breaks inside each — see `rankStandings`.
    return rankStandings(rows, { mode: settings.mode, countedRankKey })
  }

  /**
   * Live scoring HUD for the local seat — the very numbers the solo ScoreHud
   * reads off the game store, shaped as its props. The local run in a match IS
   * a `useGameStore` under the same scoring generation, so nothing is
   * recomputed here; zeros before the core is mounted.
   */
  const selfHud = computed(() => {
    const local = localRef.value
    return {
      score: local?.score ?? 0,
      combo: local?.combo ?? 0,
      multiplier: local?.comboMultiplier ?? 1,
      modMultiplier: local?.modMultiplier ?? 1,
      wpm: local?.metrics.wpm ?? 0,
      raw: local?.metrics.raw ?? 0
    }
  })

  /**
   * The local player's own numbers while the match runs on without them — the
   * elimination screen's "here's how you did, now watch the others" payload.
   */
  const selfOutcome = computed<SelfOutcome | null>(() => {
    // The idle kick HAS a run behind it — real numbers under its own reason.
    // Checked before the reload branch: the kick reuses the forfeit flag on
    // the wire, but locally it is not a reload.
    if (afkForfeit.value) {
      const local = localRef.value
      return {
        reason: 'idle',
        wpm: local?.metrics.wpm ?? 0,
        acc: local?.metrics.accuracy ?? 0,
        score: local?.scoreResult?.total ?? null,
        progress:
          local === null || selfConfig === null
            ? 0
            : progressOf({ config: selfConfig, words: matchWords }, local.snapshot)
      }
    }
    // The reload forfeit has no core to read: it IS the absence of one.
    if (reloadForfeit.value) return RELOAD_FORFEIT
    const local = localRef.value
    const reason = local?.snapshot.failReason ?? null
    if (local === null || reason === null) return null
    return {
      reason,
      wpm: local.metrics.wpm,
      acc: local.metrics.accuracy,
      score: local.scoreResult?.total ?? null,
      progress:
        selfConfig === null
          ? 0
          : progressOf({ config: selfConfig, words: matchWords }, local.snapshot)
    }
  })

  // ── actions (thin wrappers over transport.send) ─────────────────────────
  function safeSend(frame: ClientCommand): void {
    if (transport === null) return
    try {
      transport.send(frame)
    } catch {
      // Not connected (drop/reconnect window): the action is lost by design —
      // the connection state is visible to the UI; the user retries.
    }
  }

  function createRoom(): void {
    safeSend({ type: 'create_room' })
  }
  function joinRoom(code: string): void {
    safeSend({ type: 'join_room', code })
  }
  function leaveRoom(): void {
    resetMatchState()
    safeSend({ type: 'leave' })
    room.value = null
    standings.value = null
    matchError.value = null
    phase.value = 'idle'
    clearStoredResumeToken() // an intentional leave must not resurrect on reload
  }
  /** Δ1: `ready:false` clears the seat's ready flag (un-ready). */
  function setReady(ready = true): void {
    safeSend({ type: 'ready', ready })
  }
  function setFreemods(freemods: Freemods): void {
    safeSend({ type: 'set_freemods', freemods })
  }
  function updateSettings(settings: RoomSettings): void {
    safeSend({ type: 'settings_update', settings })
  }
  function startMatch(): void {
    safeSend({ type: 'start_match' })
  }
  function kickPlayer(playerId: string): void {
    safeSend({ type: 'kick', playerId })
  }
  function transferHost(playerId: string): void {
    safeSend({ type: 'transfer_host', playerId })
  }
  function sendChat(text: string): void {
    safeSend({ type: 'chat_send', text })
  }

  /** Results → lobby: clears the finished match and re-readies this seat. */
  function reReady(): void {
    if (!backToLobby()) return
    safeSend({ type: 'ready' })
  }

  /**
   * Results → lobby WITHOUT readying up. The seat is kept and the room's
   * settings are still there; only this match is cleared. `reReady` is this plus
   * the ready flag — the two differ by one frame, not by one screen, so they
   * share the teardown rather than each remembering what a match leaves behind.
   */
  function backToLobby(): boolean {
    if (phase.value !== 'results') return false
    resetMatchState()
    standings.value = null
    localRef.value?.reset()
    phase.value = 'lobby'
    return true
  }

  return {
    // lifecycle
    init,
    dispose,
    advance,
    // connection & room
    connection,
    connectionError,
    pingMs,
    measurePing,
    room,
    selfId,
    resumeAttempted,
    isHost,
    chatLog,
    lastError,
    // actions
    createRoom,
    joinRoom,
    leaveRoom,
    setReady,
    setFreemods,
    updateSettings,
    startMatch,
    kickPlayer,
    transferHost,
    sendChat,
    reReady,
    backToLobby,
    // match
    phase,
    afkProgress,
    countdownMsLeft,
    matchSeed,
    matchError,
    selfView,
    selfHud,
    selfOutcome,
    peers,
    standings,
    matchEndReason
  }
})

/** The match session store instance type — the named contract consumers import (mirrors `GameStore`). */
export type MatchSessionStore = ReturnType<typeof useMatchSessionStore>
