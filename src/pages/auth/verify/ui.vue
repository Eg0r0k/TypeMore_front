<template>
  <div class="auth__wrapper">
    <div class="auth">
      <div class="auth__header">
        <Typography color="main" tag-name="h2" size="xl">{{ t('auth.verify.title') }}</Typography>
      </div>

      <Typography v-if="state === 'pending'" color="primary" size="s" role="status">
        {{ t('auth.verify.pending') }}
      </Typography>
      <Typography v-else-if="state === 'success'" color="primary" size="s" role="status">
        {{ t('auth.verify.success') }}
      </Typography>
      <Typography v-else-if="state === 'missing'" color="error" size="s" role="alert">
        {{ t('auth.verify.missingToken') }}
      </Typography>
      <Typography v-else color="error" size="s" role="alert">
        {{ t('auth.verify.failed') }}
      </Typography>

      <RouterLink v-if="state !== 'pending'" class="auth__link" :to="routeLocation.login()">
        <Typography color="sub" size="xs">{{ t('auth.verify.toLogin') }}</Typography>
      </RouterLink>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, ref } from 'vue'
  import { RouterLink, useRoute } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { Typography } from '@shared/ui/typography'
  import { useVerifyMutation } from '@shared/api'
  import { routeLocation } from '@/app/router/route-locations'

  const { t } = useI18n()
  const route = useRoute()

  type VerifyState = 'pending' | 'success' | 'failed' | 'missing'
  const state = ref<VerifyState>('pending')

  const { mutateAsync } = useVerifyMutation()

  onMounted(async () => {
    const raw = route.query.token
    const token = Array.isArray(raw) ? raw[0] : raw
    if (!token) {
      state.value = 'missing'
      return
    }
    try {
      await mutateAsync({ token })
      state.value = 'success'
    } catch {
      state.value = 'failed'
    }
  })
</script>

<style scoped lang="scss">
  .auth {
    display: flex;
    flex-direction: column;
    gap: 12px;
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
    }
  }
</style>
