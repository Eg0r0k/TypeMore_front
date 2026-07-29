/**
 * Where a finished run's TEXT came from, and what that costs it.
 *
 * This is the whole of the seeded-repeat rule, in one pure function, because the
 * alternative is what used to be here: the rule spelled inside `pages/home`'s
 * `finishedOk` computed and spelled AGAIN inside the test that guarded it — so
 * the test would have kept passing if the page had dropped the gate entirely
 * (`docs/AUDIT_STATE.md`, A9). A rule the guard restates is not guarded.
 *
 * THE RULE. A run is judged on its own metrics. Whether another caret was on
 * screen — a pace bot at your PB's speed, a ghost of somebody's record — and
 * whether you beat it are not inputs to anything: the run goes to history, to
 * its board, to the PB and to TP exactly as it would have with an empty field.
 * The single exception is a run whose TEXT was taken from another run, because
 * those words were knowable before the first keystroke.
 *
 * So the question is never "was there an opponent" but "was this text generated
 * for this run". `TextOrigin` below carries only what answers that.
 */

export interface TextOrigin {
  /**
   * The run whose setup this run is playing — the record race seats the target
   * run's exact words and seed. `null` when the words were drawn for this run.
   */
  readonly racedRunId: string | null
  /**
   * The player pressed "restart" on the results screen, so this run replays the
   * text they just read there in full.
   */
  readonly repeated: boolean
  /**
   * The targets are a FIXED PUBLISHED text — a quote. Read from the resolved
   * text source, not from a mode name.
   */
  readonly fixedText: boolean
}

/**
 * The run this run's text was adopted from, for `setup.adoptedFromRunId`, or
 * `undefined` when it was generated fresh.
 */
export const adoptedFromOf = (origin: TextOrigin): string | undefined =>
  origin.racedRunId ?? undefined

/**
 * True when the run must be WITHHELD from submission rather than submitted and
 * marked — the one case the marker cannot express.
 *
 * A solo repeat of a SEEDED text has no run id to name: the words came from the
 * player's own previous attempt, which may never have been submitted at all and
 * so may have no id anywhere. Submitting it unmarked would make it COUNT, which
 * is the one wrong answer, so it stays local until the marker can say "repeat,
 * no origin to name".
 *
 * A repeat of a QUOTE is not withheld, and that is a product decision rather
 * than an oversight: the player chose that quote, its board ranks precisely the
 * people who typed those same bytes, and typing it as often as you like is how
 * competing on it works. Every run on a quote board is a repeat of the same
 * text by construction — "pre-known" is the premise of the board, not a fault
 * in a run on it.
 */
export const isUnnameableRepeat = (origin: TextOrigin): boolean =>
  origin.repeated && !origin.fixedText && origin.racedRunId === null
