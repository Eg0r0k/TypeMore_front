/**
 * The stripping property against STORED bytes.
 *
 * `telemetry.test.ts` and `telemetry-property.test.ts` both synthesize their
 * twins — one from a table generator, one from the live game store. Either can
 * only be as right as the thing that produced it. This file compares the core
 * against a pair that nothing in this repository wrote: a real accepted log-v2
 * run lifted verbatim out of the dev database, and its v1 twin frozen on disk
 * beside it. See `../fixtures/telemetry-golden/README.md` for provenance and
 * for why the twin is the derived half.
 *
 * The test never recomputes the twin. It strips the stored v2 log and asserts
 * the result IS the stored v1 file — so a change in what "stripping" means
 * fails here, against bytes, rather than quietly agreeing with itself.
 */
import { describe, expect, it } from 'vitest'

import {
  type ConfigSnapshot,
  type CoreConfig,
  type CoreContext,
  type Dictionary,
  type EventLog,
  type GameEvent,
  type GenerationConfig,
  type ModsDeclaration,
  EVENT_LOG_VERSION,
  EVENT_LOG_VERSION_TELEMETRY,
  asSeq,
  computeMetrics,
  dictVersion,
  foldLog,
  generateWords,
  isTelemetryEvent,
  makeSeedContext,
  parseEventBatch,
  scoreOfLog,
  scoreV2OfLog,
  validateLog
} from '@typemore/core'

import dictionaryFixture from '../fixtures/telemetry-golden/dictionary.json'
import runV1Twin from '../fixtures/telemetry-golden/run-v1-twin.json'
import runV2 from '../fixtures/telemetry-golden/run-v2.json'

const dictionary: Dictionary = dictionaryFixture.dictionary
const seed = runV2.seed
const config = runV2.setup.config as unknown as CoreConfig
const generation = runV2.setup.generation as unknown as GenerationConfig
const declaration = runV2.setup.declaration as ModsDeclaration
const configSnapshot: ConfigSnapshot = { config, generation }

/**
 * Both logs go through the SHIPPED parser rather than being cast out of JSON:
 * the fixture is untrusted input by construction (it came off a wire and out of
 * a database), and a parse is also the cheapest proof that the stored bytes are
 * still a legal log under the current grammar.
 */
const parsed = (raw: unknown): EventLog => parseEventBatch(raw)._unsafeUnwrap()

const logV2 = parsed(runV2.log)
const logV1 = parsed(runV1Twin.log)

const words = generateWords(
  dictionary,
  makeSeedContext(dictionary, seed, generation)
)._unsafeUnwrap().words
const ctx: CoreContext = { config, words }

const strip = (events: readonly GameEvent[]): readonly GameEvent[] =>
  events.filter((e) => !isTelemetryEvent(e))

describe('golden pair: a real v2 run and its stored v1 twin', () => {
  it('the fixture is the run it claims to be', () => {
    expect(logV2.version).toBe(EVENT_LOG_VERSION_TELEMETRY)
    expect(logV1.version).toBe(EVENT_LOG_VERSION)
    // The dictionary body travelling with the fixture is the one the run named.
    expect(dictVersion(dictionary.words)).toBe(runV2.dictHash)
    // Real capture, not a table: telemetry around inserts, commits, deletes.
    const kinds = new Set(logV2.events.map((e) => e.kind))
    expect(kinds).toEqual(new Set(['down', 'up', 'insert', 'delete', 'commit']))
    expect(logV2.events.filter(isTelemetryEvent).length).toBeGreaterThan(150)
    expect(logV1.events.length).toBeGreaterThan(80)
  })

  it('stripping the stored v2 log reproduces the stored v1 file exactly', () => {
    const twin = strip(logV2.events).map((e, i) => ({ ...e, seq: asSeq(i + 1) }))
    expect(twin).toEqual(logV1.events)
  })

  it('fold state is bit-identical, lastSeq included, against the un-renumbered strip', () => {
    const bare = strip(logV2.events)
    const foldedV2 = foldLog(ctx, logV2.events)._unsafeUnwrap()
    const foldedBare = foldLog(ctx, bare)._unsafeUnwrap()
    expect(foldedV2).toEqual(foldedBare)
    expect(foldedV2.lastSeq).toBe(foldedBare.lastSeq)
  })

  it('metrics and both score versions match the v1 twin', () => {
    const foldedV1 = foldLog(ctx, logV1.events)._unsafeUnwrap()
    const end = foldedV1.finishedAt ?? logV1.events[logV1.events.length - 1].t
    expect(computeMetrics(ctx, logV2.events, end)).toEqual(computeMetrics(ctx, logV1.events, end))
    expect(scoreOfLog(logV2.events, ctx)).toEqual(scoreOfLog(logV1.events, ctx))
    const scoreCtx = { ...ctx, generation }
    expect(scoreV2OfLog(logV2.events, scoreCtx, declaration)).toEqual(
      scoreV2OfLog(logV1.events, scoreCtx, declaration)
    )
  })

  it('validateLog judges the pair identically, and agrees with the server that judged it', () => {
    const judge = (log: EventLog) =>
      validateLog({
        seed,
        dictionary,
        dictVersion: runV2.dictHash,
        configSnapshot,
        log
      })._unsafeUnwrap()

    const reportV2 = judge(logV2)
    const reportV1 = judge(logV1)
    expect(reportV2).toEqual(reportV1)

    // The stored row carries the verdict the Go worker reached on these very
    // bytes, through its vendored bundle of this same core. Same verdict, same
    // flags — a drift between the two would otherwise be invisible from here.
    expect(reportV2.verdict).toBe(runV2.serverValidation.verdict)
    expect(reportV2.flags).toEqual(runV2.serverValidation.flags)
  })

  /*
   * The pair above was chosen with `validation.flags` EMPTY, and that choice is
   * load-bearing: `validate.ts:165-189` raises the scored `unpaired-keyup` flag
   * off telemetry, so a v2 report can legitimately carry a flag its v1 twin
   * cannot, and "the same report" would be false for reasons that are not a bug.
   * Most real v2 runs in the dev database are of that kind — a key held from
   * before the log started — so the case is the common one, not the exotic one.
   *
   * The pair that covers it is deliberately NOT built yet: the assertion it
   * needs ("the two reports differ by exactly that one flag, and by nothing
   * else — same verdict, same metrics, same other flags") is only worth freezing
   * once the flag's weight is settled. It lives here as a skipped test rather
   * than as a README line so it stays in front of whoever runs the suite.
   */
  it.skip('a flagged v2 run differs from its v1 twin by exactly the unpaired-keyup flag', () => {
    // Waits on zeroing the unpaired-keyup weight in the server review policy (B7).
    expect.unreachable('fixture not built yet — see the note above this test')
  })

  it("recomputes the server's stored metrics from the v2 log", () => {
    const folded = foldLog(ctx, logV2.events)._unsafeUnwrap()
    const end = folded.finishedAt ?? logV2.events[logV2.events.length - 1].t
    const metrics = computeMetrics(ctx, logV2.events, end)
    expect(metrics.wpm).toBeCloseTo(runV2.serverMetrics.wpm, 6)
    expect(metrics.raw).toBeCloseTo(runV2.serverMetrics.raw, 6)
    expect(metrics.accuracy).toBeCloseTo(runV2.serverMetrics.accuracy, 6)
    expect(metrics.chars).toEqual(runV2.serverMetrics.chars)
    expect(metrics.spaces).toBe(runV2.serverMetrics.spaces)
  })
})
