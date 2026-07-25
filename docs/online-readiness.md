# Online multiplayer readiness audit

Read-only audit, 2026-07-23. Evaluated against the planned network model:
WebSocket relay of raw input events; ≤5 players/match; each opponent is a
GhostCore (extra `GameCore` fed by relayed events); server dictates
seed + dict_hash + immutable `CoreConfig` snapshot; post-hoc validation via
`validateLog`. Spec = `docs/game-architecture.md` + the test suite.

## Summary

| # | Area | Verdict |
|---|------|---------|
| 1 | Core instantiability | **READY** (teardown caveat) |
| 2 | Event log as wire format | **NEEDS CHANGE** |
| 3 | Ghost feasibility | **NEEDS CHANGE** |
| 4 | Config & seed injection | **READY** (one page-level watcher to gate) |
| 5 | Determinism guarantees | **READY** |
| 6 | Single-player assumptions | **NEEDS CHANGE** (page layer only) |
| 7 | Missing pieces | **MISSING** (by definition; inventory below) |

Overall: the engine was visibly built for this model. `GameCore` is
instance-pure, the store is an id-keyed factory documented for "local player +
up to four ghosts" (`src/entities/game/model/store.ts:11-13`), the replay
feature is a working single-instance ghost prototype, and `generateWords`
already validates a server-supplied dict hash. What's missing is concentrated
in three seams: inbound-event hardening, a live (streaming) ghost driver with
a metrics path, and lifecycle/teardown.

---

## 1. Core instantiability — READY

N `GameCore` + N workers + N Pinia stores coexist with zero shared gameplay
state.

Evidence:
- `src/shared/core/game-core.ts:297-350` — `GameCore` keeps all evolving state
  in instance fields (`_state`, `_events`); constructor defensively copies
  `{...init.config}` / `[...init.words]`. `reduce`/`settle`/`foldLog` are pure,
  ctx-explicit. `stats.ts`, `replay.ts`, `validate.ts`, `events.ts`: zero
  module-scope mutable bindings.
- `src/entities/game/model/store.ts:66-73` — `core`, `timer`, `anchorPerf`,
  `seq` live inside the per-id `defineStore` setup closure. Factory + registry
  at `store.ts:219-232`. Isolation proven by
  `src/__tests__/stores/game.test.ts:13-38` ("keeps two instances fully
  isolated").
- Timer: `src/shared/lib/hooks/createTimerWorker.ts:9` — fresh `Worker` per
  call; `useGameTimer.ts:37-58` — one worker per timer. The worker's
  module-scope `let startPerf/durationMs/running/timeoutId`
  (`timer.worker.ts:42-45`) are realm-isolated per `Worker` instance — safe.
- Audio: no keystroke sound is wired at all. `useSounds`
  (`src/shared/lib/hooks/useSounds.ts`) has zero app callers (only its test);
  Howler arrives only via `@vueuse/sound` there and in the component-scoped
  alert (`src/shared/ui/alert/ui.vue:71-74`). Ghosts are trivially silent
  today.
- Singletons that DO exist sit outside the store's import graph and are
  snapshot-insulated: `configState` (`shared/lib/helpers/config.ts:6`),
  `currentLang` (`setConfigSettings.ts:32`), the memoized dictionary-JSON
  cache (`json-files.ts:38,57` — benign; drift caught by `dictVersion`), and
  a **dead** module-level LCG `let seed = 123` (`misc.ts:34`, zero callers).

Caveats (the "teardown story" — fix before match screens):
- **Worker lifetime bug**: `useGameTimer.ts:57` registers
  `onScopeDispose(() => timer.dispose())` on the *calling* scope.
  `attachTimer` is invoked from `pages/home/ui.vue:101` inside `onMounted`, so
  unmounting the page terminates the worker — but the Pinia store outlives the
  component and `attachTimer`'s guard (`store.ts:187` `if (timer) return`)
  blocks re-attachment forever. Remount ⇒ permanently dead timer
  (`postMessage` to a terminated worker is a silent no-op). Latent today
  (home page rarely remounts); fatal for a match screen mounted per game.
  [INFERENCE] on the active-scope detail; the guard + terminate interaction is
  directly observable in source.
- **No release path**: `registry` (`store.ts:219`) grows monotonically; no
  `$dispose`, no `registry.delete`, no `detachTimer`. Four ghost stores per
  match (each holding a full event log) persist for the session.
- Test gap: `game.test.ts` never calls `attachTimer` — no test covers 2+
  workers coexisting or teardown/id-reuse.

Minimal change: store-level `dispose`/`detachTimer` that nulls `timer` (worker
owned by the store's scope, not the caller's) + a `releaseGameStore(id)`.

## 2. Event log as a wire format — NEEDS CHANGE

Compact and round-trip-safe; unhardened against foreign input and missing an
envelope.

Ready:
- **Size** (measured JSON): `insert` 46–60 B, `delete` 49–63 B, `commit`
  35–49 B, `replace` ~92 B. Per-keystroke relay is < 1 kB/s/player — trivial
  for 5 players. Upper bounds come from full-precision float `t`
  (`performance.now()` fractions); rounding `t` to integer ms would cut ~30%.
- **Brands**: `Seq`/`Ms` are unique-symbol compile-time brands
  (`events.ts:21-30`), zero runtime representation — values survive
  `JSON.stringify → parse` (verified).
- **Time-base**: `t` is a delta from test start; the anchor is per-store
  closure state captured in `stamp()` (`store.ts:103-108`). Cross-machine logs
  are self-consistent by construction; docs' "Clocks ≠ metrics" contract
  holds (`docs/game-architecture.md:63-74`).
- **Extension room**: `EventLog = { version, events }` (`events.ts:74-77`);
  unknown extra fields are tolerated by omission (structural typing, no strict
  parsing to reject them).

Not ready:
- **No runtime validator for inbound events.** Relayed JSON would be trusted
  blindly. `validateLog` layer 1 (`validate.ts:122-131`) checks version, seq
  contiguity, monotonic `t` — but not field *shapes* (no `kind`/`unit`/`text`
  type checks), and it's post-hoc, not on the hot relay path.
- **`reduce` throws on unknown `kind`.** The switch (`game-core.ts:239-257`)
  has no `default`; an unrecognized event makes `reduce` return `undefined`
  and `foldLog`/`dispatch` throw `TypeError` on `.isErr()` — violating the
  file's own "never throws" contract (header, `game-core.ts:8`). A malformed
  relayed event would crash a ghost. Doc/code mismatch, and a hard requirement
  before any foreign bytes reach a core.
- **No envelope.** Neither event nor log carries player id / match id;
  `EVENT_LOG_VERSION` is checked in exactly one place (`validate.ts:123`).
  The relay protocol needs an envelope *around* `EventLog` — the inner format
  needs no change.

Minimal change: a `parseGameEvent`/`parseEventBatch` guard (shape + brand
entry point) used at the transport boundary, a safe `default` branch in
`reduce` returning a `CoreError`, and an envelope type
`{ matchId, playerId, version, events }` defined at the transport layer.

## 3. Ghost feasibility — NEEDS CHANGE

The pattern is proven end-to-end by the replay feature; three concrete deltas
block *live* ghosts.

Proven today:
- `GameCore.dispatch(event)` settles at `event.t` then reduces
  (`game-core.ts:327-338`) — a core is fully drivable by injected,
  pre-stamped events; `tick(nowMs)` is public for external deadline settling.
- The store runs **without a timer**: `timer` starts `null`, every use is
  optional-chained (`store.ts:114-116,127,137`), `attachTimer` is opt-in.
  A ghost store simply never attaches one.
- `src/features/test/replay/ui.vue:62-96` — the exact ghost mirror: second
  store via `useGameStore('replay')`, external `GameCore` driven by
  `ReplayScheduler.advance(delta)` under a caller-owned rAF virtual clock,
  `store.setState(scheduler.state)` each frame, rendered by
  `<Test :store="store" view-only>`.
- View-only mechanism: `viewOnly` prop → `<TestInput v-if="!viewOnly">`
  (`widgets/test/ui.vue:3,53`) — the input adapter is never mounted;
  `focusInput()` no-ops. `GameField` takes a **required** `store` prop (no
  hidden `'local'` default) and mounts its own shadow root per instance.

Gaps:
1. **No live feed.** `ReplayScheduler` is constructed with a complete log —
   `constructor(core, log)` sorts it once into a private readonly array
   (`replay.ts:31-38`); no append/ingest API. Live ghosts need an appendable
   buffer (events arrive in seq order per the wire contract) or a direct
   `core.dispatch` driver in the match store.
2. **No per-ghost metrics.** `setState` mirrors external state
   (`store.ts:171-173`) but the store's private `core` stays empty, so the
   `metrics`/`timeline`/`errorWords` computeds — all reading
   `metricsOf(core, …)` (`store.ts:81-96`) — return **zero** for a mirrored
   store. Live opponent WPM display is impossible without either an
   `ingest(event)`/`adoptCore(core)` store API or the driver owning metrics.
   Note the replay feature already pays this tax: `store.setup(...)` at
   `replay/ui.vue:63` builds an inner `GameCore` used only for words/snapshot
   while the driving core lives outside.
3. **Ghost clock / deadline settle.** Nothing ticks a mirrored core between
   events: an idle-at-deadline time-mode ghost never visually reaches
   `finished` (`foldLog` handles this via `endMs`; the live mirror path does
   not). The current contract *supports* the fix — `tick()` is public — the
   match driver just has to call it, e.g. from the local player's single
   timer. Ghost clock answer: relayed event `t`s drive dispatch; ONE local
   timer (the local player's) can drive settle for all cores. The timer
   contract allows this; no per-ghost workers needed.

Also: `GameCore.dispatch` on a *rejected* event still advances state to the
settled state (`game-core.ts:333-336`) — deliberate, but relayed garbage
mutates ghost time-phase without being logged. Reinforces the Area 2 parse
boundary.

## 4. Config & seed injection — READY

A run is constructible from an external `CoreConfig` + seed with zero core
changes.

Evidence:
- `toCoreSetup` (`src/entities/game/model/settings.ts:39-44`) is a pure
  function of its `GameSettings` argument; the file imports only types + one
  constant from `@shared/core` — no config store, no Pinia.
- `GameSetup = { config, words }` (`store.ts:44-47`); `setup()` takes it
  as-is. A server-dictated `{seed, dict_hash, CoreConfig, GenerationConfig}`
  slots in via one pure exported call: build `SeedContext`
  (`words.ts:60-64`) directly with the server's hash as `dictVersion`, run
  `generateWords(dictionary, ctx)` — which **already validates the hash**
  against the actual dictionary and errors with `DictVersionMismatch`
  (`words.ts:186-194`). The client-side dict_hash drift check the model wants
  exists at exactly the right seam.
- All config-store reads in the run pipeline are construction-time
  (`pages/home/ui.vue:76-92`, read once in `loadAndSetup`) or view-only
  (`config.blind` in `widgets/test/ui.vue:58`; results summary computed
  `home/ui.vue:64-73`). Nothing downstream re-reads persisted settings into a
  live core. No sound reads in the pipeline.
- Seed is generated at `pages/home/ui.vue:91` (`Math.random`), with the
  comment "a ranked/multiplayer server supplies the seed" — a plain value,
  cleanly bypassable.

Two flags:
- **The home-page watcher and Esc handler rebuild runs from the persisted
  store**: `watch` on 9 core-bound fields → `loadAndSetup()`
  (`home/ui.vue:107-120`) and Esc → `loadAndSetup()` (`home/ui.vue:124-132`).
  Correct for solo (fresh instance per change, never live mutation); in a
  match this would tear down a server-dictated run if the player touches
  settings or hits Esc. Minimal change: a match page/flow that never mounts
  this watcher — no store or core change needed.
- **dict_hash alone cannot select the dictionary.** `getLanguage` fetches by
  language *name* (`shared/lib/helpers/json-files.ts:77-85`). The wire
  protocol must carry the language id; the hash serves as the drift check.

## 5. Determinism guarantees — READY

- **Tests**: `src/__tests__/core/game-core.test.ts:65-86` — bit-identical
  `foldLog`, bit-identical metrics, and *incremental `dispatch` ==
  batch `foldLog`* (line 82: exactly the ghost equivalence). `replay.test.ts`
  converges the scheduler to `foldLog` under arbitrary advance patterns.
  `validate.test.ts` proves seed-regenerated replay + recomputed metrics.
  `purity.test.ts` both runs the core headless in Node **and** statically
  scans `shared/core/*.ts` (comments stripped) for
  `Math.random`/`Date.now`/`performance.`/DOM/`setTimeout`/vue/pinia,
  excluding `*.worker.ts`.
- **Clock/random grep, complete**: `timer.worker.ts:55,66,82`
  (`performance.now` — cadence deltas only, never event `Ms`);
  `store.ts:104` (the designed per-instance anchor); `pages/home/ui.vue:91`
  (local seed, bypassable); `features/servers/contols/ui.vue:55` (UI mock);
  dead helpers in `shared/lib/helpers/{misc,numbers}.ts` (no callers).
  **Zero** `Date.now`/`new Date`/crypto hits anywhere in the game path.
- **Generation**: `mulberry32` (`words.ts:76-85`, `Math.imul`-based,
  engine-independent), `dictVersion` = FNV-1a over the NUL-joined word list
  (content-derived), `generateWords` pure in
  `(dictionary, {seed, dictVersion, generation})`.

Gap: none found for determinism itself. (The unknown-`kind` throw from Area 2
is the only way a replay can diverge — by crashing instead of erroring.)

## 6. Single-player assumptions — NEEDS CHANGE (page layer only)

The render layer is N-instance clean; the coupling is concentrated in one
page.

Instance-scoped (verified, READY):
- `GameField` (`widgets/test/ui.vue`): required `store` prop, per-instance
  shadow root via its own `hostRef` (no `customElements`, no id lookups, no
  global registry), styles injected per-root, words teleported into the
  per-instance shadow container.
- `TestInput` (`features/test/input/ui.vue`): per-instance hidden textarea;
  all listeners element-local (`@beforeinput/@keydown/@paste`) — no
  window/document keydown capture.
- Geometry hooks all closure-scoped, querying only their own container,
  matching the docs' shadow-scoping contract
  (`docs/game-architecture.md:94-95`): `useLineJump.ts:27-30`,
  `useCaret.ts:32,42`, `useScrollTape.ts:21`.
- `TestResults` (`features/test/results/ui.vue`) is a pure props view —
  imports no store; per-player metrics are structurally possible. The
  single-player binding is upstream: the page feeds it exactly one store's
  metrics.
- `TestWord`: pure props; `globalThis.__wordUpdates` (`word/ui.vue:72-77`) is
  a cross-instance counter but test-only (e2e perf seam).

Single-player coupling (all in `src/pages/home/ui.vue`, by design — the
component header at `widgets/test/ui.vue:38-44` states the page owns the
session lifecycle):
- Hardcoded `useGameStore('local')`; one `attachTimer` in `onMounted`
  (line 101); client-random seed (line 91); config watcher rebuild
  (107-120); window-level Esc restart (124-132).
- A match flow bypasses this page wholesale; nothing leaks into `GameField`.

Genuine cross-instance leaks:
- `GameField` reads the **global** config store for `blind`
  (`widgets/test/ui.vue:58`) — blind cannot differ per player view. Probably
  desired (viewer preference applies to all views), but it is a decision, not
  an accident — see open questions.
- Focus: two non-`viewOnly` GameFields on one page would fight on mount
  (`onMounted → focusInput`). Ghost views MUST be given `viewOnly` — then
  only the local field grabs focus. No global focus handling exists.

## 7. Missing pieces inventory — MISSING

| Piece | Status | Notes |
|---|---|---|
| WS client | partial, legacy, **unused** | `src/shared/lib/hooks/useLobbyWebsocket.ts` — hardcoded `ws://localhost:8080/ws/lobby/${id}` (`//!change to env`), `alert()` on failure, zero call sites. Pattern reference only; rewrite. |
| Reconnect/backoff | partial | Fixed-delay `autoReconnect {retries:3, delay:1000}` inside the unused hook. No exponential backoff, no jitter. |
| Heartbeat/ping | absent | No hits repo-wide. |
| Match/lobby state machine | partial (mock) | `entities/lobby/model/store.ts`: singleton Pinia store with a **hardcoded mock lobby assigned at store setup** (lines 23-59, incl. duplicated participant `user3`). Role/permission types (`entities/lobby/types/lobby.ts`) are reusable; the store body is scaffolding. Couples to `useAuthStore`. |
| Event batching | absent | Only the docs promise (`game-architecture.md:130`) and a test name. |
| Clock-skew handling | absent, partially unnecessary | Events carry relative `Ms` only — per-run logs are portable by design. Start-signal alignment / latency compensation has no support. |
| Per-player metric display | absent | `TestResults` renders one run; no N-player component. Blocked anyway on the Area 3 metrics gap. |
| `MatchTransport` interface | absent | Promised in `docs/game-architecture.md:132-134` as DI mirroring `attachTimer` (`store.ts:186`). The seam it should mirror exists; the symbol does not. |
| WS lib in deps | absent | No `ws`/`socket.io-client`/`reconnecting-websocket`. `@vueuse/core` (whose `useWebSocket` the old hook wraps) is a **devDependency** despite production imports (`package.json:88`; `pages/home/ui.vue:27`). |
| Chat | partial | `entities/chat/model/store.ts`: local-only message buffer (uuid + local timestamps). Reusable once a transport feeds it. |
| Servers/Room pages | mock shells | `pages/servers` hardcodes `online = ref(3)`; `features/room/config/ui.vue` is literally `<div>configuration</div>`. Layout skeletons only. |

---

## Prioritized changes

### BLOCKERS (before any network code)

1. **Harden `reduce` against unknown event kinds** — add a `default` branch
   returning a `CoreError` instead of throwing (`game-core.ts:239-257`).
   Restores the documented never-throws contract; prerequisite for feeding
   any foreign bytes to a core.
2. **Runtime event parser at the transport boundary** — a
   `parseGameEvent`/batch guard validating shape (kind, unit, text, numeric
   seq/t) before `dispatch`. `validateLog` layer 1 covers sequencing, not
   shapes, and only post-hoc.
3. **Store ghost seam: event ingest + metrics** — either
   `ingest(event)`/`adoptCore(core)` on the game store so mirrored stores
   have a real event log (fixing zero `metrics`/`timeline` under
   `setState`), or move metrics ownership to the ghost driver. Today
   opponent WPM cannot be displayed at all (`store.ts:81-96`).
4. **Live-appendable ghost driver** — `ReplayScheduler` accepts only a
   complete log at construction (`replay.ts:31-38`); ghosts need append (or
   direct `core.dispatch` from the match store) plus a `tick` passthrough so
   idle time-mode ghosts settle at the deadline.
5. **Timer/store teardown** — fix the `onScopeDispose` scope-tying bug
   (`useGameTimer.ts:57` + `store.ts:187` guard) and add
   `releaseGameStore(id)` (registry delete + `$dispose` + worker terminate).
   Match screens mount/unmount per game; the current wiring yields dead
   timers and leaked ghost stores.
6. **Wire envelope** — `{ matchId, playerId, version, events }` at the
   transport layer; carry the **language id** alongside `dict_hash` (hash
   validates, it cannot select — `json-files.ts:77-85`).
7. **Match flow must not mount the home-page lifecycle** — the config
   watcher (`home/ui.vue:107-120`) and Esc restart (124-132) rebuild runs
   from persisted settings with a fresh random seed; a match page bypasses
   both (no store change needed).

### NICE-TO-HAVE

- Round event `t` to integer ms at stamp time — ~30% smaller wire events;
  no metric depends on sub-ms precision. (Verify against existing tests.)
- Promote `@vueuse/core` to `dependencies` (already imported by production
  code; required before building the transport on `useWebSocket`).
- Delete dead code: `useLobbyWebsocket.ts`, `misc.ts` LCG
  (`generateRandomIndex`), unused `getQoutes` (fetches the language file, not
  quotes).
- Rework `entities/lobby` store: singleton with mock state assigned at setup;
  keep the role/permission types, drop the body. Fix duplicated `user3`.
- Per-player `blind` decoupling if desired (currently global read in
  `GameField`, `widgets/test/ui.vue:58`).
- Test coverage: multi-store `attachTimer` (2+ workers), teardown/id-reuse,
  and a live-ingest ghost equivalence test once the seam exists.
- When keystroke audio gets wired (`useSounds` is implemented, tested, and
  unused), gate it per-view so ghosts stay silent.

---

## Doc/code mismatches

1. `game-core.ts:8` claims `reduce` "never throws" — false for unknown
   `event.kind` (no default case; `foldLog`/`dispatch` then throw
   `TypeError`). Matters exactly when events start arriving from the network.
2. `docs/game-architecture.md:130-134` describe event batching and a
   `MatchTransport` DI interface — neither exists. Docs describe the target
   state; should be labeled as such.
3. `store.ts:13` — "Nothing here is a module singleton" is slightly
   overstated: `registry` (`store.ts:219`) is a module-level mutable Map. Of
   *definitions*, so no gameplay state is shared — nuance, not a violation.
4. `GenerationMode` includes `'quote' | 'free' | 'custom'` (`words.ts:38`)
   but `targetCount` treats `'quote'` as seeded word-count
   (`words.ts:135-147`); `getQoutes` exists, fetches the wrong file, and is
   unused. Type surface promises more than behavior delivers. (Known gap:
   seeded-only text source; `seeded | fixed` abstraction planned.)

## Known gaps (acknowledged, not dwelt on)

- Text source is seeded-only; the quote/fixed-text abstraction is planned.
  When it lands, the wire snapshot needs a text-source discriminator (or an
  `EVENT_LOG_VERSION`-adjacent config version bump).
- No backend exists; `validateLog` is Node-safe and ready to host there.

## Open questions for the author

1. **Relay granularity**: per-keystroke or batched? Affects whether the
   envelope needs a batch shape now and how much the float-`t` size overhead
   matters.
2. **Ghost render clock**: dispatch relayed events immediately on arrival
   (jitter shows), or smooth through a delay buffer with a virtual clock
   (ReplayScheduler-style, adds fixed latency)? The scheduler's
   caller-driven `advance()` supports the latter today — but only with an
   append API.
3. **Should ghost mirrors be Pinia stores at all?** The replay pattern pays
   for a throwaway inner `GameCore` per mirror and the registry never
   shrinks. A lighter per-player view-model owned by the match store may fit
   better than 4 more registered stores per match.
4. **`replace` events in matches**: `source: 'ime' | 'paste'` is reserved and
   currently unused by the UI, and paste is a `validateLog` flag. Are they
   relayed to opponents, blocked at the transport, or allowed and flagged
   post-hoc only?
5. **Version negotiation**: is an `EVENT_LOG_VERSION` mismatch a join-time
   rejection, or does the server translate? One check site exists today
   (`validate.ts:123`).
6. **Per-player `blind`**: current behavior applies the local viewer's
   `blind` to every rendered view (global config read). Intended?
7. **Deadline authority for ghosts**: local player's timer ticking all cores
   assumes all cores share one start anchor. Is match start server-signaled
   (one "go" ⇒ shared `t=0`), or does each player's `t=0` float on their own
   first keystroke? The current time-base contract supports either, but the
   ghost settle logic differs.
