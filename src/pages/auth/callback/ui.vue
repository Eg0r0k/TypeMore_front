<template>
  <AuthLayout
    :title="state === 'pending' ? t('auth.callback.title') : t('auth.callback.failedTitle')"
  >
    <Typography v-if="state === 'pending'" color="primary" size="s" role="status">
      {{ t('auth.callback.pending') }}
    </Typography>

    <div v-else class="flex flex-col items-center gap-1.5 text-center">
      <Typography color="error" size="s" role="alert" data-testid="callback-error">
        {{ t(messageKey) }}
      </Typography>
      <Typography v-if="errorCode" color="sub" size="xs" data-testid="callback-code">
        {{ t('auth.error.code', { code: errorCode }) }}
      </Typography>
    </div>

    <template v-if="state === 'failed'" #footer>
      <Typography tag-name="p" color="sub" size="xs">
        <Link class="link-main" :to="routeLocation.login()">
          {{ t('auth.callback.toLogin') }}
        </Link>
      </Typography>
    </template>
  </AuthLayout>
</template>

<script setup lang="ts">
  import { onMounted, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { useQueryClient } from '@tanstack/vue-query'
  import { Typography } from '@shared/ui/typography'
  import { Link } from '@shared/ui/link'
  import { AuthLayout } from '@/features/layouts/auth'
  import { authKeys, isApiError, meQueryOptions } from '@shared/api'
  import { authErrorKey, useAuthStore } from '@/entities/auth'
  import { routeLocation } from '@/shared/router'

  const { t } = useI18n()
  const route = useRoute()
  const router = useRouter()
  const authStore = useAuthStore()
  const queryClient = useQueryClient()

  /** What an unrecognised (or absent) code falls back to on THIS screen. */
  const FAILED = 'auth.callback.failed'

  type CallbackState = 'pending' | 'failed'
  const state = ref<CallbackState>('pending')

  /** The server's own code, kept so the page can name what actually happened. */
  const errorCode = ref<string | null>(null)
  const messageKey = ref(FAILED)

  /** A repeated query parameter is a caller we do not recognise; take the first. */
  function param(name: string): string | null {
    const raw = route.query[name]
    const value = Array.isArray(raw) ? raw[0] : raw
    return typeof value === 'string' && value !== '' ? value : null
  }

  function fail(code: string | null): void {
    errorCode.value = code
    messageKey.value = authErrorKey(code, FAILED)
    authStore.setGuest()
    state.value = 'failed'
  }

  /**
   * Where the OAuth flow lands. The backend finishes with a full-page redirect
   * to `/auth/callback` carrying exactly one outcome (BACKEND `oauth.go`,
   * `redirectResult`):
   *
   *  - `?status=ok`      — signed in, session cookie already set;
   *  - `?linked=<name>`  — a provider was attached to the signed-in account;
   *  - `?error=<code>`   — everything else, named.
   *
   * That last one is the whole point of this page and it used to be thrown
   * away: every failure, including `account_exists_use_linking` (this email
   * already has an account — a thing NO retry can fix), rendered the same
   * "sign-in could not be completed, please try again". The code is now
   * translated through the shared table and shown verbatim underneath.
   */
  onMounted(async () => {
    const error = param('error')
    if (error !== null) {
      fail(error)
      return
    }

    // A completed link flow: the session is the one the user already had, so
    // there is nothing to confirm — but it is a SUCCESS, and falling through to
    // the `status !== 'ok'` branch below would have called it a failure.
    if (param('linked') !== null) {
      authStore.setAuthed()
      await router.replace(routeLocation.home())
      return
    }

    if (param('status') !== 'ok') {
      // No recognised parameter at all: someone opened this URL directly, or a
      // redirect was truncated. There is no code to name.
      fail(null)
      return
    }

    try {
      // The cookie is set; `/me` is what proves it reached this browser.
      await queryClient.invalidateQueries({ queryKey: authKeys.me() })
      await queryClient.ensureQueryData(meQueryOptions())
      authStore.setAuthed()
      await router.replace(routeLocation.home())
    } catch (cause) {
      fail(isApiError(cause) ? cause.code : null)
    }
  })
</script>
