# Game architecture

The typing game core is a **pure, synchronous, instantiable reducer** over a
serializable event log. Everything downstream — live UI, replays, network, and
server-side anti-cheat — is a function of that log. This doc is the contract for
future work; read it before touching `src/shared/core/**`.

```
src/shared/core/        framework-free engine (no Vue/Pinia/DOM — enforced by core.purity test)
  events.ts             event protocol (branded seq/t, discriminated union)
  parse.ts              runtime parsers for foreign events (the transport boundary)
  words.ts              mulberry32 PRNG + FNV-1a dict hash + seeded generation
  game-core.ts          reduce() / settle() / foldLog() + GameCore class
  stats.ts              metrics as pure functions of the log
  score.ts              scoreV1 (combo × acc² [× timeBonus]) — pure, server-recomputed
  timer.ts / timer.worker.ts   authoritative tick (cadence only)
  validate.ts           server-side validateLog
src/entities/game/      thin Pinia wrapper (useGameStore factory) + GameView contract + config→core mapping
src/entities/match/     GhostDriver (live opponent core) + DemoFeed (bot harness) + match store
src/widgets/test/       GameField (pure GameView renderer, shadow render)
src/features/test/      word / input / settings-bar / results / replay views
src/pages/home/         the game (session lifecycle: setup, rebuild, timer, Esc)
```

## Slot invariant (where an option lives)

Every option belongs to exactly one slot. If it influences **generation** or the
**validity of input**, it MUST be in the seed context or the reducer snapshot —
otherwise replays and `validateLog` diverge from the client.

| Slot                 | Type                              | Reconstructed by          | Examples                                                                                                                     |
| -------------------- | --------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **GenerationConfig** | seed context (`words.ts`)         | replay word generation    | `punctuation`, `numbers`, **`randomCase`**, **`reverse`**, **`rawTokens`**, `mode`/`length` (+ dictionary via `dictVersion`) |
| **CoreConfig**       | reducer snapshot (`game-core.ts`) | `foldLog` / `validateLog` | `mode`, `durationMs`, `maxExtraChars`, **`difficulty`**, **`nospace`**, **`minWpm`**, **`startPolicy`**                      |
| **view-only**        | app config, never in core/log     | —                         | **`blind`**, **`fading`**, **`flashlight`** (toggle live, no rebuild)                                                        |

Word mutations from the dictionary (capitalization, suffixes, punctuation,
numbers, random case, **reverse**) are **deterministic transforms driven by the
same seed PRNG**, applied in a fixed, documented order in `words.ts` — their
toggles are GenerationConfig. Reverse is the FINAL transform (step 5), a pure
output mirror applied after sentence-boundary detection, so it perturbs neither
the PRNG stream nor capitalization (reverse-on targets are exact mirrors of
reverse-off at the same seed). `difficulty` (expert/master fail rules), `nospace`,
and **`minWpm`** (the MinSpeed net-WPM floor, enforced time-driven in `settle`)
change input validity → CoreConfig. **`startPolicy`** decides where `t = 0` is
(see "Match start policy") and therefore when the deadline falls, so it is
CoreConfig too — a replay that guessed it would settle at the wrong instant.
`blind`, `fading`, and `flashlight` only affect rendering → view-only.
**`rawTokens`** switches those transforms OFF wholesale (code dictionaries author
their own case, punctuation and `\t`/`\n` layout); it changes the generated list,
so it is GenerationConfig and travels in the seed context like the rest.

Changing any generation/core option = a **new immutable instance** (test
restart), never a live config mutation. `blind` applies on the fly.

## Event protocol

- Union: `insert` (text), `delete` (`char` | `word`), `commit` (word boundary),
  `replace` (`[from,to)` → text, `source: 'ime' | 'paste'` — reserved, unused in UI).
- `seq`: monotonic (loss/dup guard, deterministic tie-break). `t`: ms offset from
  **test start** (never raw `performance.now()` — clients have different timebases).
- `EVENT_LOG_VERSION` is the wire version; bump on any breaking change.
- **One grapheme per `insert`.** The input layer emits exactly one grapheme per
  keystroke; any multi-character input goes through `replace` (autocomplete/IME =
  `ime`, paste = `paste`). A multi-grapheme `insert` in a log is a `validateLog`
  suspicious flag.
- **nospace**: no `commit` events exist; word boundaries are derived — an `insert`
  that fills a word to its target length auto-commits inside `reduce`. A commit
  event is **rejected** (`NospaceCommit`), never folded as a no-op: an accepted
  event is a logged event, and `validateLog` invalidates a whole nospace log that
  contains one. So a habitual space press is inert for the player and invisible
  in the log, whatever client produced it.
- Correctness is **derived**, not stored: targets are immutable, so `(text,
target, position)` fully determines it. Normalization happens before an event
  is created; events are immutable.
- Backspace cannot re-enter a word committed **fully correct** — `reduce` returns
  `BackspaceLocked` (rejected, never logged). A future `freedomMode` to lift this
  MUST be a CoreConfig field.

## Layout characters (`\t`, `\n`) — code/quote dictionaries

Ported from monkeytype (`test-ui.ts` `buildWordHTML`, `input/handlers/keydown.ts`).
A code dictionary carries its layout inside the words: `\t` at the head of a
token (indentation), `\n` at the tail of the token that closes a line.

- **They are ordinary characters.** A tab or newline is an `insert` of that
  grapheme — no new event kind, no `EVENT_LOG_VERSION` bump. `hasWrongChar`,
  `compareWord` and `applyInsert` compare them like any other character.
- **Enter separates.** The input adapter types the `\n` when the target expects
  one at the caret, then emits the `commit`; otherwise Enter is a plain
  separator (monkeytype's `getCommitCharacterType`: `'\n'` IS a separator).
  Tab types `\t` only when the word list contains one, so it stays the browser's
  focus key everywhere else. Shift+Tab is never intercepted.
- **A newline replaces the space, it does not add to it.** `separatorsOf`
  (`game-core.ts`) is the ONE definition: one separator per committed word,
  minus every word whose target ends with `\n` (its separator was typed as a
  character) and minus the final word of a count-finished test. `netCharsOf`,
  `stats.getChars` and `stats.wpmOverTime` all read it. For a dictionary without
  `\n` the result is bit-identical to the pre-code formula — that property is
  pinned in `score.test.ts` and is why no score/log version moved.
- **`rawTokens`** (GenerationConfig) emits dictionary tokens verbatim: no
  `decorate` transform and no reverse mirror, so `);\n` is never mutated into
  `);\n,` or recased. Optional, legacy default `false`.
  `CODE_MAX_EXTRA_CHARS = 40` is the matching `CoreConfig.maxExtraChars` for such
  runs (a code "word" is a whole indented line, so the prose-sized 20-char
  allowance runs out mid-line).
- **Auto-indent is deliberately NOT ported.** Monkeytype auto-types the leading
  tabs of the next line (`input/handlers/insert-text.ts`, "code mode - auto
  insert tabs"). Doing that here would fabricate log events the player never
  typed: they would score (every insert is a scoring keystroke) and they would
  poison the plausibility heuristics `validateLog` runs on intervals and
  uniformity. If it is ever wanted, it MUST be a `CoreConfig` flag so the server
  replaying the log knows those keystrokes were machine-generated — do not
  re-litigate it as a UI-only convenience.

**Rollout order — the data IS the feature flag.** core change → `make core-bundle`
re-vendor in TypeMore_back → server deploy → frontend deploy → and only THEN
publish `code_*.json`. Until a dictionary containing `\n` is served, every rule
above is a no-op, so no client/server version pair can disagree on a single run.

## Clocks ≠ metrics

Metrics are computed only from event timestamps and the completion instant
(`finishedAt`, pinned to the deadline in timed mode). The **worker tick is
cadence only** — no metric depends on the number of ticks.

**Timer time-base contract** (`timer.worker.ts`): the worker and main thread have
different `performance.timeOrigin`. The worker only ever sends **elapsed deltas**
(`elapsedMs`), never absolute timestamps and never event `Ms`. Conversion to the
event timebase and `settle`/`GameCore.tick(nowMs)` happen only on the main thread.
A frozen/backgrounded tab keeps the worker running, so `settle` still finishes a
timed test exactly at the deadline.

## Match start policy (`startPolicy`)

`CoreConfig.startPolicy` answers "where is `t = 0`", and it is the ONLY difference
between a solo run and a match run at the core level:

| Value                                            | Used by                    | `t = 0`                 | Idle run                                                |
| ------------------------------------------------ | -------------------------- | ----------------------- | ------------------------------------------------------- |
| `'input'` (default, omitted in legacy snapshots) | solo                       | the first event         | never starts, never finishes                            |
| `'go'`                                           | matches (`freemodsConfig`) | the server's go instant | **runs, and settles at the deadline with an empty log** |

`initialStateOf(ctx)` is the single place the policy is applied: under `'go'` the
initial state is already `running` with `startedAt = 0`, so `settle` — and with it
the timed deadline, the MinSpeed floor, `foldLog`, `validateLog` and every metric
— is live before a single character is typed. `GameCore`, `foldLog` and
`stats.analyze` all seed from it, so the live client, a replay and the server's
recompute cannot disagree.

Client side the policy costs exactly one call: `useGameStore().start(atPerf)`,
issued by the session store at go. It pins the stamp anchor (so every event `t` is
an offset from GO, back-dated by however late the countdown ticker noticed the
instant) and starts the authoritative timer. Solo never calls it, so the lazy
start is untouched.

**Why this is a fairness fix, not a nicety.** With a lazy start, a match player
who never typed never started a timer, never settled, never sent `finish` — their
seat hung until the server's hard deadline while everyone else waited; and a
player who started typing late got a full duration from their own first keystroke.

## Canonical progress

There is exactly ONE progress definition, `progressOf(ctx, state)` in
`game-core.ts` (with `targetCharsOf` / `totalTargetCharsOf` underneath): **committed
target characters plus the filled target positions of the active word, over the
text's total target characters**. Extra (over-typed) characters shift the caret
but occupy no target position, so they NEVER advance it, and it is monotonic
within a word and across commits. There is no "finished ⇒ 1" special case: a
count-mode run that consumed the text committed every target character and reads
1 on its own, while a timed run keeps its true share of the text — a player who
typed nothing reads 0, which is the honest number for the standings.

Everything reads that one function: the peer rail (`PeerView.metrics.progress`),
the standings tie-break among eliminated players, and — in field coordinates —
`PeerView.caret` (`GhostCaretAnchor`), whose `charIndex` is clamped to the target
word length so an opponent who over-types does not drift ahead of where they
actually are. Ad-hoc "wordIndex / wordCount" or "elapsed / duration" progress is
gone; do not reintroduce one.

## AFK (log-derived)

`afkOf(ctx, log, endMs) → { afkMs, buckets }` (`stats.ts`, pure, no clock — the
purity scan covers it) ports monkeytype's `getAfkDuration`: the run window
(`startedAt → finishedAt`, deadline-pinned in timed mode) is cut into whole
one-second buckets and every bucket containing **no** event counts as one AFK
second. Bucket `i` spans `(start + (i−1)s, start + i·s]`, the start instant itself
belongs to bucket 1, and a partial trailing bucket is never counted — so AFK can
never exceed the run's duration. The window is only as good as the run's END
instant: timed runs (deadline), completed runs and MinSpeed fails have a proven
one, but an ABANDONED count-mode log ends at its own last event, so its trailing
silence is invisible until the server's receive clock feeds in.

`validateLog` consumes it as two **scored plausibility flags**, never a verdict:
`afk-heavy` (`afkMs / runMs ≥ thresholds.afkFlagShare`, default 0.5) and
`trailing-afk` (idle tail after the last event `≥ thresholds.trailingAfkMs`,
default 10 s). The results screen shows the AFK time and its share when non-zero.

**Two AFK measures, deliberately.** The one above is LOG-derived (keystroke
timestamps) and is a client/anti-cheat metric. The server cannot see it — it
never parses events — so the match rule uses its own: one-second buckets of
**batch arrival** times. A words-mode seat whose idle share of the elapsed
window reaches 0.6 (after a 10 s warm-up, swept once a second) is `dnf`'d, and
every `match_end` result carries the measured `afkMs`/`afkShare`, which the
standings render (`dnf · afk 62%`). Time mode is exempt: a timed run cannot be
completed early, so stopping is a legitimate way to end one. This share rule
replaced a fixed 30 s idle timer — a pause is a fraction of the run, absence
keeps growing (TypeMore_back PROTOCOL.md §6).

## Score (scoreV1)

The arcade score layer (`SCORING_CONCEPT.md` §1) lives entirely in
`shared/core/score.ts` — pure and dependency-free like the rest of the core,
because the server executes this exact bundle via **goja** to recompute a run's
score authoritatively from the event log. The client's live number is dopamine
only; the log is the source of truth (`SCORING_CONCEPT.md` §7.1).

**Formula** — `total = round(base × acc² [× timeBonus])`, where `base` is
`Σ 10 × comboMultiplier(streak)` over scoring keystrokes. A keystroke scores iff
it is an `insert` producing a correct letter at a position typed for the first
time (first-attempt correct); corrections score 0 and never restore the combo.
Combo (+0.25× per full 25, capped ×2.5 at 150) resets on any incorrect insert
(extras included) and on committing a word with skipped letters; points are
never subtracted. `acc` reuses `stats.ts` accuracy; the word-mode `timeBonus`
(`referenceTime/actualTime`, `null` in time/free) reuses the same net-char/WPM
accounting, so it is exactly 1.0 at 80 WPM. `gradeOf(acc)` maps SS/S/A/B/C
(§4).

**Two forms, one core.** `scoreStep(state, event, ctx)` is the O(1) incremental
step (live HUD, GhostDriver fold); `scoreOfLog(log, setup)` folds `scoreStep`
over the whole log then finalizes — so the live and batch numbers are
bit-identical by construction. The **only** rounding is the single `round()` on
`total`; no intermediate rounding, so incremental and batch cannot drift
(equivalence property, `score.test.ts`).

**Out of scope here.** scoreV1 IGNORES active mods entirely (mod multipliers land
in scoreV2 below); text star-rating and TP (`SCORING_CONCEPT.md` §3, §5) stay
scoreV3+, pinned to 1.0.

**Version discipline.** `SCORE_VERSION` is stored beside every result. Any
formula change bumps it and adds `scoreV2` ALONGSIDE — v1 is NEVER edited in
place, so historical logs recompute to their original scores
(`SCORING_CONCEPT.md` §7.6; raw logs are kept forever and rescored on rebalance).

## Score (scoreV2 — mods)

`scoreV2` lands ALONGSIDE v1 (`SCORE_VERSION_2 = 2`; v1 is never edited):
`total = round(base × acc² [× timeBonus] × modMultiplier)` — the SAME single
rounding, so with no active mods scoreV2 collapses **exactly** onto scoreV1
(regression property, `score.test.ts`). `modMultiplierV1(setup, declaration)`
(`shared/core/mods.ts`) is the `SCORING_CONCEPT.md` §2 table as data, capped at
×4.0. The store scores with v2; the HUD shows the active multiplier as a static
chip (computed ONCE at run start — a run's mods cannot change mid-run).

Mods split two ways:

- **Verifiable** — DERIVED from the run's setup (GenerationConfig + CoreConfig):
  punctuation, numbers, randomCase, nospace, expert, master, reverse, minSpeed.
  The server reproduces them from the seed + config snapshot, so they cannot be
  forged (they are never "declared").
- **Declared** — the view-only `ModsDeclaration { blind, fading, flashlight }`.
  These leave NO trace in the event log, so the server accepts them **on trust**
  — an acknowledged anti-cheat limitation. The declaration travels inside the
  run's setup payload (opaque `jsonb` server-side — no backend change).

Fading and Flashlight are pure CSS view mods injected into the shadow root
(`widgets/test/game-styles.ts`): fading animates the active word's opacity over
`FADE_MS`; flashlight masks the field with a gradient centred on the caret via
CSS vars set from the existing caret geometry. Per the render fence they add no
per-keystroke JS beyond toggling classes/vars and no layout reads, and the
Playwright perf gate runs the keystroke budget with each active.

## Render contracts (blocking tests)

- **Window + recycle**: only words near the active one are in the DOM, keyed by
  absolute index; whole scrolled-off top lines are dropped. A 10 000-word test
  renders a **bounded DOM corridor** (~60–120 nodes), never ~10 000.
- **≤ 2 Word updates per keystroke** (v-memo keyed `[word, typed, active,
committed, blind]`); a commit updates only the departing + new-active word.
- **Per-keystroke render+layout < 16 ms.**
- **Active-line position invariant**: after every edit, once the new active word
  has rendered, the active word sits on the **first or second** visible line of the
  rendered window — never the third. The window shifts the instant a commit (or a
  mid-word flex-wrap from extra characters) lands the active word on the third line,
  not one edit later. Enforced ordering: **edit → render → read geometry → decide
  shift** — geometry is read only after `nextTick`, because store watchers flush
  before the component re-renders (reading earlier compares against the stale
  layout and lags the shift by one edit). The detector observes the active word via
  BOTH `wordIndex` and `caretIndex`, so mid-word widening is caught too. See
  `applyGeometry` (widgets/test) and `useLineJump.rebalance`.
- Words render in a **shadow root** (closed in prod, open in dev/test); caret and
  window geometry query from the shadow container, never `document`.
- Enforced by: `e2e/perf.spec.ts` (Playwright, **runs in shadow mode**, blocking
  gate for Phase 4/5 and shadow-mode regression), and the Vitest suites under
  `src/__tests__/core/**` + `src/__tests__/game-word.test.ts` (reduce/metrics/
  determinism, missed/error rendering).

## validateLog (server-side anti-cheat)

`validateLog({ seed, dictionary, dictVersion, configSnapshot, log, thresholds? })
→ Result<{ verdict, reason?, flags, metrics }, ValidationError>`. Pure, Node-safe.
Words are regenerated from the seed; the log is replayed; metrics are recomputed
(the client's numbers are not inputs).

Layers: (1) structural (version, contiguous `seq`, monotonic `t`, `t ≤` deadline);
(2) replay via `foldLog` (rejects events after finished, invalid ranges, locked
backspace); (3) commit-consistency branched on `nospace`; (4) input rules
(locked-backspace → invalid; multi-grapheme insert / paste → flag); (5) difficulty
(master/expert trailing events → invalid); (6) two-clock (event-`t` vs
configured-duration, zero point per `startPolicy`); (7) physical plausibility;
(8) AFK.

`verdict: 'valid' | 'invalid'` is a hard judgement (structural/replay/consistency).
Plausibility (`min-interval`, `uniform-intervals`, `zero-variance`,
`superhuman-burst`, `afk-heavy`, `trailing-afk`) produces **scored flags**, not a
binary bot verdict; thresholds are function params.

## Notes for the network phase

- **Seed** is client-generated for local play; in ranked/multiplayer the **server
  hands out the seed** (and config snapshot) so all cores agree.
- **Second clock**: we deliberately do NOT add a client wall-clock field —
  client clocks are not evidentiary. The second clock appears in the network phase
  as **server receive-timestamps** of event batches (used to cross-check the
  event-`t` timeline). `validateLog`'s two-clock check gains that input then.
- **Resume by `seq`**: reconnect replays from the last acked `seq`; `seq`
  contiguity already guards loss/dup.
- **Batching (target state, not yet built)**: outgoing events are batched
  (insert/delete/commit); an opponent's `GhostCore` runs the same `reduce`.
- **`MatchTransport` interface (DI) (target state, not yet built)**: the match
  store takes a transport (send/receive batches) by injection, mirroring how the
  timer worker is injected today — no global singletons. The consuming seam is
  BUILT: `GhostDriver.append(events)` (entities/match) accepts parsed batches,
  and N cores (self + up to 4 ghosts) coexist behind it.

## Ghost seam (built, Phase B)

- **`GameView`** (entities/game/model/view.ts): the narrow readonly render
  contract — snapshot, words, wordIndex, finished, `blind`. `GameField` types
  its `store` prop against it; the local store adapts via `toGameSession`
  (which also injects `blind` from app config — the widget never reads config),
  and any plain reactive object renders (see game-field.test.ts).
- **`GhostDriver`** (entities/match): a private `GameCore` + append/advance
  clock + `GameView` view-model + `metricsOf`-derived live metrics. No Pinia
  store per ghost, no registry entries. The equivalence property
  (ghost-driver.test.ts) is blocking: any chunking/cadence within the jitter
  buffer reproduces `foldLog` bit-identically, including idle time-mode
  deadline settling via the `tick` passthrough.
- **Replay = a ghost**: the replay player feeds a complete log at delay 0.
  `ReplayScheduler` (formerly shared/core/replay.ts) is REMOVED — superseded by
  `GhostDriver`; its tests were ported to ghost-driver.test.ts.
- **Replay fidelity**: a replay renders the run AS PLAYED, never under the
  viewer's live config. `ReplayData` (entities/game) carries both mod halves —
  the `GenerationConfig` and the `ModsDeclaration` — plus the run's `score` and
  `grade`, and the player is driven only by that. The driver's view hardcodes
  `blind: false`, so the declared mods are re-projected onto it via `withBlind`
  - the field's `fading`/`flashlight` props. The "view as the player saw it"
    switch gates that VISUAL layer only (default ON, but OFF for blind, which
    hides the correctness a viewer came to watch); the mod chip row and header
    always report the stored declaration. Guarded by replay-player.test.ts, which
    makes any read of the config store on that path throw.
- **Match store** (entities/match/model/store.ts): local store + ≤4 drivers on
  one clock; the local timer tick is teed through the `attachTimer` seam and
  fans out to every driver; `DemoFeed` replays recorded/synthesized logs as
  bots — kept as a test harness behind the same `append()` seam.
- **Match session** _(built, C1 — entities/match/model/session-store.ts)_: the
  realtime client over an injected `MatchTransport` (shared/match-transport):
  room/chat state, countdown → server-authoritative `GameSetup` (seed + frozen
  settings/freemods; dictionary FNV-1a hash VERIFIED against `dictHash`,
  mismatch = blocking error), input → `EventBatcher` → wire, `peer_batch` →
  per-peer seq bookkeeping (gap ⇒ ghost frozen `desynced`, duplicates ignored)
  → `GhostDriver`, standings folded from logs (words: finish instant; time:
  scoreV2 under each player's OWN freemods). Dev harness at `/match` (dev
  builds only) now drives the session over `LoopbackTransport` + scripted
  bots, still gated by the 5-instance Playwright spec in e2e/perf.spec.ts.
- **Phases**: `lobby → countdown → running → waiting | eliminated → results`.
  `waiting` is a clean finish, `eliminated` a freemod knockout (master/expert
  miss, MinSpeed floor). Both send the SAME `finish` frame — the protocol treats
  finish and fail alike — and both keep the transport, the `peer_batch` intake
  and the ghost fan-out alive, so being out is spectating. Only `match_end`
  enters `results`. A player's fail reason is NOT on the wire: it is replayed
  from their own relayed log under their own frozen freemods
  (`StandingRow.failReason`, `PeerView.failReason`), and it ranks them below
  every true finisher, ordered among themselves by canonical progress.
- **Reload = forfeit** _(Δ2)_: a page reload keeps the SEAT (the resume token
  lives in sessionStorage) but destroys the RUN — the event log, the `seq`
  counter and the t=0 anchor all died with the tab, and restarting `seq` would
  corrupt both the peers' ghost cores and the server's capture. So the fresh
  page detects the situation from `room_state.match` (present only while a match
  runs, and naming a matchId this store is not playing) and sends
  `finish{matchId, forfeit: true}` at once: the seat is recorded `dnf` — never a
  phantom finisher — the others stop waiting, and this tab shows the
  `eliminated` panel with `selfOutcome.reason === 'reload'`. Its own standings
  come from the wire alone (`match_end.results`), because there is no frozen
  countdown snapshot and no log left to fold.

## Match timing model (built in C1; server hard-deadline enforcement lives server-side)

- **Asynchronous ghost-race model**: each player simulates only themselves
  locally; opponents are `GhostCore` instances replaying relayed event logs.
  Results come from the logs, never from network arrival times — ping cannot
  affect a player's own run or score.
- **Start sync** _(built — session store + shared/match-transport/ntp.ts)_: the
  server announces "go at server time T"; clients estimate their clock offset
  NTP-style from ping/pong pairs (`offset = ((t1−t0)+(t2−t3))/2`) and schedule
  a local countdown so all players share t=0 within a few ms regardless of ping.
- **Two clocks, one anchor** _(built — session store)_: the local run's timer
  (owned by the game store) settles the local deadline and STOPS when the local
  core finishes — right for solo, useless for a match that continues without you.
  So the session owns a second timer worker, the **match clock**, armed at go and
  stopped at `match_end`: it is the cadence for the ghost fan-out (`advance`),
  independent of local input and of the local run's state, and it keeps opponents
  settling to their own deadlines in a frozen/backgrounded tab where the coarse
  50 ms interval is throttled. Both clocks share the one t=0 anchor: the server's
  go instant (see "Match start policy"). The Phase B harness anchored t=0 at the
  local run's start; the session store anchors at go, for every core it owns.
- **Ghost display** _(built — `GhostDriver`)_: a fixed jitter buffer (250 ms
  default) with a caller-driven virtual clock. The delay is cosmetic only — it
  never affects results.
- **Dumb, lossless relay**: ALL events including `replace` (ime/paste) are
  relayed; abuse is flagged post-hoc by `validateLog`, not blocked in transit.
  The server timestamps incoming batches and captures the authoritative log
  itself.
- **Server-side wall-clock plausibility bound**: a log's final `t` must fit the
  server-observed window (go → last batch arrival + RTT tolerance); violations
  are flagged (guards against clock-rate manipulation).
