<template>
  <Dialog v-model:open="open">
    <DialogContent class="w-auto sm:max-w-fit">
      <DialogTitle class="sr-only">Captcha verification</DialogTitle>
      <DialogDescription class="sr-only">
        Confirm you are not a robot to continue.
      </DialogDescription>
      <RecaptchaV2
        @error-callback="handleErrorCallback"
        @expired-callback="handleExpiredCallback"
        @load-callback="handleLoadCallback"
      />
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
  import { toast } from '@/shared/ui/sonner'
  import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/shared/ui/dialog'
  import { RecaptchaV2 } from 'vue3-recaptcha-v2'
  import logger from '@/shared/lib/helpers/logger'

  const open = defineModel<boolean>('open', { required: true })
  const emit = defineEmits<{
    verified: [token: string]
    error: []
    expired: []
  }>()

  const showAlert = (message: string): void => {
    toast.error(message)
  }

  const handleLoadCallback = (response: unknown) => {
    if (typeof response === 'string') {
      emit('verified', response)
    } else {
      logger.error('Unexpected response type from reCAPTCHA')
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
