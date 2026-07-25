/**
 * Public-replay reconstruction. Maps the server's replay pair plus the run's
 * dictionary body onto the core's `ReplayData`, exactly as
 * `TypeMore_back/docs/LEADERBOARDS.md` §"GET /api/v1/runs/{id}/replay"
 * documents them. This is the READ-direction twin of `build-payload.ts`: that
 * file is the one place a finished run becomes a wire payload, this is the one
 * place a wire payload becomes a playable run, and both are contract-drift
 * boundaries their tests guard field for field.
 *
 * Field-for-field (ReplayData ← source):
 *   config      ← meta.setup.config       (the reducer snapshot AS PLAYED, never the viewer's)
 *   words       ← generateWords(dict, makeSeedContext(dict, meta.seed, setup.generation))
 *                 REGENERATED, not transmitted: the wire carries `seed` + `dictHash`
 *                 and the client owns the generator (LEADERBOARDS.md, "no word list either")
 *   log         ← log.events              (the `…/replay/log` body; envelope already validated)
 *   generation  ← meta.setup.generation   (verifiable-mod half; also the seed context)
 *   declaration ← meta.setup.declaration  (trusted view-only half: blind/fading/flashlight)
 *   score       ← meta.serverScore        (the SERVER's judgement, never a recomputation)
 *   grade       ← meta.grade              (likewise the server's)
 *
 * Not mapped: `meta.serverMetrics` (the player renders its own from the log),
 * `meta.displayName` / `meta.achievedAt` (chrome the page owns, not playback),
 * `meta.mode` / `durationMs` / `wordCount` / `lang` (all redundant with
 * `setup.config` + `setup.generation`, which are what the reducer reads).
 *
 * Everything the wire types as `unknown` — `setup`, `serverScore` — is narrowed
 * by a valibot schema below and fails LOUDLY. A bare `as` cast here would let a
 * contract change reach the reducer as a half-built `ReplayData` and surface as
 * an inscrutable playback bug instead of a named error.
 */
import { Result, err, ok } from 'neverthrow'
import * as v from 'valibot'

import {
  dictVersion,
  generateWords,
  makeSeedContext,
  type Dictionary,
  type GameEvent
} from '@shared/core'
import type { ReplayData } from '@entities/game'
import type { DictionaryBody, RunReplay, RunReplayLog } from '@shared/api'

/**
 * Why the reconstruction failed. Each variant is a DIFFERENT thing for the
 * viewer to be told and a different thing to offer them, so they stay apart:
 * a hash mismatch is unfixable by retrying, a generation failure is a bad
 * snapshot, and a malformed field is contract drift.
 */
export type ReplayFromApiErrorKind =
  'DictHashMismatch' | 'MalformedSetup' | 'MalformedScore' | 'MalformedGrade' | 'GenerationFailed'

/** Same shape as the core's `WordsError`: a machine-readable kind + a human line. */
export interface ReplayFromApiError {
  readonly kind: ReplayFromApiErrorKind
  readonly message: string
}

// ── Boundary schemas ─────────────────────────────────────────────────────────
// `looseObject`, not `object`: `CoreConfig` and `GenerationConfig` are
// serialized verbatim into the run payload and every field added to them since
// has been OPTIONAL with a legacy default (see their declarations). A snapshot
// written by a NEWER client must therefore survive this parse with its unknown
// fields intact — `object` would silently strip them and rebuild an older,
// different run.

const GenerationModeSchema = v.picklist(['words', 'time', 'quote', 'free', 'custom'])

const CoreConfigSchema = v.looseObject({
  mode: GenerationModeSchema,
  durationMs: v.number(),
  maxExtraChars: v.number(),
  difficulty: v.picklist(['normal', 'expert', 'master']),
  nospace: v.boolean(),
  minWpm: v.number(),
  startPolicy: v.optional(v.picklist(['input', 'go'])),
  freedomMode: v.optional(v.boolean()),
  stopOnError: v.optional(v.picklist(['off', 'word', 'letter'])),
  quickEnd: v.optional(v.boolean())
})

const GenerationConfigSchema = v.looseObject({
  mode: GenerationModeSchema,
  length: v.number(),
  punctuation: v.boolean(),
  numbers: v.boolean(),
  randomCase: v.boolean(),
  reverse: v.boolean(),
  rawTokens: v.optional(v.boolean())
})

const ModsDeclarationSchema = v.looseObject({
  blind: v.boolean(),
  fading: v.boolean(),
  flashlight: v.boolean()
})

/** `setup` as `build-payload.ts` writes it: the replayable snapshot, all three halves. */
const SetupSchema = v.looseObject({
  config: CoreConfigSchema,
  generation: GenerationConfigSchema,
  declaration: ModsDeclarationSchema
})

const ScoreResultSchema = v.looseObject({
  version: v.number(),
  total: v.number(),
  base: v.number(),
  comboPeak: v.number(),
  accMultiplier: v.number(),
  timeBonus: v.nullable(v.number()),
  modMultiplier: v.optional(v.number())
})

const GradeSchema = v.picklist(['SS', 'S', 'A', 'B', 'C'])

/** One readable line out of a failed parse — path and reason, not a dumped tree. */
const explain = (issues: [v.BaseIssue<unknown>, ...v.BaseIssue<unknown>[]]): string =>
  v.summarize(issues)

export function replayFromApi(
  meta: RunReplay,
  log: RunReplayLog,
  dict: DictionaryBody
): Result<ReplayData, ReplayFromApiError> {
  // FIRST, before anything is trusted. The dictionary is fetched by content
  // hash, so this should always hold — but if it ever does not, the words we
  // regenerate below would differ from the ones the player actually typed and
  // the replay would be a plausible lie rather than an obvious failure. Same
  // check the live match path makes before it trusts a regenerated word.
  const actualHash = dictVersion(dict.words)
  if (actualHash !== meta.dictHash) {
    return err({
      kind: 'DictHashMismatch',
      message: `dictionary "${dict.name}" hashes to ${actualHash}, run ${meta.runId} was played on ${meta.dictHash}`
    })
  }

  const setup = v.safeParse(SetupSchema, meta.setup)
  if (!setup.success) {
    return err({
      kind: 'MalformedSetup',
      message: `run setup is unusable: ${explain(setup.issues)}`
    })
  }

  const score = v.safeParse(ScoreResultSchema, meta.serverScore)
  if (!score.success) {
    return err({
      kind: 'MalformedScore',
      message: `server score is unusable: ${explain(score.issues)}`
    })
  }

  const grade = v.safeParse(GradeSchema, meta.grade)
  if (!grade.success) {
    return err({
      kind: 'MalformedGrade',
      message: `server grade is unusable: ${explain(grade.issues)}`
    })
  }

  const { config, generation, declaration } = setup.output

  // `generateWords` reads only `name` and `words`; `bcp47` is dictionary chrome
  // the body may omit, and it never reaches the PRNG.
  const dictionary: Dictionary = {
    name: dict.name,
    bcp47: dict.bcp47 ?? '',
    words: dict.words
  }
  const generated = generateWords(dictionary, makeSeedContext(dictionary, meta.seed, generation))
  if (generated.isErr()) {
    return err({
      kind: 'GenerationFailed',
      message: `word generation failed: ${generated.error.kind} — ${generated.error.message}`
    })
  }

  return ok({
    config,
    words: generated.value.words,
    // THE ONE PLACE the event log crosses from `unknown[]` into the core's type.
    // The api layer validated the ENVELOPE (`{ version, events }`) and stops
    // there on purpose: the events are the core's `GameEvent` union, and the
    // core's reducer is what validates them — re-describing that union as a
    // valibot schema would be a second copy of the event contract to keep in
    // step. A malformed event surfaces as a reducer error during playback,
    // which is where it belongs.
    log: log.events as readonly GameEvent[],
    generation,
    declaration,
    score: score.output,
    grade: grade.output
  })
}
