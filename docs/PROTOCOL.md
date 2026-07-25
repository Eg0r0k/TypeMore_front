# TypeMore Realtime Protocol — v1

Status: **v1 (draft; this phase implements `hello` + NTP + the room/lobby model + the event relay, finish/match-end, heartbeat, and disconnect/resume of §6).**
This document is the contract shared **verbatim** between the server
(`typemore-server`) and the frontend repository. It is standalone: it does not
reference any Go or TypeScript type. Where the server's realtime behaviour is
defined, it is defined here.

---

## 1. Transport

- **WebSocket**, endpoint `GET /ws` (upgrade).
- **JSON text frames only.** Binary frames are rejected with a `bad_message`
  error. One JSON value per frame.
- **Protocol version is `1` (numeric).** It is announced by the client in its
  `hello` and is a plain integer, not a string.
- The server speaks exactly one protocol version and **never translates between
  versions**. A client announcing a different version is rejected (see
  `version_mismatch`) and disconnected.

### Frame shape

Every frame — both directions — is a JSON object with a `type` string
discriminator plus that message's payload fields:

```json
{ "type": "<message type>", "...": "payload fields" }
```

Unknown message types are answered with a `bad_message` error and the connection
stays open (forward-compatibility: a newer client may send a type this server
does not implement yet).

### Timestamps and units

All wall-clock timestamps on the wire (`t0`, `t1`, `t2`, `goAtServerMs`) are
**integer milliseconds since the Unix epoch (UTC)**. `t1`/`t2` are read from the
**server** clock; `t0` is read from the **client** clock. The client's `t3`
(defined below) never travels on the wire — it is a client-local reading.

---

## 2. Connection lifecycle

1. Client opens the WebSocket.
2. Client **MUST** send `hello` as its **first** frame. Any other frame before a
   successful `hello` is answered with `bad_message` (connection stays open; the
   client may then send a valid `hello`).
3. Server validates the protocol version and nick:
   - version mismatch ⇒ `error` with code `version_mismatch`, then the server
     **closes** the connection;
   - invalid nick ⇒ `error` with code `bad_message` (connection stays open, may
     retry);
   - otherwise ⇒ `hello_ok`.
4. After `hello_ok` the client may send `ntp_ping` (this phase) and, in later
   phases, the room/match messages.

### Heartbeat

The server uses WebSocket **ping/pong** as a liveness probe: it pings after
**15 s** of connection idleness. **2 missed** pongs ⇒ the peer is considered
disconnected and the disconnect grace window (below) begins. WebSocket
ping/pong is handled by the transport layer, not by application `type` frames;
clients do not implement it manually (browsers answer pings automatically).

*(Heartbeat is specified now; enforced from the relay phase.)*

---

## 3. Client → server messages

### `hello`

First frame of every connection. `nick` is **optional and ignored**: a guest
connection is assigned a unique per-room identity (`Guest-XXXX`) when it joins a
room, and an **authenticated** connection (a valid session cookie present on the
WebSocket upgrade) uses its account **displayName**. The field is retained for
forward compatibility only; do not rely on it being echoed.

`resumeToken` is **optional**: on a reconnect the client re-sends its hello with
the `resumeToken` it was given in the previous `hello_ok`, and the server
restores its seat in **any phase** — lobby or mid-match (see §6). An **unknown
or expired** `resumeToken` is **not an error**: the hello degrades to a fresh
connection (new identity, new token) — the grace window simply elapsed. Omit it
on a fresh connection. Logged-in users are additionally identified by their
session cookie (from the auth layer), which survives independently of this token.

```json
{ "type": "hello", "protocolVersion": 1 }
```

```json
{ "type": "hello", "protocolVersion": 1, "resumeToken": "b3f1…(64 hex chars)" }
```

### `ntp_ping`

A clock-synchronisation ping. `t0` is the client's clock reading at send time.

```json
{ "type": "ntp_ping", "t0": 1737645123456 }
```

### `create_room`

Opens a new room with the sender as its **host**. The server allocates a code,
seats the creator, and replies with a `room_state` (the room begins with the
default settings in §5). Reject reasons: none beyond being already in a room
(`bad_message`).

```json
{ "type": "create_room" }
```

### `join_room`

Joins an existing room by its code (see §5 for the code format; matching is
case-insensitive). On success every seat receives a fresh `room_state` and a
`join` system `chat`. Errors: `room_not_found`, `room_full`, or `bad_message`
(already in a room).

```json
{ "type": "join_room", "code": "K7GQ2M" }
```

### `ready`

Sets the sending seat's ready flag. The `ready` field is **optional** and
defaults to `true`; an explicit `false` clears the flag (un-ready). The host
does not need to be ready; `start_match` gates on the **non-host** seats (see
§5). Broadcasts `room_state`.

```json
{ "type": "ready" }
```

```json
{ "type": "ready", "ready": false }
```

### `settings_update`

**Host-only**, valid **only between matches**. Replaces the room `settings`
(schema in §5). The server sanitizes `name` and validates the whole object;
applying it **resets every seat's `ready` flag**. Broadcasts `room_state` plus a
`settings_changed` system `chat`. Errors: `forbidden` (non-host), `bad_message`
(invalid settings, or sent during a match).

```json
{ "type": "settings_update", "settings": { "...": "see §5" } }
```

### `set_freemods`

Sets the **sender's** freemods (schema in §5). Any seat may send it, but **only
between matches**. Broadcasts `room_state`. Errors: `bad_message` (invalid
freemods, or sent during a match).

```json
{ "type": "set_freemods", "freemods": { "difficulty": "expert", "minWpm": 60, "nospace": true } }
```

### `start_match`

**Host-only**. Valid **iff** the room has **at least two seats** and **every
non-host seat is `ready`**; otherwise `not_ready`. On success the server emits a
`countdown` to every seat carrying the frozen settings and per-player freemod
snapshot (see §4). Errors: `forbidden` (non-host or a match already running),
`not_ready`.

```json
{ "type": "start_match" }
```

### `kick`

**Host-only**. Removes another seat: the target receives a `kicked` frame and is
dropped (its **connection stays open** so it may join another room), while the
remaining seats receive a fresh `room_state` and a **neutral** `leave` system
`chat` (a kick is not distinguishable from a voluntary leave on the wire).
Errors: `forbidden` (non-host), `bad_message` (no such player / cannot kick
yourself).

```json
{ "type": "kick", "playerId": "8a2f...91" }
```

### `transfer_host`

**Host-only**. Hands the host role to another seat. Broadcasts `room_state` plus
a `host_changed` system `chat`. Errors: `forbidden` (non-host), `bad_message`
(no such player).

```json
{ "type": "transfer_host", "playerId": "8a2f...91" }
```

### `chat_send`

Posts a lobby chat message, **1–200 characters** after trimming. Rate-limited
per sender (token bucket, burst **5**, refilled to full over **2 s**); an
over-quota message is answered with `rate_limited` and not broadcast. On success
the server broadcasts a `chat` frame to the room. Errors: `bad_message` (empty
or too long), `rate_limited`, `not_in_room`.

```json
{ "type": "chat_send", "text": "gl hf" }
```

### `event_batch`

Relays a batch of the frontend's **log-v1 `GameEvent`** objects during an active
match. The server validates only the **envelope** (below), stamps each accepted
batch with its server receive time, appends it to the sender's authoritative
per-player capture, and relays it as a `peer_batch` to every other seat. The
**contents stay opaque** — structural/semantic validation is the future replay
worker's job.

**Envelope validation (all must hold, else `bad_message`; the batch is dropped
and the connection stays open):**
- the sender is in a room whose match is active and whose id equals `matchId`;
- `batchSeq` is **strictly `lastSeq + 1`** (per player, starting at `1`) — any
  gap or duplicate is rejected;
- `events` is non-empty;
- the whole frame is **≤ 1 MiB**.

- `matchId` — the match this batch belongs to.
- `playerId` — the sender (as issued in `hello_ok`).
- `batchSeq` — a **monotonic, per-player** batch counter starting at `1`. It lets
  the server detect gaps and duplicates when replaying the backlog after a
  reconnect; the transport preserves order, `batchSeq` makes loss/duplication
  detectable.
- `version` — the **event-log format** version (log-v1 ⇒ `1`).
- `events` — the ordered array of opaque event objects.

**Batching contract (client obligation):** the client flushes a batch every
**≤ 100 ms** or every **16 events**, whichever comes first. Batches are
**strictly sequence-ordered** — the server relays and appends them in the order
received per player and never reorders.

```json
{
  "type": "event_batch",
  "matchId": "m_9f3a",
  "playerId": "3b1e...c4",
  "batchSeq": 7,
  "version": 1,
  "events": [
    { "k": "insert", "seq": 1, "t": 12, "ch": "t" },
    { "k": "insert", "seq": 2, "t": 96, "ch": "h" },
    { "k": "commit", "seq": 3, "t": 240 }
  ]
}
```

> The `events` objects above are illustrative of the frontend's log-v1 shape;
> the server treats them as opaque and relays/persists them verbatim. Their
> canonical schema lives in the frontend repository's core (`insert` / `delete`
> / `commit` / `replace`).

### `leave`

Voluntarily leaves the current room.

```json
{ "type": "leave" }
```

### `finish`

Signals that the sending player has completed the match. The server broadcasts a
`peer_status` `finished` for that player and ends the match once **every seat is
finished / dnf / left**. Errors: `not_in_room`, or `bad_message` (unknown
`matchId`, or the seat is not an active participant).

```json
{ "type": "finish", "matchId": "m_9f3a" }
```

---

## 4. Server → client messages

### `hello_ok`

Acknowledges a valid `hello`. `playerId` is the server-issued opaque identity
for this connection; `serverVersion` echoes the protocol version the server
speaks (always equal to the client's, since a mismatch would have been rejected).
`resumeToken` is a fresh **256-bit random** secret (64 hex chars): the client
stores it and presents it in a later `hello` to reclaim its seat after a
disconnect (see §6). It is a capability, not the `playerId` — the `playerId` may
be shown to peers, the `resumeToken` never is.

```json
{ "type": "hello_ok", "playerId": "3b1e9c2f7a8d4e10b6c5a1d2e3f40506", "serverVersion": 1, "resumeToken": "b3f1...c9" }
```

### `error`

Reports a problem. `code` is one of the fixed values below; `message` is a
human-readable explanation (not for programmatic use).

```json
{ "type": "error", "code": "bad_message", "message": "hello must be the first message" }
```

| `code`             | Meaning                                                        | Closes connection? |
|--------------------|---------------------------------------------------------------|--------------------|
| `version_mismatch` | Client protocol version ≠ server's                            | **Yes** (after the error frame is sent) |
| `bad_message`      | Malformed frame, wrong order, unknown/unsupported type, invalid payload | No |
| `room_not_found`   | `join_room` code has no room                                   | No |
| `room_full`        | Room already at capacity (5)                                   | No |
| `not_in_room`      | Room-scoped message sent while not in a room                   | No |
| `forbidden`        | Host-only action attempted by a non-host (or an already-running match)  | No |
| `not_ready`        | `start_match` with fewer than 2 seats or an unready non-host seat | No |
| `rate_limited`     | `chat_send` over the per-sender rate limit                     | No |
| `internal`         | Unexpected server error                                        | No |

### `ntp_pong`

Answers an `ntp_ping`.

- `t0` — the client's `t0`, **echoed unchanged**.
- `t1` — the server clock at the moment it **received** the ping.
- `t2` — the server clock at the moment it **sent** the pong.

```json
{ "type": "ntp_pong", "t0": 1737645123456, "t1": 1737645123500, "t2": 1737645123501 }
```

#### Client clock-offset procedure (frontend implementer, read this)

The countdown (`goAtServerMs`) is expressed in the **server** clock. To schedule
the local 3-2-1 the client must know its offset from the server clock. Compute
it like NTP:

1. Send **at least 5** `ntp_ping` / `ntp_pong` pairs **before any countdown**.
2. For each pair, let `t3` be the client clock reading at the moment the
   `ntp_pong` **arrives**. Then:

   ```
   offset = ((t1 − t0) + (t2 − t3)) / 2
   rtt    = (t3 − t0) − (t2 − t1)
   ```

   `offset` is `serverClock − clientClock` (add it to a client time to get
   server time; subtract it from a server time to get client time).
3. **Discard** any pair whose `rtt` exceeds **3× the minimum observed `rtt`**
   (these are jittered outliers).
4. Use the **median** `offset` of the surviving pairs.

To convert a countdown: `localGoTime = goAtServerMs − offset`.

### `room_state`

Full snapshot of a room, broadcast to every seat on any change and sent to a
resuming client right after its `hello_ok` (see §6). `name` and
`visibility` are surfaced at the top level for convenience and also appear inside
`settings`; `hostPlayerId` names the current host seat. Each entry in `players`
carries the seat's identity (`nick`, `isGuest`), `ready` flag, and log-provable
`freemods`. The `settings` and `freemods` schemas are defined in §5.

```json
{
  "type": "room_state",
  "code": "K7GQ2M",
  "name": "Trinity's room",
  "visibility": "private",
  "hostPlayerId": "3b1e...c4",
  "settings": {
    "name": "Trinity's room",
    "visibility": "private",
    "mode": "time",
    "durationMs": 30000,
    "lang": "en",
    "dictHash": "en-default",
    "textMods": { "punctuation": false, "numbers": false, "randomCase": false, "reverse": false },
    "textSource": { "kind": "seeded" }
  },
  "players": [
    { "playerId": "3b1e...c4", "nick": "Neo", "isGuest": false, "ready": true,
      "freemods": { "difficulty": "normal", "minWpm": 0, "nospace": false } },
    { "playerId": "8a2f...91", "nick": "Guest-4831", "isGuest": true, "ready": false,
      "freemods": { "difficulty": "expert", "minWpm": 60, "nospace": true } }
  ]
}
```

### `countdown`

Announces the shared match start. All clients convert `goAtServerMs` via their
NTP offset and schedule the local 3-2-1; the shared **t=0** (the "go" instant)
is identical for everyone. The countdown is the **frozen** snapshot of the
match: the room's `settings` and each seat's `freemods` at the moment
`start_match` succeeded. A `set_freemods`/`settings_update` arriving after this
is rejected (see §5) — the match runs against exactly what the countdown carried.

- `matchId` — the match identifier the client echoes in `event_batch` and
  `finish`. Freshly minted each `start_match` (a rematch gets a new one).
- `goAtServerMs` — server-clock instant of t=0.
- `seed` — the generation seed: an **integer in `[0, 2³²−1]`** (mulberry32 is a
  32-bit PRNG; this range fits a JSON number with room to spare — no 2⁵³ issue).
  It is **server-generated and appears only here** — never in `settings`. A
  client cannot choose the seed (a pre-known seed is a pre-practiced map).
- `settings` — the frozen room settings (§5), including `textSource`, `lang`,
  `dictHash`, and the shared `textMods`.
- `players` — the per-player frozen `freemods` snapshot, `{ playerId, freemods }`.

```json
{
  "type": "countdown",
  "matchId": "m_9f3a",
  "goAtServerMs": 1737645130000,
  "seed": 2864901,
  "settings": {
    "name": "Trinity's room", "visibility": "private", "mode": "time",
    "durationMs": 30000, "lang": "en", "dictHash": "en-default",
    "textMods": { "punctuation": false, "numbers": false, "randomCase": false, "reverse": false },
    "textSource": { "kind": "seeded" }
  },
  "players": [
    { "playerId": "3b1e...c4", "freemods": { "difficulty": "normal", "minWpm": 0, "nospace": false } },
    { "playerId": "8a2f...91", "freemods": { "difficulty": "expert", "minWpm": 60, "nospace": true } }
  ]
}
```

### `chat`

A lobby chat message. For a **player** message `from` is the sender's `playerId`
and `kind` is absent; for a **server system** message `from` is `"system"` and
`kind` is one of `join` | `leave` | `settings_changed` | `host_changed` (a kick
is reported as a neutral `leave`). `ts` is the server send time in Unix ms. Chat
is **not persisted** — it lives only for the room's lifetime.

```json
{ "type": "chat", "from": "8a2f...91", "text": "gl hf", "ts": 1737645123999 }
```

```json
{ "type": "chat", "from": "system", "kind": "join", "text": "Guest-4831 joined", "ts": 1737645124050 }
```

### `kicked`

Tells a client the host removed it from its room. The **connection stays open**;
the client may `create_room` or `join_room` again.

```json
{ "type": "kicked" }
```

### `peer_batch`

Relays another player's events to this client, **order preserved per player**.
The relay is **lossless**: while a peer is disconnected the server buffers its
peer-relay backlog and replays it, in order, on reconnect (§6). `events` is the
opaque payload (same shape as `event_batch.events`).

```json
{ "type": "peer_batch", "playerId": "8a2f...91", "events": [ { "k": "insert", "seq": 1 } ] }
```

### `peer_status`

Reports a peer's lifecycle transition.

- `status` is one of: `joined`, `left`, `disconnected`, `reconnected`,
  `finished`, `dnf`. A mid-match drop broadcasts `disconnected` (grace starts),
  then `reconnected` on resume or `dnf` on grace expiry; `finished` is broadcast
  on the peer's `finish`.

```json
{ "type": "peer_status", "playerId": "8a2f...91", "status": "disconnected" }
```

### `match_end`

Ends the match. Broadcast **exactly once per match** to every frozen-roster
seat: live seats receive it directly; a **graced** (disconnected) seat receives
it via its buffered backlog, so a resumer still gets it (§6). It is emitted
**after** the final `peer_status` broadcast and **before** the post-match
`room_state`.

- `matchId` — the match that ended.
- `reason` — why it ended:
  - `all_finished` — every seat reached a terminal status (`finished` / `dnf` /
    `left`), including `dnf`s from the words-mode idle rule (§6);
  - `deadline` — the hard deadline elapsed and every unfinished seat was
    force-`dnf`'d;
  - `finish_window` — the words-mode finish window closed and the stragglers
    were `dnf`'d (§6).
- `results` — one entry per seat of the **frozen roster** (`countdown.players`),
  in no guaranteed order:
  - `playerId` — the seat.
  - `status` — `finished` | `dnf` | `left`.
  - `finishedAtMs` — the **server clock** at receipt of that player's `finish`;
    present **only** for status `finished`.
  - `batchCount` / `eventCount` — the count of **accepted** `event_batch`
    envelopes and the total events across them (`0` for a silent player).

The server never parses the opaque events, so `match_end` carries **no
metrics** — clients fold metrics from the logs as before.

```json
{
  "type": "match_end",
  "matchId": "m_9f3a",
  "reason": "all_finished",
  "results": [
    { "playerId": "3b1e...c4", "status": "finished", "finishedAtMs": 1737645130000, "batchCount": 12, "eventCount": 340 },
    { "playerId": "8a2f...91", "status": "dnf", "batchCount": 0, "eventCount": 0 }
  ]
}
```

---

## 5. Rooms

### Codes and lifecycle

- **Codes** are **6 characters**, drawn from a **human-safe alphabet** that
  excludes the ambiguous glyphs `0`, `O`, `1`, and `I`. They are stored
  upper-case; `join_room` matching is **case-insensitive** (input is trimmed and
  upper-cased before lookup). *(Resolves the earlier open question on case.)*
- A room holds **at most 5 seats**; a 6th `join_room` gets `room_full`.
- A room **dies when empty**: the last seat **leaving** (or being kicked, or its
  disconnect grace expiring) removes it. A **graced** seat (see §6) still counts
  as present, so a room whose seats are all graced survives until the grace
  expires.

### Identity

- A **guest** connection is assigned a **unique per-room** nick `Guest-XXXX`
  (4 digits) when it joins; the client-supplied `hello.nick` is ignored.
- An **authenticated** connection (session cookie on the WS upgrade) uses its
  account **displayName**.
- `room_state` exposes `isGuest` per seat so the frontend can style accordingly.

### Host role

- The **creator** is the first host.
- The host may hand off explicitly (`transfer_host`).
- On the host **leaving**, the role passes **automatically** to the
  **earliest-joined** remaining seat; a `host_changed` system `chat` announces
  it. A host **disconnect** does **not** pass the role: the host seat is graced
  (see §6) and keeps the role; succession happens only if the grace expires.

### Settings (host-controlled, shared by all)

`settings` is the room configuration. Every field is text- or match-affecting
and **identical for all players** — everyone types the same text. It is set via
`settings_update` (host-only, between matches) and echoed in `room_state` and
`countdown`.

| field | type | notes |
|-------|------|-------|
| `name` | string | 1–32 chars after sanitizing (control chars stripped, trimmed) |
| `visibility` | `"open"` \| `"private"` | stored and broadcast; the public room list is a later phase |
| `mode` | `"time"` \| `"words"` | selects which of the two below applies |
| `durationMs` | int > 0 | present for `time` mode |
| `wordCount` | int > 0 | present for `words` mode |
| `lang` | string | dictionary language code |
| `dictHash` | string | FNV-1a dictionary fingerprint the match runs against |
| `textMods` | object | `{ punctuation, numbers, randomCase, reverse }` booleans — **text-affecting**, so shared |
| `textSource` | object | discriminated; **v0 is `{ "kind": "seeded" }` only** (see below) |

**`textSource` (future-proofing).** v0 validates `textSource.kind == "seeded"`.
The quote phase will add `{ "kind": "quote", "quoteId": "…" }` **additively**
(no protocol bump). The generation **seed** is deliberately **not** part of
`settings`: it is server-generated and appears only in `countdown`. A
client-chosen seed is rejected by design — a pre-known seed is a pre-practiced
map.

### Freemods (per-player, scored)

Each seat chooses its own `freemods` in the lobby (`set_freemods`, between
matches). They are **log-provable** and **count toward the match score** — see
the scoring rule below. They are broadcast in `room_state` and **frozen** into
`countdown` at `start_match`; a `set_freemods` arriving during a match is
rejected.

| field | type | notes |
|-------|------|-------|
| `difficulty` | `"normal"` \| `"expert"` \| `"master"` | |
| `minWpm` | `0` \| `60` \| `80` \| `100` | minimum-WPM floor |
| `nospace` | bool | |

### Mods and score (the rule)

**Only log-provable mods multiply the match score.** `freemods` are verifiable
from the event log and therefore scored. **Personal visual mods**
(blind / fading / flashlight) are **client-local**: they never travel on the
wire, never appear in `room_state`/`countdown`, and never affect the score.

*(Rooms/lobby are implemented in this phase; the match relay lands next.)*

---

## 6. Server obligations

Status of the v1 relay obligations. Items marked **IMPLEMENTED** are live as of
this phase; the wall-clock check is deferred to the replay worker.

- **Inbound timestamping — IMPLEMENTED.** Every accepted `event_batch` is stamped
  with its server arrival time (`recvServerMs`) and appended to the per-player
  authoritative capture; the capture is persisted (gzip) at match end for the
  future replay worker.
- **Wall-clock plausibility — DEFERRED.** A run's final event time must fall
  within `[go, lastBatchRecv + RTT tolerance]`. Violations are **flagged, not
  rejected mid-match**. This is resolved out of band by the **replay worker**;
  the relay lands the raw capture untouched, so no validation happens now.
- **Disconnect policy — IMPLEMENTED.** On **any** WebSocket drop — lobby or
  mid-match — the server **keeps the seat for a 15 s grace window**. Mid-match
  it broadcasts `peer_status disconnected` and **buffers the peer-relay
  backlog**; a **lobby-phase** drop is **silent on the wire** — the seat simply
  stays (ready flag and host role included), no host succession happens while
  graced, and a room whose seats are all graced survives until expiry. A
  reconnect (a `hello` presenting the same `resumeToken`, compared in constant
  time) reclaims the seat in **any phase**: the server answers `hello_ok`,
  **always follows with a fresh `room_state`**, and mid-match then **replays the
  backlog in order, exactly once** and broadcasts `reconnected`. An **unknown
  or expired** token is **not an error** — the hello degrades to a fresh
  connection (see §3). Grace expiry
  **mid-match** ⇒ the peer is broadcast as `dnf`, its seat freed for host
  succession, and the match continues for the others; grace expiry **outside a
  match** ⇒ the normal leave flow (seat removed, `room_state`, a `leave` system
  `chat`, host succession; an empty room dies). Spectator-side ghosts **freeze
  during the gap and fast-forward on catch-up** (the client's jitter buffer
  absorbs this).
- **Match end — IMPLEMENTED.** A match ends when every seat is finished/dnf/left
  (including words-mode idle-rule `dnf`s), at the hard deadline
  (`goAtServerMs` + duration for time modes / a generous word-mode ceiling,
  + 30 s slack) with unfinished seats broadcast `dnf`, or when the words-mode
  finish window closes (below). The end is announced by a single `match_end`
  frame (§4) — emitted after the final `peer_status` and before the post-match
  `room_state`; a graced seat receives it via its backlog on resume. End clears
  the in-match state and resets ready flags; a rematch re-readies and gets a
  **new seed** and `matchId` on the next `start_match`.
- **Words-mode AFK rules — IMPLEMENTED.** Server-owned; **time mode is
  untouched** (its duration+slack deadline stands).
  - **Idle timeout** (`WORDS_IDLE_TIMEOUT_MS` = 30 000): a racing seat with
    **no accepted `event_batch` for 30 s** — measured from "go", then from each
    accepted batch — is `dnf`'d and a `peer_status` `dnf` is broadcast.
  - **Finish window** (`FINISH_WINDOW_MS` = 120 000): when the **first** seat
    finishes a words-mode match, a 120 s window starts; at close every
    still-racing seat is `dnf`'d and the match ends with reason `finish_window`.
  - Both cancel at match end; a **graced** (disconnected) racing seat is **not**
    exempt — its grace-`dnf` or the idle rule, whichever fires first.
- **Heartbeat — IMPLEMENTED.** WebSocket ping/pong on a 15 s interval; 2 missed
  pongs ⇒ the peer is considered disconnected (the grace window starts).

---

## 7. Open questions

Gaps in the source specification, surfaced here rather than decided unilaterally.
Items marked **RESOLVED** carry the owner's decision (already reflected above);
the rest still need a decision before the relay phase implements them.

1. **Reconnect token transport — RESOLVED.** `hello_ok` issues a `resumeToken`
   (256-bit random, 64 hex chars); a reconnect is `hello {resumeToken}`. The
   token is a secret capability distinct from the peer-visible `playerId`, so a
   guessed `playerId` cannot hijack a seat. Logged-in users are additionally
   covered by their auth session cookie. (See §3 `hello` / §4 `hello_ok`.)
2. **`event_batch` sequence field — RESOLVED.** The envelope carries an explicit
   `batchSeq` (monotonic, per-player, starting at 1). Transport order is
   preserved by WebSocket/TCP; `batchSeq` exists so gaps and duplicates are
   detectable during backlog replay after a reconnect. (See §3 `event_batch`.)
3. **`seed` encoding — RESOLVED.** `seed` is an integer in `[0, 2³²−1]`
   (mulberry32 is 32-bit; safely within JSON's 2⁵³ integer range). (See §4
   `countdown`.)
4. **`event_batch.version` semantics.** Confirmed as the **event-log** format
   version (log-v1 ⇒ 1), *not* the protocol version. Flagged only because the
   name collides conceptually with `protocolVersion`; the two version numbers
   evolve independently.
5. **Room-code case sensitivity — RESOLVED.** Codes are stored upper-case and
   `join_room` upper-cases (and trims) the input before lookup, so entry is
   case-insensitive. (See §5.)
6. **Room message acknowledgements — RESOLVED.** Success is a fresh `room_state`
   broadcast to every seat (no separate targeted ack); `start_match` instead
   emits a `countdown`, and `kick` sends the target a `kicked` frame. Errors are
   targeted `error` frames to the sender only. (See §3 / §4.)
7. **Max frame size.** No inbound frame-size limit is specified. The server
   currently caps a single frame at 1 MiB; the relay phase's `event_batch`
   sizing (≤16 events/batch) should confirm this ceiling is comfortable.
8. **`ntp_pong.t2` precision.** `t2` is captured just before the frame is queued
   for the socket writer, not at the exact byte-on-wire instant; the queue is
   effectively empty for the tiny NTP frames, so the gap is sub-millisecond, but
   it is a known, bounded approximation the offset math already tolerates via
   the RTT filter.
