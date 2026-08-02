import { isApiError } from '@shared/api'

/**
 * The server's auth error CODES, mapped to what a person should be told.
 *
 * Every auth endpoint answers with `{"error": "<code>", "message": "..."}` and a
 * redirect-based OAuth flow answers with `?error=<code>` — the same vocabulary
 * either way (BACKEND: `internal/auth/errors.go`, `oauth.go`). The screens used
 * to each recognise a handful of codes inline and fall through everything else
 * to "please try again", which is how a 409 saying *this email already has an
 * account* reached the reader as *something went wrong, try later*: an answer
 * that is not only unhelpful but WRONG, because retrying cannot work.
 *
 * So the table lives in one place and is keyed by the code the server actually
 * sends. A code that is missing here still falls back — a fallback is the
 * correct behaviour for an unknown code, and the wrong behaviour for a known
 * one.
 *
 * The server's own English `message` is deliberately NOT shown: it is a
 * developer-facing string in one language, and this app is translated.
 */
const AUTH_ERROR_KEYS: Readonly<Record<string, string>> = {
  // ── OAuth redirect outcomes ───────────────────────────────────────────────
  account_exists_use_linking: 'auth.error.accountExistsUseLinking',
  provider_already_linked: 'auth.error.providerAlreadyLinked',
  // The state cookie is gone or does not match: an expired attempt, a browser
  // that dropped the cookie, or a forged callback. All three mean "start over".
  invalid_state: 'auth.error.invalidState',
  oauth_denied: 'auth.error.oauthDenied',
  oauth_exchange_failed: 'auth.error.oauthFailed',
  oauth_userinfo_failed: 'auth.error.oauthFailed',
  unknown_provider: 'auth.error.unknownProvider',

  // ── Credentials and account state ─────────────────────────────────────────
  invalid_credentials: 'auth.error.invalidCredentials',
  email_not_verified: 'auth.error.emailNotVerified',
  name_taken: 'auth.error.nameTaken',
  invalid_token: 'auth.error.invalidToken',
  email_already_set: 'auth.error.emailAlreadySet',
  password_already_set: 'auth.error.passwordAlreadySet',
  no_verified_email: 'auth.error.noVerifiedEmail',

  // ── Gates ─────────────────────────────────────────────────────────────────
  captcha_required: 'auth.captcha.required',
  captcha_failed: 'auth.captcha.failed',
  rate_limited: 'auth.error.rateLimited',
  // 503, not 429: the server is at hashing capacity, so retrying really does
  // work — which is the opposite of what most of this table has to say.
  overloaded: 'auth.error.overloaded',
  forbidden_origin: 'auth.error.forbiddenOrigin',
  unauthorized: 'auth.error.unauthorized',
  bad_request: 'auth.error.badRequest',
  internal: 'auth.error.internal'
}

/** Whether the code is one this app has words for. */
export const isKnownAuthError = (code: string | null | undefined): boolean =>
  typeof code === 'string' && code in AUTH_ERROR_KEYS

/**
 * The i18n key for a server error code, or `fallback` when the code is unknown
 * (or absent). The fallback belongs to the CALLER, because "we could not sign
 * you in" and "we could not create your account" are different sentences.
 */
export const authErrorKey = (code: string | null | undefined, fallback: string): string =>
  typeof code === 'string' ? (AUTH_ERROR_KEYS[code] ?? fallback) : fallback

/** {@link authErrorKey} for a caught API error — anything else takes the fallback. */
export const apiErrorKey = (error: unknown, fallback: string): string =>
  isApiError(error) ? authErrorKey(error.code, fallback) : fallback
