import { describe, expect, it } from 'vitest'

import {
  adoptedFromOf,
  isUnnameableRepeat,
  type TextOrigin
} from '@/features/run-submit/model/text-origin'

/**
 * The seeded-repeat rule, guarded at its ONE home.
 *
 * This file replaces `race-no-submission.test.ts`, which asserted the opposite
 * ("a race run must never reach POST /runs") and asserted it by restating the
 * page's gate inside the test — so it would have stayed green if the page had
 * dropped the gate entirely (`docs/AUDIT_STATE.md`, A9). The rule now lives in
 * `features/run-submit/model/text-origin.ts`; `pages/home` calls it, and this
 * exercises the same function the page does.
 *
 * WHAT CHANGED AND WHY. A race run is no longer withheld. It is submitted,
 * marked with the run its text came from, saved, judged, shown in history — and
 * ranked nowhere (RUNS.md, "Text provenance"). Withholding it was the same
 * verdict with the run thrown away, and it gated on the wrong thing: the rule
 * is about where the TEXT came from, not about whether a second caret was on
 * screen.
 */

const origin = (over: Partial<TextOrigin> = {}): TextOrigin => ({
  racedRunId: null,
  repeated: false,
  fixedText: false,
  ...over
})

describe('adoptedFromOf — the marker names the run the text came from', () => {
  it('is absent for a freshly generated run', () => {
    expect(adoptedFromOf(origin())).toBeUndefined()
  })

  it('names the raced run while a record race is live', () => {
    expect(adoptedFromOf(origin({ racedRunId: 'run-ada' }))).toBe('run-ada')
  })

  /**
   * The load-bearing negative. A pace caret — including one running at the
   * player's own PB over words drawn seconds ago — leaves no trace here,
   * because "is there an opponent" is not a question this rule asks. There is
   * no field on `TextOrigin` that could carry the answer, which is the point.
   */
  it('is absent for a fresh run no matter what is drawn over it', () => {
    expect(adoptedFromOf(origin({ repeated: false }))).toBeUndefined()
    expect(adoptedFromOf(origin({ fixedText: true }))).toBeUndefined()
  })
})

describe('isUnnameableRepeat — the one case the marker cannot express', () => {
  it('lets a fresh run through', () => {
    expect(isUnnameableRepeat(origin())).toBe(false)
  })

  it('lets a race through — it HAS an origin to name', () => {
    expect(isUnnameableRepeat(origin({ racedRunId: 'run-ada', repeated: true }))).toBe(false)
  })

  /**
   * A solo repeat of a seeded text: the words came from the player's own
   * previous attempt, which may never have been submitted and so may have no id
   * anywhere. Submitting it unmarked would make it COUNT — the one wrong
   * answer — so it stays local.
   */
  it('withholds a solo repeat of a seeded text', () => {
    expect(isUnnameableRepeat(origin({ repeated: true }))).toBe(true)
  })

  /**
   * A repeat of a QUOTE is not withheld. Every run on a quote board types the
   * same bytes by construction — that is the premise of the board, not a fault
   * in a run on it — and the player chose the quote themselves.
   */
  it('lets a repeated quote run through', () => {
    expect(isUnnameableRepeat(origin({ repeated: true, fixedText: true }))).toBe(false)
  })
})
