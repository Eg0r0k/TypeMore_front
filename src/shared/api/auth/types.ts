/** Layer 1 — Auth request payloads. Plain shapes: only responses are parsed. */

/** OAuth / linking providers. */
export type OAuthProvider = 'github' | 'google'

export interface RegisterInput {
  email: string
  password: string
  /** Omitted → server defaults to the email local-part. */
  name?: string
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
}
export interface PasswordResetRequestInput {
  email: string
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
