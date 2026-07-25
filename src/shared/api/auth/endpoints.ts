import { NoContentSchema, apiBase, request } from '../transport'
import { LinkStartSchema, UserSchema, type LinkStart, type User } from './schemas'
import type {
  EmailAddInput,
  LoginInput,
  OAuthProvider,
  PasswordResetConfirmInput,
  PasswordResetRequestInput,
  PasswordSetInput,
  RegisterInput,
  ResendVerificationInput,
  VerifyInput
} from './types'

/**
 * Layer 1 — Typed auth endpoints mirroring the backend's `docs/AUTH.md`. Each
 * returns a parsed, validated payload; the server-state layer wraps these, so
 * components never call them directly.
 */

export const register = async (input: RegisterInput): Promise<void> => {
  await request('/auth/register', NoContentSchema, { method: 'POST', body: input })
}

export const verify = async (input: VerifyInput): Promise<void> => {
  await request('/auth/verify', NoContentSchema, { method: 'POST', body: input })
}

export const resendVerification = async (input: ResendVerificationInput): Promise<void> => {
  await request('/auth/verify/resend', NoContentSchema, { method: 'POST', body: input })
}

export const login = async (input: LoginInput): Promise<void> => {
  await request('/auth/login', NoContentSchema, { method: 'POST', body: input })
}

export const logout = async (): Promise<void> => {
  await request('/auth/logout', NoContentSchema, { method: 'POST' })
}

export const passwordResetRequest = async (input: PasswordResetRequestInput): Promise<void> => {
  await request('/auth/password-reset/request', NoContentSchema, { method: 'POST', body: input })
}

export const passwordResetConfirm = async (input: PasswordResetConfirmInput): Promise<void> => {
  await request('/auth/password-reset/confirm', NoContentSchema, { method: 'POST', body: input })
}

export const emailAdd = async (input: EmailAddInput): Promise<void> => {
  await request('/auth/email/add', NoContentSchema, { method: 'POST', body: input })
}

export const passwordSet = async (input: PasswordSetInput): Promise<void> => {
  await request('/auth/password/set', NoContentSchema, { method: 'POST', body: input })
}

export const me = (): Promise<User> => request('/me', UserSchema)

export const linkStart = (provider: OAuthProvider): Promise<LinkStart> =>
  request(`/auth/link/${provider}/start`, LinkStartSchema, { method: 'POST' })

/**
 * Absolute URL to begin an OAuth flow. This is a full-page redirect (the browser
 * navigates), not a fetch — so it returns a URL string built from the API base.
 */
export const oauthStartUrl = (provider: OAuthProvider): string =>
  `${apiBase()}/auth/oauth/${provider}/start`
