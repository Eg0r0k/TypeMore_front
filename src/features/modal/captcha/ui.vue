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
  console.log('Widget ID: ', widgetId)
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
    console.log('Captcha Verified', response)
    modalStore.handlers.onVerified?.(response)
  } else {
    console.error('Unexpected response type from reCAPTCHA')
    showAlert('An unexpected error occurred. Please try again.')
  }
}

const handleErrorCallback = () => {
  console.log('Error callback')
  showAlert('CAPTCHA verification failed. Please try again.')
  modalStore.handlers.onError?.()
}

const handleExpiredCallback = () => {
  console.log('Expired callback')
  showAlert('CAPTCHA expired. Please try again.')
  modalStore.handlers.onExpired?.()
}
</script>

<style lang="scss" scoped>
.captcha-modal {
  box-shadow: 0 0 0 0.2em var(--sub-alt-color);
  background: var(--bg-color);
  border-radius: var(--border-radius);
  padding: 24px;
}
</style>
