<template>
  <div class="captcha-modal">
    <RecaptchaV2
      @widget-id="handleWidgetId"
      @error-callback="handleErrorCallback"
      @expired-callback="handleExpiredCallback"
      @load-callback="handleLoadCallback"
    />
  </div>
</template>

<script setup lang="ts">
  import { useModal } from '@/entities/modal/model/store'
  import { useAlertStore } from '@/entities/alert'
  import { AlertType } from '@/entities/alert/types/alertData'
  import { RecaptchaV2 } from 'vue3-recaptcha-v2'

  const modalStore = useModal()
  const alertStore = useAlertStore()

  const handleWidgetId = (widgetId: number) => {
    console.log(widgetId)
  }

  const showAlert = (message: string): void => {
    alertStore.addAlert({
      type: AlertType.Error,
      title: 'Error',
      msg: message,
      duration: 3000
    })
  }

  const handleLoadCallback = (response: unknown) => {
    if (typeof response === 'string') {
      modalStore.handlers.onVerified?.(response)
    } else {
      console.error('Unexpected response type from reCAPTCHA')
      showAlert('An unexpected error occurred. Please try again.')
    }
  }

  const handleErrorCallback = () => {
    showAlert('CAPTCHA verification failed. Please try again.')
    modalStore.handlers.onError?.()
  }

  const handleExpiredCallback = () => {
    showAlert('CAPTCHA expired. Please try again.')
    modalStore.handlers.onExpired?.()
  }
</script>

<style lang="scss" scoped>
  .captcha-modal {
    padding: 1.5rem;
    background: var(--bg-color);
    border-radius: var(--border-radius);
    box-shadow: 0 0 0 0.2em var(--sub-alt-color);
  }
</style>
