import * as v from 'valibot'
import type {
  ClientFrame,
  ErrorCode,
  Freemods,
  MatchEndReason,
  MatchEndResult,
  RoomSettings,
  ServerFrame
} from './protocol'
import { ClientFrameSchema, PROTOCOL_VERSION } from './protocol'
import type { WebSocketLike } from './ws-transport'
import { WsTransport, type ReconnectPolicy } from './ws-transport'

/**
 * In-memory fake server + transport implementing the SAME wire contract as the
 * real server (PROTOCOL.md): multi-client rooms, host role, ready gating,
 * countdown with a server-generated 32-bit seed, event relay with per-player
 * order, disconnect grace/resume with backlog replay, ntp_pong with a
 * configurable simulated clock offset, and configurable latency/jitter/drop.
 *
 * Several `LoopbackTransport` clients share one `LoopbackServer` instance
 * (2–5 player tests, Playwright E2E). `LoopbackTransport` IS a `WsTransport`
 * wired to an in-memory socket, so the production client logic (handshake,
 * validation, reconnect, state machine) is exercised verbatim.
 */

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // §5: no 0, O, 1, I
const ROOM_CAPACITY = 5
const CHAT_MAX_LEN = 200
const CHAT_BURST = 5
const CHAT_REFILL_PER_MS = CHAT_BURST / 2000 // refilled to full over 2 s

/**
 * Δ3 words-mode AFK rules (server-owned; time mode keeps its duration+slack
 * deadline — stopping early in a timed run is legitimate and never a dnf).
 * The match window is diced into one-second buckets on the RECEIVE clock; a
 * bucket holding at least one accepted `event_batch` is "active". A racing
 * words seat whose IDLE SHARE crosses {@link AFK_KICK_SHARE} is dnf'd.
 */
export const AFK_KICK_SHARE = 0.6
/** No kick before this much of the window has elapsed — early on, one missing bucket is 100 % idle. */
export const AFK_WARMUP_MS = 10_000
export const FINISH_WINDOW_MS = 120_000

const AFK_BUCKET_MS = 1000

export interface LoopbackLatency {
  /** Base server→client delivery delay. Default 0 (microtask delivery). */
  readonly latencyMs?: number
  /** Uniform extra delay in [0, jitterMs). Default 0. */
  readonly jitterMs?: number
  /** Probability in [0, 1) that a server→client frame is silently dropped. Default 0. */
  readonly dropRate?: number
}

export interface LoopbackServerOptions {
  /** Simulated server−client clock offset in ms (drives `ntp_pong`). Default 0. */
  readonly clockOffsetMs?: number
  /** Base (client-side) clock. Default `Date.now`. */
  readonly now?: () => number
  /** Version the server speaks; set ≠ 1 to force `version_mismatch`. Default 1. */
  readonly protocolVersion?: number
  /** `goAtServerMs` lead over `start_match`. Default 3000. */
  readonly countdownLeadMs?: number
  /** Mid-match disconnect grace window (§6). Default 15000. */
  readonly graceMs?: number
  /** Δ3: words-mode AFK kick threshold, idle share in 0..1. Default 0.6. */
  readonly afkKickShare?: number
  /** Δ3: no AFK kick until this much of the match window has elapsed. Default 10000. */
  readonly afkWarmupMs?: number
  /** Δ3: words-mode finish window opened by the first finish. Default 120000. */
  readonly finishWindowMs?: number
  readonly latency?: LoopbackLatency
  /** Randomness source (ids, codes, seeds, jitter, drops). Default `Math.random`. */
  readonly random?: () => number
}

type TimerHandle = ReturnType<typeof setTimeout>

interface ClientRecord {
  playerId: string
  resumeToken: string
  socket: LoopbackSocket | null
  /** Frames buffered while disconnected mid-match; replayed in order on resume. */
  backlog: string[]
  graceTimer: TimerHandle | null
  room: Room | null
  chatTokens: number
  chatRefillAt: number
}

interface Seat {
  client: ClientRecord
  nick: string
  isGuest: boolean
  ready: boolean
  freemods: Freemods
}

type ParticipantStatus = 'racing' | 'finished' | 'dnf' | 'left'

interface Match {
  matchId: string
  /** Frozen at start — the words-mode AFK rules key off this, never live settings. */
  mode: 'time' | 'words'
  /** Local clock instant of GO — bucket zero of the AFK accounting. */
  goAtMs: number
  /** As broadcast in `countdown`; re-served in `room_state.match` for resumers. */
  goAtServerMs: number
  participants: Map<string, ParticipantStatus>
  lastSeq: Map<string, number>
  /** Server clock at `finish` receipt, per finished player (Δ3 match_end). */
  finishedAtMs: Map<string, number>
  /** Accepted event_batch envelope / event tallies (Δ3 match_end). */
  batchCounts: Map<string, number>
  eventCounts: Map<string, number>
  /** Δ3 AFK: per seat, the distinct one-second buckets since GO that received a batch. */
  activeBuckets: Map<string, Set<number>>
  /** Local instant each seat stopped racing — the close of its AFK window. */
  windowEndMs: Map<string, number>
  /** Δ3 AFK: the once-a-second share sweep (words mode only). */
  afkSweepTimer: TimerHandle | null
  /** Δ3 words-mode finish window, armed by the FIRST finish. */
  finishWindowTimer: TimerHandle | null
}

interface Room {
  code: string
  settings: RoomSettings
  hostId: string
  /** Join-ordered; index 0 is the earliest-joined seat (host succession, §5). */
  seats: Seat[]
  match: Match | null
  usedGuestNicks: Set<string>
}

const DEFAULT_FREEMODS: Freemods = { difficulty: 'normal', minWpm: 0, nospace: false }

class LoopbackSocket implements WebSocketLike {
  readyState = 0
  onopen: (() => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onclose: ((event: { code: number; reason: string }) => void) | null = null
  onerror: (() => void) | null = null
  /** Delivery-order chain cursor for latency simulation. */
  deliverAt = 0

  constructor(private readonly server: LoopbackServer) {}

  send(data: string): void {
    if (this.readyState !== 1) throw new Error('LoopbackSocket.send() on a non-open socket')
    this.server.receiveFromClient(this, data)
  }

  close(code = 1000, reason = ''): void {
    if (this.readyState === 3) return
    this.readyState = 3
    this.server.socketClosedByClient(this)
    queueMicrotask(() => this.onclose?.({ code, reason }))
  }

  /** Server side: complete the handshake. */
  open(): void {
    if (this.readyState !== 0) return
    this.readyState = 1
    this.onopen?.()
  }

  /** Server side: deliver one frame. */
  receive(data: string): void {
    if (this.readyState !== 1) return
    this.onmessage?.({ data })
  }

  /** Server side: abrupt close (drop simulation / version_mismatch). */
  serverClose(code: number): void {
    if (this.readyState === 3) return
    this.readyState = 3
    queueMicrotask(() => this.onclose?.({ code, reason: '' }))
  }
}

export class LoopbackServer {
  private readonly clockOffsetMs: number
  private readonly now: () => number
  private readonly protocolVersion: number
  private readonly countdownLeadMs: number
  private readonly graceMs: number
  private readonly latencyMs: number
  private readonly jitterMs: number
  private readonly dropRate: number
  private readonly afkKickShare: number
  private readonly afkWarmupMs: number
  private readonly finishWindowMs: number
  private readonly random: () => number

  private readonly clientsBySocket = new Map<LoopbackSocket, ClientRecord>()
  /** Sockets that connected but have not completed `hello` yet. */
  private readonly pendingSockets = new Set<LoopbackSocket>()
  private readonly clients = new Map<string, ClientRecord>() // by playerId
  private readonly rooms = new Map<string, Room>() // by code
  private matchCounter = 0

  constructor(options?: LoopbackServerOptions) {
    this.clockOffsetMs = options?.clockOffsetMs ?? 0
    this.now = options?.now ?? Date.now
    this.protocolVersion = options?.protocolVersion ?? PROTOCOL_VERSION
    this.countdownLeadMs = options?.countdownLeadMs ?? 3000
    this.graceMs = options?.graceMs ?? 15_000
    this.afkKickShare = options?.afkKickShare ?? AFK_KICK_SHARE
    this.afkWarmupMs = options?.afkWarmupMs ?? AFK_WARMUP_MS
    this.finishWindowMs = options?.finishWindowMs ?? FINISH_WINDOW_MS
    this.latencyMs = options?.latency?.latencyMs ?? 0
    this.jitterMs = options?.latency?.jitterMs ?? 0
    this.dropRate = options?.latency?.dropRate ?? 0
    this.random = options?.random ?? Math.random
  }

  /** WebSocket factory endpoint for `LoopbackTransport`. */
  connect(): WebSocketLike {
    const socket = new LoopbackSocket(this)
    this.pendingSockets.add(socket)
    queueMicrotask(() => socket.open())
    return socket
  }

  /** Simulate an abrupt network drop of one client (starts the grace window mid-match). */
  dropClient(playerId: string): void {
    const client = this.clients.get(playerId)
    if (client === undefined || client.socket === null) return
    const socket = client.socket
    socket.serverClose(1006)
    this.detachSocket(socket)
  }

  get roomCount(): number {
    return this.rooms.size
  }

  // ── wire I/O ──────────────────────────────────────────────────────────────

  receiveFromClient(socket: LoopbackSocket, data: string): void {
    queueMicrotask(() => this.handleRaw(socket, data))
  }

  socketClosedByClient(socket: LoopbackSocket): void {
    queueMicrotask(() => this.detachSocket(socket))
  }

  private deliverTo(socket: LoopbackSocket, frame: ServerFrame): void {
    // Drop simulation applies to fresh frames only — backlog replay is exactly-once (§6).
    if (this.dropRate > 0 && this.random() < this.dropRate) return
    this.deliverRawTo(socket, JSON.stringify(frame))
  }

  private sendTo(client: ClientRecord, frame: ServerFrame): void {
    if (client.socket === null) {
      client.backlog.push(JSON.stringify(frame))
      return
    }
    this.deliverTo(client.socket, frame)
  }

  private sendError(socket: LoopbackSocket, code: ErrorCode, message: string): void {
    this.deliverTo(socket, { type: 'error', code, message })
  }

  private broadcast(room: Room, frame: ServerFrame, exceptPlayerId?: string): void {
    for (const seat of room.seats) {
      if (seat.client.playerId === exceptPlayerId) continue
      this.sendTo(seat.client, frame)
    }
  }

  // ── inbound frames ────────────────────────────────────────────────────────

  private handleRaw(socket: LoopbackSocket, data: string): void {
    if (socket.readyState !== 1) return
    let value: unknown
    try {
      value = JSON.parse(data)
    } catch {
      this.sendError(socket, 'bad_message', 'frame is not valid JSON')
      return
    }
    const parsed = v.safeParse(ClientFrameSchema, value)
    if (!parsed.success) {
      this.sendError(socket, 'bad_message', 'malformed or unknown frame')
      return
    }
    const frame = parsed.output
    const client = this.clientsBySocket.get(socket)
    if (frame.type === 'hello') {
      this.handleHello(socket, client ?? null, frame.protocolVersion, frame.resumeToken)
      return
    }
    if (client === undefined) {
      this.sendError(socket, 'bad_message', 'hello must be the first message')
      return
    }
    this.handleCommand(client, frame)
  }

  private handleHello(
    socket: LoopbackSocket,
    existing: ClientRecord | null,
    protocolVersion: number,
    resumeToken: string | undefined
  ): void {
    if (existing !== null) {
      this.sendError(socket, 'bad_message', 'hello already completed')
      return
    }
    if (protocolVersion !== this.protocolVersion) {
      this.sendError(socket, 'version_mismatch', `server speaks protocol ${this.protocolVersion}`)
      // §2: error frame first, then the server closes the connection.
      queueMicrotask(() => {
        socket.serverClose(1002)
        this.pendingSockets.delete(socket)
      })
      return
    }
    if (resumeToken !== undefined) {
      const resumable = [...this.clients.values()].find(
        (candidate) => candidate.resumeToken === resumeToken && candidate.socket === null
      )
      if (resumable !== undefined) {
        this.resumeClient(socket, resumable)
        return
      }
      // Unknown/expired token ⇒ fall through to a fresh identity.
    }
    const client: ClientRecord = {
      playerId: this.randomHex(32),
      resumeToken: this.randomHex(64),
      socket,
      backlog: [],
      graceTimer: null,
      room: null,
      chatTokens: CHAT_BURST,
      chatRefillAt: this.now()
    }
    this.registerSocket(socket, client)
    this.sendTo(client, {
      type: 'hello_ok',
      playerId: client.playerId,
      serverVersion: this.protocolVersion,
      resumeToken: client.resumeToken
    })
  }

  private resumeClient(socket: LoopbackSocket, client: ClientRecord): void {
    if (client.graceTimer !== null) {
      clearTimeout(client.graceTimer)
      client.graceTimer = null
    }
    client.resumeToken = this.randomHex(64) // token rotates on every hello_ok
    this.registerSocket(socket, client)
    client.socket = socket
    this.sendTo(client, {
      type: 'hello_ok',
      playerId: client.playerId,
      serverVersion: this.protocolVersion,
      resumeToken: client.resumeToken
    })
    // Δ2 (mirrors room.go reattach): hello_ok → fresh room_state → backlog
    // replay in order, exactly once → reconnected announce.
    this.sendRoomStateTo(client)
    const backlog = client.backlog
    client.backlog = []
    for (const raw of backlog) this.deliverRawTo(socket, raw)
    if (client.room !== null && client.room.match?.participants.get(client.playerId) === 'racing') {
      this.broadcast(
        client.room,
        { type: 'peer_status', playerId: client.playerId, status: 'reconnected' },
        client.playerId
      )
    }
  }

  private deliverRawTo(socket: LoopbackSocket, data: string): void {
    if (this.latencyMs <= 0 && this.jitterMs <= 0) {
      queueMicrotask(() => socket.receive(data))
      return
    }
    const nowMs = this.now()
    const at = Math.max(nowMs + this.latencyMs + this.jitterMs * this.random(), socket.deliverAt)
    socket.deliverAt = at
    setTimeout(() => socket.receive(data), Math.max(0, at - nowMs))
  }

  private registerSocket(socket: LoopbackSocket, client: ClientRecord): void {
    this.pendingSockets.delete(socket)
    this.clientsBySocket.set(socket, client)
    this.clients.set(client.playerId, client)
    client.socket = socket
  }

  private handleCommand(
    client: ClientRecord,
    frame: Exclude<ClientFrame, { type: 'hello' }>
  ): void {
    switch (frame.type) {
      case 'ntp_ping': {
        const serverNow = Math.round(this.now() + this.clockOffsetMs)
        this.sendTo(client, { type: 'ntp_pong', t0: frame.t0, t1: serverNow, t2: serverNow })
        return
      }
      case 'create_room':
        this.createRoom(client)
        return
      case 'join_room':
        this.joinRoom(client, frame.code)
        return
      case 'ready':
        this.setReady(client, frame.ready ?? true)
        return
      case 'settings_update':
        this.updateSettings(client, frame.settings)
        return
      case 'set_freemods':
        this.setFreemods(client, frame.freemods)
        return
      case 'start_match':
        this.startMatch(client)
        return
      case 'kick':
        this.kick(client, frame.playerId)
        return
      case 'transfer_host':
        this.transferHost(client, frame.playerId)
        return
      case 'chat_send':
        this.chatSend(client, frame.text)
        return
      case 'event_batch':
        this.eventBatch(client, frame.matchId, frame.batchSeq, frame.events)
        return
      case 'leave':
        this.leave(client)
        return
      case 'finish':
        this.finish(client, frame.matchId, frame.forfeit === true)
        return
    }
  }

  // ── room logic (§5) ───────────────────────────────────────────────────────

  private createRoom(client: ClientRecord): void {
    if (client.room !== null) {
      this.errorTo(client, 'bad_message', 'already in a room')
      return
    }
    let code = this.randomCode()
    while (this.rooms.has(code)) code = this.randomCode()
    const room: Room = {
      code,
      settings: {
        name: `Room ${code}`,
        visibility: 'private',
        mode: 'time',
        durationMs: 30_000,
        // The real published english dictionary, not a placeholder: a room's
        // default settings are handed straight to clients, and a lang/dictHash
        // pair that resolves to nothing makes the match path fail its own
        // dictionary check (session-store verifies dictVersion(words) against
        // this hash). `be99aa1a` is frozen forever by the server's
        // publishedHashes tripwire, so it cannot drift out from under us.
        lang: 'english',
        dictHash: 'be99aa1a',
        textMods: { punctuation: false, numbers: false, randomCase: false, reverse: false },
        textSource: { kind: 'seeded' }
      },
      hostId: client.playerId,
      seats: [],
      match: null,
      usedGuestNicks: new Set()
    }
    this.rooms.set(code, room)
    this.seatClient(room, client)
    this.sendRoomState(room)
  }

  private joinRoom(client: ClientRecord, rawCode: string): void {
    if (client.room !== null) {
      this.errorTo(client, 'bad_message', 'already in a room')
      return
    }
    const code = rawCode.trim().toUpperCase()
    const room = this.rooms.get(code)
    if (room === undefined) {
      this.errorTo(client, 'room_not_found', `no room ${code}`)
      return
    }
    if (room.seats.length >= ROOM_CAPACITY) {
      this.errorTo(client, 'room_full', 'room already has 5 seats')
      return
    }
    const seat = this.seatClient(room, client)
    this.sendRoomState(room)
    this.systemChat(room, 'join', `${seat.nick} joined`)
  }

  private seatClient(room: Room, client: ClientRecord): Seat {
    let nick = `Guest-${1000 + Math.floor(this.random() * 9000)}`
    while (room.usedGuestNicks.has(nick)) nick = `Guest-${1000 + Math.floor(this.random() * 9000)}`
    room.usedGuestNicks.add(nick)
    const seat: Seat = {
      client,
      nick,
      isGuest: true,
      ready: false,
      freemods: { ...DEFAULT_FREEMODS }
    }
    room.seats.push(seat)
    client.room = room
    return seat
  }

  private setReady(client: ClientRecord, value: boolean): void {
    const room = client.room
    if (room === null) {
      this.errorTo(client, 'not_in_room', 'ready outside a room')
      return
    }
    const seat = room.seats.find((entry) => entry.client === client)
    if (seat !== undefined) seat.ready = value
    this.sendRoomState(room)
  }

  private updateSettings(client: ClientRecord, settings: RoomSettings): void {
    const room = client.room
    if (room === null) {
      this.errorTo(client, 'not_in_room', 'settings_update outside a room')
      return
    }
    if (room.hostId !== client.playerId) {
      this.errorTo(client, 'forbidden', 'settings_update is host-only')
      return
    }
    if (room.match !== null) {
      this.errorTo(client, 'bad_message', 'settings_update during a match')
      return
    }
    const name = [...settings.name]
      .filter((ch) => {
        const codePoint = ch.codePointAt(0) ?? 0
        return codePoint >= 32 && codePoint !== 127
      })
      .join('')
      .trim()
    if (name.length < 1 || name.length > 32) {
      this.errorTo(client, 'bad_message', 'settings.name must be 1-32 chars after sanitizing')
      return
    }
    room.settings = { ...settings, name }
    for (const seat of room.seats) seat.ready = false // §3: applying settings resets every ready flag
    this.sendRoomState(room)
    this.systemChat(room, 'settings_changed', 'room settings changed')
  }

  private setFreemods(client: ClientRecord, freemods: Freemods): void {
    const room = client.room
    if (room === null) {
      this.errorTo(client, 'not_in_room', 'set_freemods outside a room')
      return
    }
    if (room.match !== null) {
      this.errorTo(client, 'bad_message', 'set_freemods during a match')
      return
    }
    const seat = room.seats.find((entry) => entry.client === client)
    if (seat !== undefined) seat.freemods = freemods
    this.sendRoomState(room)
  }

  private startMatch(client: ClientRecord): void {
    const room = client.room
    if (room === null) {
      this.errorTo(client, 'not_in_room', 'start_match outside a room')
      return
    }
    if (room.hostId !== client.playerId || room.match !== null) {
      this.errorTo(client, 'forbidden', 'start_match is host-only and needs no running match')
      return
    }
    const nonHostUnready = room.seats.some(
      (seat) => seat.client.playerId !== room.hostId && !seat.ready
    )
    if (room.seats.length < 2 || nonHostUnready) {
      this.errorTo(client, 'not_ready', 'need ≥2 seats and every non-host seat ready')
      return
    }
    this.matchCounter += 1
    const goAtMs = this.now() + this.countdownLeadMs
    const match: Match = {
      matchId: `m_${this.matchCounter.toString(16)}`,
      mode: room.settings.mode,
      goAtMs,
      goAtServerMs: Math.round(goAtMs + this.clockOffsetMs),
      participants: new Map(room.seats.map((seat) => [seat.client.playerId, 'racing'])),
      lastSeq: new Map(room.seats.map((seat) => [seat.client.playerId, 0])),
      finishedAtMs: new Map(),
      batchCounts: new Map(room.seats.map((seat) => [seat.client.playerId, 0])),
      eventCounts: new Map(room.seats.map((seat) => [seat.client.playerId, 0])),
      activeBuckets: new Map(),
      windowEndMs: new Map(),
      afkSweepTimer: null,
      finishWindowTimer: null
    }
    room.match = match
    this.broadcast(room, {
      type: 'countdown',
      matchId: match.matchId,
      goAtServerMs: match.goAtServerMs,
      seed: Math.min(Math.floor(this.random() * 2 ** 32), 2 ** 32 - 1),
      settings: {
        ...room.settings,
        textMods: { ...room.settings.textMods },
        textSource: { ...room.settings.textSource }
      },
      players: room.seats.map((seat) => ({
        playerId: seat.client.playerId,
        freemods: { ...seat.freemods }
      }))
    })
    this.startAfkSweep(room, match)
  }

  private kick(client: ClientRecord, targetId: string): void {
    const room = client.room
    if (room === null) {
      this.errorTo(client, 'not_in_room', 'kick outside a room')
      return
    }
    if (room.hostId !== client.playerId) {
      this.errorTo(client, 'forbidden', 'kick is host-only')
      return
    }
    const target = room.seats.find((seat) => seat.client.playerId === targetId)
    if (target === undefined || targetId === client.playerId) {
      this.errorTo(client, 'bad_message', 'no such player or cannot kick yourself')
      return
    }
    this.sendTo(target.client, { type: 'kicked' })
    // On the wire a kick is a neutral leave for everyone else (§3).
    this.removeSeat(room, target, 'left')
  }

  private transferHost(client: ClientRecord, targetId: string): void {
    const room = client.room
    if (room === null) {
      this.errorTo(client, 'not_in_room', 'transfer_host outside a room')
      return
    }
    if (room.hostId !== client.playerId) {
      this.errorTo(client, 'forbidden', 'transfer_host is host-only')
      return
    }
    const target = room.seats.find((seat) => seat.client.playerId === targetId)
    if (target === undefined) {
      this.errorTo(client, 'bad_message', 'no such player')
      return
    }
    room.hostId = targetId
    this.sendRoomState(room)
    this.systemChat(room, 'host_changed', `${target.nick} is now the host`)
  }

  private chatSend(client: ClientRecord, rawText: string): void {
    const room = client.room
    if (room === null) {
      this.errorTo(client, 'not_in_room', 'chat_send outside a room')
      return
    }
    const text = rawText.trim()
    if (text.length < 1 || text.length > CHAT_MAX_LEN) {
      this.errorTo(client, 'bad_message', 'chat text must be 1-200 chars after trimming')
      return
    }
    const nowMs = this.now()
    client.chatTokens = Math.min(
      CHAT_BURST,
      client.chatTokens + (nowMs - client.chatRefillAt) * CHAT_REFILL_PER_MS
    )
    client.chatRefillAt = nowMs
    if (client.chatTokens < 1) {
      this.errorTo(client, 'rate_limited', 'chat rate limit exceeded')
      return
    }
    client.chatTokens -= 1
    this.broadcast(room, {
      type: 'chat',
      from: client.playerId,
      text,
      ts: Math.round(nowMs + this.clockOffsetMs)
    })
  }

  private eventBatch(
    client: ClientRecord,
    matchId: string,
    batchSeq: number,
    events: unknown[]
  ): void {
    const room = client.room
    const match = room?.match ?? null
    if (room === null || match === null || match.matchId !== matchId) {
      this.errorTo(client, 'bad_message', 'event_batch outside an active match with this matchId')
      return
    }
    const lastSeq = match.lastSeq.get(client.playerId)
    if (lastSeq === undefined) {
      this.errorTo(client, 'bad_message', 'sender is not a participant of this match')
      return
    }
    if (batchSeq !== lastSeq + 1) {
      this.errorTo(client, 'bad_message', `batchSeq ${batchSeq} is not lastSeq+1 (${lastSeq + 1})`)
      return
    }
    match.lastSeq.set(client.playerId, batchSeq)
    // Δ3: accepted-envelope tallies for match_end; an accepted batch also
    // marks this seat's current one-second bucket ACTIVE (the AFK rule reads
    // arrival times only — the events themselves stay opaque).
    match.batchCounts.set(client.playerId, (match.batchCounts.get(client.playerId) ?? 0) + 1)
    match.eventCounts.set(
      client.playerId,
      (match.eventCounts.get(client.playerId) ?? 0) + events.length
    )
    if (match.participants.get(client.playerId) === 'racing') {
      this.markAfkBucket(match, client.playerId)
    }
    this.broadcast(room, { type: 'peer_batch', playerId: client.playerId, events }, client.playerId)
  }

  private leave(client: ClientRecord): void {
    const room = client.room
    if (room === null) {
      this.errorTo(client, 'not_in_room', 'leave outside a room')
      return
    }
    const seat = room.seats.find((entry) => entry.client === client)
    if (seat !== undefined) this.removeSeat(room, seat, 'left')
  }

  /**
   * §3 `finish`. A FORFEIT (a reloaded page abandoning a run it can no longer
   * produce) resolves to `dnf`: no finish instant, and no finish window — nobody
   * finished. Mirrors room.go's `finish`.
   */
  private finish(client: ClientRecord, matchId: string, forfeit: boolean): void {
    const room = client.room
    if (room === null) {
      this.errorTo(client, 'not_in_room', 'finish outside a room')
      return
    }
    const match = room.match
    if (
      match === null ||
      match.matchId !== matchId ||
      match.participants.get(client.playerId) !== 'racing'
    ) {
      this.errorTo(client, 'bad_message', 'finish for an unknown match or non-active participant')
      return
    }
    if (forfeit) {
      this.endParticipation(match, client.playerId, 'dnf')
      this.broadcast(
        room,
        { type: 'peer_status', playerId: client.playerId, status: 'dnf' },
        client.playerId
      )
      this.checkMatchEnd(room)
      return
    }
    this.endParticipation(match, client.playerId, 'finished')
    // Δ3: finishedAtMs = server clock at receipt of this player's finish.
    match.finishedAtMs.set(client.playerId, Math.round(this.now() + this.clockOffsetMs))
    if (match.mode === 'words' && match.finishWindowTimer === null) {
      // Δ3: the FIRST finish opens the finish window; at close every
      // still-racing seat dnfs and the match ends with reason finish_window.
      match.finishWindowTimer = setTimeout(() => {
        match.finishWindowTimer = null
        this.closeFinishWindow(room, match)
      }, this.finishWindowMs)
    }
    // Real-server semantics (room.go broadcastPeerStatusLocked): a terminal
    // peer_status is never echoed to its subject — the finisher accounts for
    // itself locally.
    this.broadcast(
      room,
      { type: 'peer_status', playerId: client.playerId, status: 'finished' },
      client.playerId
    )
    this.checkMatchEnd(room)
  }

  // ── lifecycle plumbing ────────────────────────────────────────────────────

  private removeSeat(room: Room, seat: Seat, matchExit: 'left' | 'dnf'): void {
    const playerId = seat.client.playerId
    room.seats.splice(room.seats.indexOf(seat), 1)
    seat.client.room = null
    if (room.match !== null && room.match.participants.get(playerId) === 'racing') {
      this.endParticipation(room.match, playerId, matchExit)
      this.broadcast(room, { type: 'peer_status', playerId, status: matchExit }, playerId)
    }
    if (room.seats.length === 0) {
      this.rooms.delete(room.code)
      return
    }
    if (room.hostId === playerId) {
      // §5: the role passes automatically to the earliest-joined remaining seat.
      const successor = room.seats[0]
      room.hostId = successor.client.playerId
      this.systemChat(room, 'host_changed', `${successor.nick} is now the host`)
    }
    this.sendRoomState(room)
    this.systemChat(room, 'leave', `${seat.nick} left`)
    this.checkMatchEnd(room)
  }

  private checkMatchEnd(room: Room): void {
    const match = room.match
    if (match === null) return
    for (const status of match.participants.values()) {
      if (status === 'racing') return
    }
    this.endMatch(room, match, 'all_finished')
  }

  /**
   * Δ3 §4/§6: exactly-once `match_end` over the FULL frozen roster, AFTER the
   * final peer_status broadcasts and BEFORE the post-match room_state. Graced
   * seats get it via their backlog (`sendTo`), so a resumer still receives it.
   */
  private endMatch(room: Room, match: Match, reason: MatchEndReason): void {
    if (match.afkSweepTimer !== null) {
      clearTimeout(match.afkSweepTimer)
      match.afkSweepTimer = null
    }
    if (match.finishWindowTimer !== null) {
      clearTimeout(match.finishWindowTimer)
      match.finishWindowTimer = null
    }
    const endedAtMs = this.now()
    const results: MatchEndResult[] = [...match.participants.entries()].map(
      ([playerId, status]) => {
        const finishedAt = match.finishedAtMs.get(playerId)
        // The seat's AFK window is go → its own exit, or go → match end for a
        // seat that raced to the very end.
        const afk = this.afkOf(match, playerId, match.windowEndMs.get(playerId) ?? endedAtMs)
        return {
          playerId,
          // Every seat is terminal here; 'racing' is unreachable but narrowed defensively.
          status: status === 'racing' ? 'dnf' : status,
          ...(status === 'finished' && finishedAt !== undefined
            ? { finishedAtMs: finishedAt }
            : {}),
          batchCount: match.batchCounts.get(playerId) ?? 0,
          eventCount: match.eventCounts.get(playerId) ?? 0,
          afkMs: afk.idle * AFK_BUCKET_MS,
          afkShare: afk.elapsed > 0 ? afk.idle / afk.elapsed : 0
        }
      }
    )
    this.broadcast(room, { type: 'match_end', matchId: match.matchId, reason, results })
    // §6: end clears the in-match state and resets ready flags.
    room.match = null
    for (const seat of room.seats) seat.ready = false
    this.sendRoomState(room)
  }

  /** One seat leaves the race: freeze its status AND the close of its AFK window. */
  private endParticipation(match: Match, playerId: string, status: ParticipantStatus): void {
    match.participants.set(playerId, status)
    match.windowEndMs.set(playerId, this.now())
  }

  /** Δ3 AFK: mark the seat's CURRENT one-second bucket active (arrival clock). */
  private markAfkBucket(match: Match, playerId: string): void {
    const index = Math.floor((this.now() - match.goAtMs) / AFK_BUCKET_MS)
    if (index < 0) return // pre-go: not part of the match window
    let buckets = match.activeBuckets.get(playerId)
    if (buckets === undefined) {
      buckets = new Set()
      match.activeBuckets.set(playerId, buckets)
    }
    buckets.add(index)
  }

  /**
   * Idle-bucket accounting over `[goAt, endMs]`. Only WHOLE elapsed buckets
   * count — the partial bucket in flight is not idle yet, it is unfinished.
   */
  private afkOf(match: Match, playerId: string, endMs: number): { elapsed: number; idle: number } {
    const elapsed = Math.floor((endMs - match.goAtMs) / AFK_BUCKET_MS)
    if (elapsed <= 0) return { elapsed: 0, idle: 0 }
    let active = 0
    const buckets = match.activeBuckets.get(playerId)
    if (buckets !== undefined) {
      for (const index of buckets) if (index < elapsed) active += 1
    }
    return { elapsed, idle: elapsed - active }
  }

  /** Δ3 AFK sweep: once a second from GO, words mode only. Time mode is never swept. */
  private startAfkSweep(room: Room, match: Match): void {
    if (match.mode !== 'words') return
    const tick = (): void => {
      if (room.match !== match) return
      this.sweepAfk(room, match)
      match.afkSweepTimer = room.match === match ? setTimeout(tick, AFK_BUCKET_MS) : null
    }
    match.afkSweepTimer = setTimeout(tick, Math.max(0, match.goAtMs - this.now()) + AFK_BUCKET_MS)
  }

  private sweepAfk(room: Room, match: Match): void {
    const warmupBuckets = Math.ceil(this.afkWarmupMs / AFK_BUCKET_MS)
    const nowMs = this.now()
    for (const [playerId, status] of match.participants) {
      if (status !== 'racing') continue
      const { elapsed, idle } = this.afkOf(match, playerId, nowMs)
      if (elapsed < warmupBuckets || elapsed <= 0) continue
      if (idle / elapsed < this.afkKickShare) continue
      this.afkDnf(room, match, playerId)
      if (room.match !== match) return // the kick ended the match
    }
  }

  /** Δ3 AFK kick: a racing words seat whose idle share crossed the threshold ⇒ dnf. */
  private afkDnf(room: Room, match: Match, playerId: string): void {
    if (room.match !== match || match.participants.get(playerId) !== 'racing') return
    this.endParticipation(match, playerId, 'dnf')
    this.broadcast(room, { type: 'peer_status', playerId, status: 'dnf' }, playerId)
    this.checkMatchEnd(room)
  }

  /** Δ3 finish-window close: every still-racing seat dnfs; reason is finish_window. */
  private closeFinishWindow(room: Room, match: Match): void {
    if (room.match !== match) return
    for (const [playerId, status] of match.participants.entries()) {
      if (status !== 'racing') continue
      this.endParticipation(match, playerId, 'dnf')
      this.broadcast(room, { type: 'peer_status', playerId, status: 'dnf' }, playerId)
    }
    this.endMatch(room, match, 'finish_window')
  }

  private detachSocket(socket: LoopbackSocket): void {
    this.pendingSockets.delete(socket)
    const client = this.clientsBySocket.get(socket)
    if (client === undefined) return
    this.clientsBySocket.delete(socket)
    if (client.socket !== socket) return // already resumed on a newer socket
    client.socket = null
    const room = client.room
    const midMatch = room?.match?.participants.get(client.playerId) === 'racing'
    if (room !== null) {
      // Δ2: ANY disconnect keeps the seat for the grace window; mid-match
      // additionally announces it and buffers the relay backlog (§6). Grace
      // expiry mid-match ⇒ dnf, otherwise ⇒ the normal leave flow.
      if (midMatch) {
        this.broadcast(
          room,
          { type: 'peer_status', playerId: client.playerId, status: 'disconnected' },
          client.playerId
        )
      }
      client.graceTimer = setTimeout(() => {
        client.graceTimer = null
        const seat = room.seats.find((entry) => entry.client === client)
        if (seat !== undefined) this.removeSeat(room, seat, midMatch ? 'dnf' : 'left')
        this.clients.delete(client.playerId)
      }, this.graceMs)
      return
    }
    this.clients.delete(client.playerId)
  }

  private roomStateFrame(room: Room): ServerFrame {
    return {
      type: 'room_state',
      code: room.code,
      name: room.settings.name,
      visibility: room.settings.visibility,
      hostPlayerId: room.hostId,
      settings: {
        ...room.settings,
        textMods: { ...room.settings.textMods },
        textSource: { ...room.settings.textSource }
      },
      players: room.seats.map((seat) => ({
        playerId: seat.client.playerId,
        nick: seat.nick,
        isGuest: seat.isGuest,
        ready: seat.ready,
        freemods: { ...seat.freemods }
      })),
      // Present ONLY while a match runs: a resumer's fresh room_state is the
      // only way a reloaded page learns its seat is mid-match (it never saw
      // that match's countdown).
      ...(room.match !== null
        ? { match: { matchId: room.match.matchId, goAtServerMs: room.match.goAtServerMs } }
        : {})
    }
  }

  private sendRoomState(room: Room): void {
    this.broadcast(room, this.roomStateFrame(room))
  }

  /** Δ2: targeted snapshot for a resumer (broadcast would wake every seat). */
  private sendRoomStateTo(client: ClientRecord): void {
    if (client.room !== null) this.sendTo(client, this.roomStateFrame(client.room))
  }

  private systemChat(
    room: Room,
    kind: 'join' | 'leave' | 'settings_changed' | 'host_changed',
    text: string
  ): void {
    this.broadcast(room, {
      type: 'chat',
      from: 'system',
      kind,
      text,
      ts: Math.round(this.now() + this.clockOffsetMs)
    })
  }

  private errorTo(client: ClientRecord, code: ErrorCode, message: string): void {
    this.sendTo(client, { type: 'error', code, message })
  }

  private randomHex(length: number): string {
    let out = ''
    for (let i = 0; i < length; i++) out += Math.floor(this.random() * 16).toString(16)
    return out
  }

  private randomCode(): string {
    let out = ''
    for (let i = 0; i < 6; i++)
      out += CODE_ALPHABET[Math.floor(this.random() * CODE_ALPHABET.length)]
    return out
  }
}

export interface LoopbackTransportOptions {
  readonly reconnect?: ReconnectPolicy
  readonly random?: () => number
}

/**
 * A `WsTransport` whose socket is an in-memory pipe to a shared
 * `LoopbackServer` — the full production client path (hello, validation,
 * reconnect, resume) runs against the fake server.
 */
export class LoopbackTransport extends WsTransport {
  constructor(server: LoopbackServer, options?: LoopbackTransportOptions) {
    super({
      url: 'loopback://server',
      webSocketFactory: () => server.connect(),
      reconnect: options?.reconnect ?? { baseDelayMs: 10, maxDelayMs: 100 },
      random: options?.random
    })
  }
}
