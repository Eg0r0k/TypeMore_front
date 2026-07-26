import * as v from 'valibot'
import { isApiError } from '@shared/api'
import { isCaptchaEnabled } from './config'

/** What `<TurnstileField>` exposes to the form that owns it. */
export interface TurnstileFieldExpose {
  /** Discards the current token and asks Turnstile for a fresh challenge. */
  reset: () => void
}

/**
 * The token as a regular vee-validate field, so the captcha rides the form's
 * EXISTING validation rather than a parallel gate beside it.
 *
 * Enabled ⇒ an empty token fails the schema, which is precisely what keeps
 * submit blocked until the widget hands one over. Disabled ⇒ the field is
 * optional and always valid, so the form validates exactly as it did before.
 */
export const captchaTokenSchema = (message: string): v.GenericSchema<string | undefined, string> =>
  isCaptchaEnabled()
    ? v.pipe(v.optional(v.string(message), ''), v.nonEmpty(message))
    : v.optional(v.string(message), '')

/**
 * The request-body fragment carrying the token. Disabled ⇒ empty, so the JSON
 * is byte-identical to the pre-Turnstile payload — the mirror of the backend
 * refusing to look at the field when its secret is unset.
 */
export const captchaBody = (token: string | undefined): { turnstileToken?: string } =>
  isCaptchaEnabled() ? { turnstileToken: token ?? '' } : {}

/**
 * `captcha_required` should be unreachable from a healthy UI — the schema
 * above blocks an empty token — but a stale bundle or a widget that expired
 * mid-flight can still provoke it, and the cure is identical: a spent Turnstile
 * token is single-use, so any retry MUST start from a reset widget.
 */
export const isCaptchaError = (error: unknown): boolean =>
  isApiError(error) && (error.code === 'captcha_failed' || error.code === 'captcha_required')
