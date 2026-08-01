<template>
  <AuthLayout :title="t('auth.callback.title')">
    <Typography v-if="state === 'pending'" color="primary" size="s" role="status">
      {{ t('auth.callback.pending') }}
    </Typography>
    <Typography v-else color="error" size="s" role="alert">
      {{ t('auth.callback.failed') }}
    </Typography>

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
  import { authKeys, meQueryOptions } from '@shared/api'
  import { useAuthStore } from '@/entities/auth'
  import { routeLocation } from '@/shared/router'

  const { t } = useI18n()
  const route = useRoute()
  const router = useRouter()
  const authStore = useAuthStore()
  const queryClient = useQueryClient()

  type CallbackState = 'pending' | 'failed'
  const state = ref<CallbackState>('pending')

  // The backend completes the OAuth flow with a full-page redirect to
  // `/auth/callback?status=ok` (the session cookie is already set). We confirm
  // the session by refetching `/me`, mirror the outcome onto the auth store, then
  // send the user home. Any non-`ok` status or a failed `/me` falls back to an
  // error with a link back to login.
  onMounted(async () => {
    const raw = route.query.status
    const status = Array.isArray(raw) ? raw[0] : raw
    if (status !== 'ok') {
      authStore.setGuest()
      state.value = 'failed'
      return
    }
    try {
      await queryClient.invalidateQueries({ queryKey: authKeys.me() })
      await queryClient.ensureQueryData(meQueryOptions())
      authStore.setAuthed()
      await router.replace(routeLocation.home())
    } catch {
      authStore.setGuest()
      state.value = 'failed'
    }
  })
</script>
