import { useMutation, useQueryClient } from '@tanstack/vue-query'
import {
  changeDisplayName,
  emailAdd,
  linkStart,
  login,
  logout,
  passwordResetConfirm,
  passwordResetRequest,
  passwordSet,
  register,
  resendVerification,
  updateSettings,
  verify
} from './endpoints'
import { authKeys } from './keys'
import type {
  DisplayNameInput,
  EmailAddInput,
  LoginInput,
  OAuthProvider,
  PasswordResetConfirmInput,
  PasswordResetRequestInput,
  PasswordSetInput,
  RegisterInput,
  ResendVerificationInput,
  SettingsInput,
  VerifyInput
} from './types'

/**
 * Layer 2 — useMutation wrappers. The only way components mutate auth state.
 * Anything that changes the session invalidates `me`.
 */

export const useLoginMutation = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: LoginInput) => login(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.me() })
  })
}

export const useLogoutMutation = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => logout(),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.me() })
  })
}

export const useVerifyMutation = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: VerifyInput) => verify(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.me() })
  })
}

export const useRegisterMutation = () =>
  useMutation({ mutationFn: (input: RegisterInput) => register(input) })

export const useResendVerificationMutation = () =>
  useMutation({ mutationFn: (input: ResendVerificationInput) => resendVerification(input) })

export const usePasswordResetRequestMutation = () =>
  useMutation({ mutationFn: (input: PasswordResetRequestInput) => passwordResetRequest(input) })

export const usePasswordResetConfirmMutation = () => {
  const qc = useQueryClient()
  return useMutation({
    // Confirm revokes all sessions server-side, so any cached `me` is stale.
    mutationFn: (input: PasswordResetConfirmInput) => passwordResetConfirm(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.me() })
  })
}

export const useEmailAddMutation = () =>
  useMutation({ mutationFn: (input: EmailAddInput) => emailAdd(input) })

export const usePasswordSetMutation = () =>
  useMutation({ mutationFn: (input: PasswordSetInput) => passwordSet(input) })

export const useLinkStartMutation = () =>
  useMutation({ mutationFn: (provider: OAuthProvider) => linkStart(provider) })

/**
 * The privacy switches. The response IS the fresh user view, so it is written
 * straight into the `me` cache — no refetch round-trip for a state the server
 * just told us.
 */
export const useUpdateSettingsMutation = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SettingsInput) => updateSettings(input),
    onSuccess: (user) => qc.setQueryData(authKeys.me(), user)
  })
}

export const useChangeDisplayNameMutation = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: DisplayNameInput) => changeDisplayName(input),
    onSuccess: (user) => {
      qc.setQueryData(authKeys.me(), user)
      // A rename touches everything that carries the name — the profile
      // summary, board rows, the header. Once a month is cheap enough to just
      // refetch the world.
      void qc.invalidateQueries()
    }
  })
}
