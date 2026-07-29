/**
 * Public API of the run-submit feature. Consumers (the home page) import ONLY
 * from here. Wires the game finish surface to S1's run-submit mutation.
 */
export { useRunSubmission } from './model/use-run-submission'
export type { UseRunSubmissionOptions, RunSubmission } from './model/use-run-submission'
export type { SubmitState } from './model/submit-flow'
export { buildRunPayload, isSubmittableRun, SCORE_VERSION } from './model/build-payload'
export type { RunSubmitContext } from './model/build-payload'
export { adoptedFromOf, isUnnameableRepeat } from './model/text-origin'
export type { TextOrigin } from './model/text-origin'
export { bumpRestarts, clearRestarts, peekRestarts, MAX_RESTARTS } from './model/restart-counter'
