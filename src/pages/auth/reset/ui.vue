<template>
  <AuthLayout
    :title="t('auth.reset.title')"
    :subtitle="submitted ? undefined : t('auth.reset.description')"
  >
    <Typography v-if="submitted" color="primary" size="s" role="status">
      {{ t('auth.reset.sent') }}
    </Typography>

    <Form v-else class="flex flex-col gap-2" autocomplete="off" @submit="onSubmit()">
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
        {{ t('auth.reset.submit') }}
      </Button>
    </Form>

    <template #footer>
      <Typography tag-name="p" color="sub" size="xs">
        <Link class="link-main" :to="routeLocation.login()">
          {{ t('auth.reset.backToLogin') }}
        </Link>
      </Typography>
    </template>
  </AuthLayout>
</template>

<script setup lang="ts">
  import { ref, useTemplateRef } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { Form, useForm } from 'vee-validate'
  import { toTypedSchema } from '@vee-validate/valibot'
  import * as v from 'valibot'
  import { Typography } from '@shared/ui/typography'
  import { TextInput } from '@shared/ui/input'
  import { Button } from '@shared/ui/button'
  import { Link } from '@shared/ui/link'
  import { AuthLayout } from '@/features/layouts/auth'
  import { usePasswordResetRequestMutation } from '@shared/api'
  import {
    TurnstileField,
    captchaBody,
    captchaTokenSchema,
    isCaptchaError,
    type TurnstileFieldExpose
  } from '@/features/captcha/turnstile'
  import { routeLocation } from '@/shared/router'

  const { t } = useI18n()

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

  const submitted = ref(false)
  const submitError = ref('')
  const { mutateAsync, isPending } = usePasswordResetRequestMutation()

  const onSubmit = handleSubmit(async (values) => {
    submitError.value = ''
    try {
      await mutateAsync({ email: values.email, ...captchaBody(values.turnstileToken) })
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
    submitted.value = true
  })
</script>
