<template>
  <AuthLayout :title="t('auth.verify.title')">
    <Typography v-if="state === 'pending'" color="primary" size="s" role="status">
      {{ t('auth.verify.pending') }}
    </Typography>
    <Typography v-else-if="state === 'success'" color="primary" size="s" role="status">
      {{ t('auth.verify.success') }}
    </Typography>
    <Typography v-else-if="state === 'missing'" color="error" size="s" role="alert">
      {{ t('auth.verify.missingToken') }}
    </Typography>
    <Typography v-else color="error" size="s" role="alert" data-testid="verify-error">
      {{ t(failureKey) }}
    </Typography>

    <!-- A dead or absent link is the only state a new one can help with — and
         `resendable` is what keeps the form away from the failure a new link
         would hit in exactly the same way. -->
    <template v-if="(state === 'failed' && resendable) || state === 'missing'">
      <!-- Anti-enumeration: the same copy shows whether or not the email exists. -->
      <Typography v-if="resent" color="primary" size="s" role="status">
        {{ t('auth.verify.resendSent') }}
      </Typography>

      <Form v-else class="flex flex-col gap-2" autocomplete="off" @submit="onResend()">
        <!-- Above the field it introduces, and spaced off it: inside the field
             stack it was one more line in a column of labels. -->
        <Typography class="mb-1" color="sub" size="xs">
          {{ t('auth.verify.resendDescription') }}
        </Typography>

        <TextInput
          v-bind="emailProps"
          v-model="email"
          type="email"
          autocomplete="email"
          name="email"
          :has-error-space="true"
          :error-message="errors.email"
          :label="t('auth.common.email')"
          :placeholder="t('auth.common.emailPlaceholder')"
        />

        <TurnstileField
          ref="captcha"
          v-model="turnstileToken"
          :error-message="errors.turnstileToken"
        />

        <Typography v-if="submitError" color="error" size="xs" role="alert">
          {{ submitError }}
        </Typography>

        <Button class="mt-2" type="submit" :disabled="isPending">
          {{ t('auth.verify.resendSubmit') }}
        </Button>
      </Form>
    </template>

    <template v-if="state !== 'pending'" #footer>
      <Typography tag-name="p" color="sub" size="xs">
        <Link class="link-main" :to="routeLocation.login()">
          {{ t('auth.verify.toLogin') }}
        </Link>
      </Typography>
    </template>
  </AuthLayout>
</template>

<script setup lang="ts">
  import { onMounted, ref, useTemplateRef } from 'vue'
  import { useRoute } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { Form, useForm } from 'vee-validate'
  import { toTypedSchema } from '@vee-validate/valibot'
  import * as v from 'valibot'
  import { Typography } from '@shared/ui/typography'
  import { TextInput } from '@shared/ui/input'
  import { Button } from '@shared/ui/button'
  import { Link } from '@shared/ui/link'
  import { AuthLayout } from '@/features/layouts/auth'
  import { isApiError, useResendVerificationMutation, useVerifyMutation } from '@shared/api'
  import { apiErrorKey } from '@/entities/auth'
  import {
    TurnstileField,
    captchaBody,
    captchaTokenSchema,
    isCaptchaError,
    type TurnstileFieldExpose
  } from '@/features/captcha/turnstile'
  import { routeLocation } from '@/shared/router'

  const { t } = useI18n()
  const route = useRoute()

  type VerifyState = 'pending' | 'success' | 'failed' | 'missing'
  const state = ref<VerifyState>('pending')
  /** What the failure says — the server's code when it named one. */
  const failureKey = ref('auth.verify.failed')
  /** Whether a fresh link could plausibly succeed where this one did not. */
  const resendable = ref(true)

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
    } catch (error) {
      /*
       * Usually a dead link (`invalid_token`), and the page's own copy says so.
       * But it can also be `account_exists_use_linking`: someone else verified
       * this address first, so the token is perfectly valid and a new one would
       * fail the same way. Calling that "expired" sends the reader in a circle
       * through the resend form below.
       */
      failureKey.value = apiErrorKey(error, 'auth.verify.failed')
      resendable.value = !isApiError(error) || error.code === 'invalid_token'
      state.value = 'failed'
    }
  })

  const schema = toTypedSchema(
    v.object({
      email: v.pipe(
        v.string(t('auth.validation.emailRequired')),
        v.nonEmpty(t('auth.validation.emailRequired')),
        v.email(t('auth.validation.emailInvalid')),
        // Mirrors the server bound (validateEmail: ≤ 254 characters).
        v.maxLength(254, t('auth.validation.emailMax'))
      ),
      turnstileToken: captchaTokenSchema(t('auth.captcha.required'))
    })
  )

  // Seed every typed key: an ABSENT key makes valibot's `v.object` report its
  // own raw "Invalid key" issue on blur, before the localized message runs.
  const { handleSubmit, errors, defineField } = useForm({
    validationSchema: schema,
    initialValues: { email: '' }
  })
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
