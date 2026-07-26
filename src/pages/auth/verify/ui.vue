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

      <!-- A dead or absent link is the only state a new one can help with. -->
      <template v-if="state === 'failed' || state === 'missing'">
        <!-- Anti-enumeration: the same copy shows whether or not the email exists. -->
        <Typography v-if="resent" color="primary" size="s" role="status">
          {{ t('auth.verify.resendSent') }}
        </Typography>

        <Form v-else class="auth__body" autocomplete="off" @submit="onResend()">
          <Typography color="sub" size="xs">{{ t('auth.verify.resendDescription') }}</Typography>

          <TextInput
            v-bind="emailProps"
            v-model="email"
            type="email"
            autocomplete="email"
            name="email"
            :has-error-space="true"
            :error-message="errors.email"
            :label="t('auth.common.email')"
            :placeholder="t('auth.common.email')"
          />

          <TurnstileField
            ref="captcha"
            v-model="turnstileToken"
            :error-message="errors.turnstileToken"
          />

          <Typography v-if="submitError" color="error" size="xs" role="alert">
            {{ submitError }}
          </Typography>

          <Button type="submit" :disabled="isPending">{{ t('auth.verify.resendSubmit') }}</Button>
        </Form>
      </template>

      <RouterLink v-if="state !== 'pending'" class="auth__link" :to="routeLocation.login()">
        <Typography color="sub" size="xs">{{ t('auth.verify.toLogin') }}</Typography>
      </RouterLink>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, ref, useTemplateRef } from 'vue'
  import { RouterLink, useRoute } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { Form, useForm } from 'vee-validate'
  import { toTypedSchema } from '@vee-validate/valibot'
  import * as v from 'valibot'
  import { Typography } from '@shared/ui/typography'
  import { TextInput } from '@shared/ui/input'
  import { Button } from '@shared/ui/button'
  import { useResendVerificationMutation, useVerifyMutation } from '@shared/api'
  import {
    TurnstileField,
    captchaBody,
    captchaTokenSchema,
    isCaptchaError,
    type TurnstileFieldExpose
  } from '@/features/captcha/turnstile'
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

  const schema = toTypedSchema(
    v.object({
      email: v.pipe(
        v.string(t('auth.validation.emailRequired')),
        v.nonEmpty(t('auth.validation.emailRequired')),
        v.email(t('auth.validation.emailInvalid'))
      ),
      turnstileToken: captchaTokenSchema(t('auth.captcha.required'))
    })
  )

  const { handleSubmit, errors, defineField } = useForm({ validationSchema: schema })
  const [email, emailProps] = defineField('email')
  const [turnstileToken] = defineField('turnstileToken')
  const captcha = useTemplateRef<TurnstileFieldExpose>('captcha')

  const resent = ref(false)
  const submitError = ref('')
  const { mutateAsync: resend, isPending } = useResendVerificationMutation()

  const onResend = handleSubmit(async (values) => {
    submitError.value = ''
    try {
      await resend({ email: values.email, ...captchaBody(values.turnstileToken) })
    } catch (error) {
      // The captcha gate runs BEFORE the anti-enumeration branch server-side, so
      // a rejection here says nothing about the address and must be surfaced —
      // and the spent, single-use token replaced before the user retries.
      if (isCaptchaError(error)) {
        captcha.value?.reset()
        submitError.value = t('auth.captcha.failed')
        return
      }
      // Any other outcome is swallowed deliberately: revealing success/failure
      // per-email would leak which addresses are registered.
    }
    resent.value = true
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

    &__body {
      display: flex;
      flex-direction: column;
      gap: 8px;
      text-align: left;
    }

    &__link {
      color: var(--main-color);
      text-decoration: underline;
    }
  }
</style>
