/**
 * Lobby-domain view types, mapped 1:1 onto the PROTOCOL v1 wire model
 * (shared/match-transport) and the match-session store contract
 * ('@/entities/match'). The old role/permission matrix is gone: v1 knows only
 * host | player (host = `room_state.hostPlayerId`); spectators do not exist on
 * the wire.
 */
import type { FailReason } from '@shared/core'
import type { ChatKind, Freemods } from '@shared/match-transport'

export type {
  ChatKind,
  ErrorCode,
  Freemods,
  RoomPlayer,
  RoomSettings,
  RoomStateFrame,
  TextMods,
  TransportState
} from '@shared/match-transport'

/** Match-session phase (mirror of the session-store contract). */
export type MatchPhase =
  'idle' | 'lobby' | 'countdown' | 'running' | 'waiting' | 'eliminated' | 'results' | 'error'

/** A peer's lifecycle inside a running match, as the UI renders it. */
export type PeerRaceStatus =
  'racing' | 'finished' | 'eliminated' | 'dnf' | 'left' | 'disconnected' | 'desynced'

export interface PeerMetrics {
  wpm: number
  /** Accuracy in 0..1. */
  acc: number
  /** Canonical target-based progress in 0..1 — over-typed extras never advance it. */
  progress: number
}

/** What the opponents rail renders per peer (structural subset of the session store's PeerView). */
export interface PeerRailEntry {
  playerId: string
  nick: string
  metrics: PeerMetrics
  status: PeerRaceStatus
  /** Why an `eliminated` peer is out; `null`/absent while racing or finished. */
  failReason?: FailReason | null
}

/** Structural mirror of the session store's StandingRow. */
export interface StandingRow {
  rank: number
  playerId: string
  nick: string
  isSelf: boolean
  /**
   * The WIRE status — an eliminated player finished on the wire, so `failReason` is what actually happened.
   * A `dnf` is no longer only a missed finish window: in `words` mode the server also dnf's a seat whose
   * AFK share (see {@link StandingRow.afkShare}) crosses its threshold.
   */
  status: 'finished' | 'dnf' | 'left'
  /** Present in `words` mode. */
  finishTimeMs?: number
  /** Present in `time` mode. */
  score?: number
  wpm?: number
  acc?: number
  /** Set when a freemod rule ended the run (master/expert miss, MinSpeed floor) — ranks below every true finisher. */
  failReason?: FailReason
  /**
   * Idle share of this player's match window in 0..1, measured by the SERVER from
   * `event_batch` ARRIVAL times (it never parses events) and relayed on
   * `match_end.results[]`. Absent when the server did not report it.
   */
  afkShare?: number
  /** Canonical progress at the run's end instant — the tie-break among eliminated players. */
  progress: number
  freemods: Freemods
}

/** Structural mirror of the session store's ChatEntry (`from` is `"system"` or a playerId). */
export interface ChatEntry {
  id: string
  from: string
  nick?: string
  kind?: ChatKind
  text: string
  ts: number
}
