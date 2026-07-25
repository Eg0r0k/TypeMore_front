/** Auth domain — public surface. Endpoint functions stay internal except the
 * OAuth redirect URL builder, which is not a fetch. */
export { authKeys } from './keys'
export { meQueryOptions } from './queries'
export { oauthStartUrl } from './endpoints'
export {
  useLoginMutation,
  useLogoutMutation,
  useVerifyMutation,
  useRegisterMutation,
  useResendVerificationMutation,
  usePasswordResetRequestMutation,
  usePasswordResetConfirmMutation,
  useEmailAddMutation,
  usePasswordSetMutation,
  useLinkStartMutation
} from './mutations'

export type { User, LinkStart } from './schemas'
export type {
  OAuthProvider,
  RegisterInput,
  LoginInput,
  VerifyInput,
  ResendVerificationInput,
  PasswordResetRequestInput,
  PasswordResetConfirmInput,
  EmailAddInput,
  PasswordSetInput
} from './types'
