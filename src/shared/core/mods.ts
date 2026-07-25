/**
 * Mod multipliers (SCORING_CONCEPT.md §2) — pure, dependency-free like the rest
 * of the core (the server recomputes this via goja).
 *
 * Two classes of mod:
 *  - **verifiable** — DERIVED from the run's setup (GenerationConfig + CoreConfig):
 *    punctuation, numbers, randomCase, nospace, expert, master, reverse, minSpeed.
 *    The server reproduces them from the seed + config snapshot, so they cannot
 *    be forged.
 *  - **declared** — the view-only mods a client asserts it played under (blind,
 *    fading, flashlight). They leave no trace in the event log, so they are
 *    accepted ON TRUST. This is an acknowledged anti-cheat limitation; the
 *    declaration rides inside the run's setup payload (opaque jsonb server-side).
 *
 * The table is data (a const record), never an if-chain. Multipliers multiply;
 * the product is capped at `MOD_MULTIPLIER_CAP`.
 */
import type { CoreConfig } from './game-core'
import type { GenerationConfig } from './words'

/** The declared (view-only) mods, accepted on trust. Verifiable mods are NOT here. */
export interface ModsDeclaration {
  readonly blind: boolean
  readonly fading: boolean
  readonly flashlight: boolean
}

/** The setup a run's multiplier is derived from: generation flags + reducer config. */
export interface ModSetup {
  readonly generation: GenerationConfig
  readonly config: CoreConfig
}

/** One active mod in the breakdown: a stable id and its multiplier. */
export interface ActiveMod {
  readonly id: string
  readonly multiplier: number
}

/** Total mod multiplier ceiling (SCORING_CONCEPT.md §2). */
export const MOD_MULTIPLIER_CAP = 4.0

/** The SCORING_CONCEPT §2 table, as data. */
export const MOD_MULTIPLIERS = {
  punctuation: 1.1,
  numbers: 1.08,
  nospace: 1.12,
  randomCase: 1.15,
  expert: 1.15,
  master: 1.25,
  reverse: 1.25,
  blind: 1.3,
  fading: 1.35,
  flashlight: 1.4
} as const

/** MinSpeed multiplier keyed by the configured floor (SCORING_CONCEPT §2). */
export const MINSPEED_MULTIPLIERS: Record<number, number> = {
  60: 1.1,
  80: 1.25,
  100: 1.45
}

/**
 * The active mods for a run, in a stable order: verifiable (from the setup) then
 * declared (from the declaration). Pure — the results breakdown and
 * `modMultiplierV1` both read it, so the list and the product never disagree.
 */
export function activeModsV1(setup: ModSetup, declaration: ModsDeclaration): ActiveMod[] {
  const { generation: g, config: c } = setup
  const mods: ActiveMod[] = []
  const add = (id: string, on: boolean, multiplier: number): void => {
    if (on) mods.push({ id, multiplier })
  }
  // Verifiable — reproduced from seed + config snapshot server-side.
  add('punctuation', g.punctuation, MOD_MULTIPLIERS.punctuation)
  add('numbers', g.numbers, MOD_MULTIPLIERS.numbers)
  add('randomCase', g.randomCase, MOD_MULTIPLIERS.randomCase)
  add('nospace', c.nospace, MOD_MULTIPLIERS.nospace)
  add('expert', c.difficulty === 'expert', MOD_MULTIPLIERS.expert)
  add('master', c.difficulty === 'master', MOD_MULTIPLIERS.master)
  add('reverse', g.reverse, MOD_MULTIPLIERS.reverse)
  if (c.minWpm > 0 && MINSPEED_MULTIPLIERS[c.minWpm] !== undefined) {
    mods.push({ id: `minSpeed${c.minWpm}`, multiplier: MINSPEED_MULTIPLIERS[c.minWpm] })
  }
  // Declared — accepted on trust.
  add('blind', declaration.blind, MOD_MULTIPLIERS.blind)
  add('fading', declaration.fading, MOD_MULTIPLIERS.fading)
  add('flashlight', declaration.flashlight, MOD_MULTIPLIERS.flashlight)
  return mods
}

/**
 * The combined mod multiplier: the product of every active mod's factor, capped
 * at `MOD_MULTIPLIER_CAP`. With no active mods the product is exactly 1.0 — the
 * property that makes scoreV2 collapse onto scoreV1 (`score.test.ts`).
 */
export function modMultiplierV1(setup: ModSetup, declaration: ModsDeclaration): number {
  const product = activeModsV1(setup, declaration).reduce((acc, mod) => acc * mod.multiplier, 1)
  return Math.min(product, MOD_MULTIPLIER_CAP)
}
