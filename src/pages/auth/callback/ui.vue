<template>
  <div class="auth__wrapper">
    <div class="auth">
      <div class="auth__header">
        <Typography color="main" tag-name="h2" size="xl">{{ t('auth.callback.title') }}</Typography>
      </div>

      <Typography v-if="state === 'pending'" color="primary" size="s" role="status">
        {{ t('auth.callback.pending') }}
      </Typography>
      <Typography v-else color="error" size="s" role="alert">
        {{ t('auth.callback.failed') }}
      </Typography>

      <Typography v-if="state === 'failed'" tag-name="p" color="sub" size="xs">
        <RouterLink class="auth__link" :to="routeLocation.login()">
          {{ t('auth.callback.toLogin') }}
        </RouterLink>
      </Typography>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, ref } from 'vue'
  import { RouterLink, useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { useQueryClient } from '@tanstack/vue-query'
  import { Typography } from '@shared/ui/typography'
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

<style scoped lang="scss">
  .auth {
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: min(360px, 100%);
    margin: 0 auto;
    text-align: center;

    &__wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
    }

    &__link {
      color: var(--main-color);
      text-decoration: underline;
      text-decoration-thickness: from-font;
      text-underline-position: from-font;
    }
  }
</style>
