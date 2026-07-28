/**
 * Run-submit payload construction. Maps the finished game surface onto S1's
 * `RunSubmitInput` exactly as `TypeMore_back/docs/RUNS.md` documents it. This is
 * the single contract-drift boundary: the snapshot test guards every field.
 *
 * Field-for-field (RUNS.md POST body → source):
 *   mode          → GameSetup config.mode (ranked-eligible: time | words only)
 *   durationMs    → config.durationMs           (time mode only)
 *   wordCount     → generation.length           (words mode only; exactly one of the two)
 *                                               (a QUOTE run carries NEITHER — see below)
 *   lang          → dictionary bcp47 tag captured at generation
 *   seed          → the 32-bit seed the client generated the words from
 *   dictHash      → SeedContext.dictVersion (fnv1a of the dictionary; of the
 *                                            TEXT for a quote run)
 *   scoreVersion  → 2 (scoreV2 — see SCORE_VERSION note below)
 *   setup         → { config, generation, declaration } (replayable snapshot),
 *                   with generation.textSource STRIPPED of its text for a quote
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
} from '@shared/core'
import type { RunSubmitInput } from '@shared/api'

/**
 * scoreV2 formula version. The client finalizes with `finalizeScoreV2`
 * (ScoreResult.version === 2), so the submitted `scoreVersion` MUST match.
 * RUNS.md's structural check allows the `KnownScoreVersions` allow-list
 * `{1, 2}`, with v1 kept only for older builds — so v2 is the current contract,
 * not a client that runs ahead of the server.
 */
export const SCORE_VERSION = 2 as const

/** Ranked-eligible, seeded modes. `free` / `custom` / `quote` are never submitted. */
export const RANKED_MODES = ['time', 'words'] as const
export type RankedMode = (typeof RANKED_MODES)[number]

export const isRankedMode = (mode: GenerationMode): mode is RankedMode =>
  mode === 'time' || mode === 'words'

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

/** Build the exact RUNS.md POST body. Assumes `ctx.mode` is ranked-eligible. */
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
    // quote run has neither — its length is the quote's, named by `quoteId`,
    // and inventing a `wordCount` would be a second, forgeable copy of it. The
    // server relaxes its XOR check for quotes in Stage C.
    ...dimensionOf(ctx),
    lang: ctx.lang,
    seed: ctx.seed,
    dictHash: ctx.dictHash,
    scoreVersion: SCORE_VERSION,
    setup: {
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

function dimensionOf(ctx: RunSubmitContext): { durationMs?: number; wordCount?: number } {
  if (ctx.mode === 'quote') return {}
  if (ctx.mode === 'time') return { durationMs: ctx.config.durationMs }
  return { wordCount: ctx.generation.length }
}
