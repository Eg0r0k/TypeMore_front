/** Layer 1 — Auth request payloads. Plain shapes: only responses are parsed. */

/** OAuth / linking providers. */
export type OAuthProvider = 'github' | 'google'

/**
 * `turnstileToken` rides the three abuse-prone endpoints (register, password
 * reset request, verification resend). It is OMITTED entirely when the site
 * key is unset, which is the backend's disabled mode too.
 */
export interface RegisterInput {
  email: string
  password: string
  /** Omitted → server defaults to the email local-part. */
  name?: string
  turnstileToken?: string
}
export interface LoginInput {
  email: string
  password: string
}
export interface VerifyInput {
  token: string
}
export interface ResendVerificationInput {
  email: string
  turnstileToken?: string
}
export interface PasswordResetRequestInput {
  email: string
  turnstileToken?: string
}
export interface PasswordResetConfirmInput {
  token: string
  password: string
}
export interface EmailAddInput {
  email: string
}
export interface PasswordSetInput {
  password: string
}
/**
 * PATCH /me/settings — a PARTIAL body by contract: each switch moves only when
 * present, so flipping one never races (or has to know) the other.
 */
export interface SettingsInput {
  profilePublic?: boolean
  keyboardPublic?: boolean
}
