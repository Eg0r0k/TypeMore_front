/**
 * The auth screens speak the SERVER's error vocabulary.
 *
 * Every auth endpoint answers `{"error": "<code>"}` and the OAuth flow redirects
 * with `?error=<code>`; the screens used to recognise a few inline and fall
 * through the rest to "please try again", which is how a 409 meaning *this email
 * already has an account* reached the reader as *try later* — advice that could
 * not work.
 *
 * `BACKEND_CODES` is this repo's copy of `internal/auth/errors.go` +
 * `oauth.go`'s `redirectResult` calls. If the backend adds a code, adding it
 * here is what fails the build until it has words in both locales.
 */
import { describe, expect, it } from 'vitest'

import { authErrorKey, isKnownAuthError } from '@/entities/auth/model/errors'
import en from '@/app/i18n/locales/en'
import ru from '@/app/i18n/locales/ru'

/** Every code a client can receive from the auth service. */
const BACKEND_CODES = [
  // errors.go
  'invalid_token',
  'invalid_credentials',
  'email_not_verified',
  'rate_limited',
  'unauthorized',
  'forbidden_origin',
  'unknown_provider',
  'internal',
  'name_taken',
  'account_exists_use_linking',
  'email_already_set',
  'no_verified_email',
  'password_already_set',
  'overloaded',
  'captcha_required',
  'captcha_failed',
  'bad_request',
  // oauth.go redirectResult
  'invalid_state',
  'oauth_denied',
  'oauth_exchange_failed',
  'oauth_userinfo_failed',
  'provider_already_linked'
] as const

/** Walks a dotted i18n key, returning the leaf string or `undefined`. */
const lookup = (bundle: unknown, key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[part] : undefined,
      bundle
    )

describe('auth error codes', () => {
  it('has a message for every code the backend can send', () => {
    const unmapped = BACKEND_CODES.filter((code) => !isKnownAuthError(code))
    expect(unmapped).toEqual([])
  })

  it('resolves each of those messages in every locale', () => {
    for (const code of BACKEND_CODES) {
      const key = authErrorKey(code, 'FALLBACK')
      expect(key, code).not.toBe('FALLBACK')
      expect(typeof lookup(en, key), `${code} → ${key} (en)`).toBe('string')
      expect(typeof lookup(ru, key), `${code} → ${key} (ru)`).toBe('string')
    }
  })

  it('names the conflict a retry cannot fix', () => {
    // The reported bug: this one used to render as "please try again".
    const key = authErrorKey('account_exists_use_linking', 'FALLBACK')
    expect(key).toBe('auth.error.accountExistsUseLinking')
    expect(String(lookup(en, key))).toMatch(/already belongs to an account/i)
  })

  it('falls back for a code it does not know, and for none at all', () => {
    expect(authErrorKey('teapot', 'auth.error.generic')).toBe('auth.error.generic')
    expect(authErrorKey(null, 'auth.error.generic')).toBe('auth.error.generic')
    expect(authErrorKey(undefined, 'auth.error.generic')).toBe('auth.error.generic')
    expect(isKnownAuthError('teapot')).toBe(false)
    expect(isKnownAuthError(null)).toBe(false)
  })
})
