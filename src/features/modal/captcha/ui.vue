<template>
  <Dialog v-model:open="open">
    <DialogContent class="w-auto sm:max-w-fit">
      <DialogTitle class="sr-only">Captcha verification</DialogTitle>
      <DialogDescription class="sr-only">
        Confirm you are not a robot to continue.
      </DialogDescription>
      <RecaptchaV2
        @widget-id="handleWidgetId"
        @error-callback="handleErrorCallback"
        @expired-callback="handleExpiredCallback"
        @load-callback="handleLoadCallback"
      />
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
  import { useAlertStore } from '@/entities/alert'
  import { AlertType } from '@/entities/alert/types/alertData'
  import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/shared/ui/dialog'
  import { RecaptchaV2 } from 'vue3-recaptcha-v2'

  const open = defineModel<boolean>('open', { required: true })
  const emit = defineEmits<{
    verified: [token: string]
    error: []
    expired: []
  }>()

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
      emit('verified', response)
    } else {
      console.error('Unexpected response type from reCAPTCHA')
      showAlert('An unexpected error occurred. Please try again.')
    }
  }

  const handleErrorCallback = () => {
    showAlert('CAPTCHA verification failed. Please try again.')
    emit('error')
  }

  const handleExpiredCallback = () => {
    showAlert('CAPTCHA expired. Please try again.')
    emit('expired')
  }
</script>
