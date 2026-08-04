/**
 * Run-submit payload construction. Maps the finished game surface onto S1's
 * `RunSubmitInput` exactly as `TypeMore_back/docs/RUNS.md` documents it. This is
 * the single contract-drift boundary: the snapshot test guards every field.
 *
 * Field-for-field (RUNS.md POST body → source):
 *   mode          → GameSetup config.mode
 *   durationMs    → config.durationMs           (time mode only)
 *   wordCount     → generation.length           (words mode only; exactly one of the two)
 *                                               (a QUOTE run carries NEITHER — see below)
 *   lang          → the CANONICAL dictionary key ('russian') captured at
 *                   generation — the same identifier bucket keys are minted
 *                   from, never the bcp47 display tag ('ru-RU')
 *   seed          → the 32-bit seed the client generated the words from
 *   dictHash      → SeedContext.dictVersion (fnv1a of the dictionary; of the
 *                                            TEXT for a quote run)
 *   scoreVersion  → 3 (scoreV3 — see SCORE_VERSION note below)
 *   setup         → { adoptedFromRunId?, config, generation, declaration }
 *                   (the replayable snapshot, with generation.textSource
 *                   STRIPPED of its text for a quote, plus the optional text
 *                   provenance marker)
 *   clientMetrics → { wpm, raw, acc } from the store Metrics
 *   clientScore   → the finalized ScoreResult (display-only server-side)
 *   log           → { version, events } — the core EventLog wrapping the store log
 */
import {
  EVENT_LOG_VERSION,
  quoteOf,
  type CoreConfig,
  type EventLog,
  type EventLogVersion,
  type GameEvent,
  type GenerationConfig,
  type GenerationMode,
  type Metrics,
  type ModsDeclaration,
  type QuoteRef,
  type ScoreResult,
  type SeededTextSource
} from '@typemore/core'
import type { RunSubmitInput } from '@shared/api'

/**
 * scoreV3 formula version (ime replaces score — the mobile composition path).
 * The client finalizes with `finalizeScoreV3` (ScoreResult.version === 3), so
 * the submitted `scoreVersion` MUST match. RUNS.md's structural check allows
 * the `KnownScoreVersions` allow-list `{1, 2, 3}`, with v1/v2 kept only for
 * older builds — so v3 is the current contract, not a client that runs ahead
 * of the server. DEPLOY ORDER: the server must know v3 before this ships, or
 * every submit bounces with `unsupported_score_version`.
 */
export const SCORE_VERSION = 3 as const

/**
 * The run's SUBMITTED DIMENSION, or `null` when the run has none to name.
 *
 * This one function is both the gate and the payload field, so the two can never
 * disagree about what a submittable run is — the same "one predicate, two
 * callers" rule `emitsRawTokens` follows in the core. It mirrors the server's
 * dimension rule exactly (RUNS.md, "Dimensions are conditional on the text
 * source", and the `runs_one_dimension` CHECK):
 *
 *   quote  → NEITHER. Its length is the text's, named by `quoteId`; inventing a
 *            `wordCount` would be a second, forgeable copy of something the
 *            registry already knows.
 *   time   → durationMs
 *   words  → wordCount
 *   else   → no dimension, and therefore no board coordinate: `free` is zen and
 *            never ends, `custom` is unranked by SCORING_CONCEPT §2. A run that
 *            cannot name its own shape is not one the server could rank.
 *
 * The quote arm asks the CORE (`quoteOf`) whether this run's targets are a fixed
 * text, rather than testing `mode === 'quote'`. That is the difference between a
 * property and a list: a quote-mode config with no `textSource` degrades to the
 * seeded word-count path in `generateWords`, so the mode name is not the thing
 * that decides — the resolved text source is.
 */
function dimensionOf(ctx: RunSubmitContext): { durationMs?: number; wordCount?: number } | null {
  if (quoteOf(ctx.generation) !== undefined) return {}
  if (ctx.mode === 'time') return { durationMs: ctx.config.durationMs }
  if (ctx.mode === 'words') return { wordCount: ctx.generation.length }
  return null
}

/**
 * Whether this finished run is one the server can rank.
 *
 * NOTE what stopped being a reason. This predicate used to be
 * `mode === 'time' || mode === 'words'`, with `quote` listed beside `free` and
 * `custom` as "never submitted". A quote run is nothing like those two: the
 * server re-resolves its text by id and judges it on the same track as a seeded
 * run, and it ranks on its own per-quote board. Choosing a quote — and typing
 * the same one as often as you like — is the intended way to compete on that
 * board, not a way around anything.
 */
export const isSubmittableRun = (ctx: RunSubmitContext): boolean => dimensionOf(ctx) !== null

/**
 * Everything the payload needs, assembled at run finish from the game store's
 * finish surface (config + log + metrics + score) plus the generation-time
 * metadata the page captured (seed / dictHash / lang / generation / declaration).
 */
export interface RunSubmitContext {
  readonly mode: GenerationMode
  readonly config: CoreConfig
  readonly generation: GenerationConfig
  readonly declaration: ModsDeclaration
  readonly lang: string
  readonly seed: number
  readonly dictHash: string
  readonly metrics: Metrics
  readonly score: ScoreResult
  readonly log: readonly GameEvent[]
  /**
   * The run's event-log version (the store's per-run capability decision).
   * Optional so older assemblers stay valid: omitted ⇒ v1, exactly what every
   * pre-telemetry build submitted.
   */
  readonly logVersion?: EventLogVersion
  /**
   * The run this run's TEXT was taken from, when it was taken from one — today,
   * the record race, which applies the target run's seed and word list wholesale
   * (`features/test/race`). Absent means the text was generated fresh.
   *
   * A run that carries it is a SEEDED REPEAT: saved, judged, and visible in
   * history, but ranked nowhere — no board slot, no PB, no TP (RUNS.md, "Text
   * provenance"). The marker is about the ORIGIN OF THE TEXT and nothing else:
   * a pace caret or a ghost drawn over freshly generated words is an ordinary
   * run, and whether the player beat it changes nothing.
   */
  readonly adoptedFromRunId?: string
}

/**
 * `GenerationConfig` as it goes ON THE WIRE. Identical to the core's shape but
 * for the quote arm, which loses its `text`: the server re-resolves the bytes
 * from `quoteId` and verifies them against `quoteHash`. The client's copy of
 * the text must never be the thing the server trusts — otherwise "everyone
 * types the same bytes" would be a claim the client gets to make about itself.
 */
export type WireGenerationConfig = Omit<GenerationConfig, 'textSource'> & {
  readonly textSource?: SeededTextSource | QuoteRef
}

/** Build the exact RUNS.md POST body. Assumes `isSubmittableRun(ctx)`. */
export function buildRunPayload(ctx: RunSubmitContext): RunSubmitInput {
  const eventLog: EventLog = { version: ctx.logVersion ?? EVENT_LOG_VERSION, events: ctx.log }
  const quote = quoteOf(ctx.generation)
  const generation: WireGenerationConfig = quote
    ? {
        ...ctx.generation,
        textSource: { kind: 'quote', quoteId: quote.quoteId, quoteHash: quote.quoteHash }
      }
    : ctx.generation
  return {
    mode: ctx.mode,
    // Exactly one dimension is set: time → durationMs, words → wordCount. A
    // quote run has neither — see `dimensionOf`.
    ...(dimensionOf(ctx) ?? {}),
    lang: ctx.lang,
    seed: ctx.seed,
    dictHash: ctx.dictHash,
    scoreVersion: SCORE_VERSION,
    setup: {
      // Provenance sits at the TOP LEVEL, beside the three snapshot halves and
      // deliberately not inside `generation`. `generation` is what the core
      // reconstructs a run from — it travels in the seed context and every
      // replay and `validateLog` reads it — and this field must not be able to
      // influence a single target. The server's `Replay` destructures the setup
      // into config / generation / declaration and nothing else, so a fourth key
      // is invisible to the fold by construction.
      //
      // Omitted, not `undefined`, when the text was generated fresh: that is the
      // shape every payload predating the field has, and the one the server
      // reads as "no marker".
      ...(ctx.adoptedFromRunId !== undefined
        ? { adoptedFromRunId: ctx.adoptedFromRunId }
        : {}),
      config: ctx.config,
      generation,
      declaration: ctx.declaration
    },
    clientMetrics: {
      wpm: ctx.metrics.wpm,
      raw: ctx.metrics.raw,
      acc: ctx.metrics.accuracy
    },
    clientScore: ctx.score,
    log: eventLog
  }
}
