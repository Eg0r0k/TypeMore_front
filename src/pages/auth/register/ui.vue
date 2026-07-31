<template>
  <div class="auth__wrapper">
    <div class="auth">
      <div class="auth__header">
        <Typography color="main" tag-name="h2" size="xl">{{ t('auth.register.title') }}</Typography>
      </div>

      <Typography v-if="done" color="primary" size="s" role="status">
        {{ t('auth.register.success') }}
      </Typography>

      <Form v-else class="auth__body" autocomplete="off" @submit="onSubmit()">
        <TextInput
          v-bind="nameProps"
          v-model="name"
          autocomplete="nickname"
          name="name"
          :has-error-space="true"
          :error-message="errors.name"
          :label="t('auth.common.displayName')"
          :placeholder="t('auth.common.displayName')"
        />

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

        <TextInput
          v-bind="passwordProps"
          v-model="password"
          :type="visiblePassword ? 'text' : 'password'"
          autocomplete="new-password"
          name="password"
          :has-error-space="true"
          :error-message="errors.password"
          :label="t('auth.common.password')"
          :placeholder="t('auth.common.password')"
        >
          <template #right-icon>
            <Button
              type="button"
              size="s"
              color="shadow"
              :aria-label="
                visiblePassword ? t('auth.common.hidePassword') : t('auth.common.showPassword')
              "
              @click.prevent="visiblePassword = !visiblePassword"
            >
              <component :is="visiblePassword ? IconEyeOff : IconEye" class="size-5" />
            </Button>
          </template>
        </TextInput>

        <TurnstileField
          ref="captcha"
          v-model="turnstileToken"
          :error-message="errors.turnstileToken"
        />
        <Typography v-if="submitError" color="error" size="xs" role="alert">
          {{ submitError }}
        </Typography>

        <Button type="submit" :disabled="isPending">{{ t('auth.register.submit') }}</Button>
      </Form>

      <div class="auth__footer">
        <Typography tag-name="p" color="primary" size="xs">
          {{ t('auth.register.hasAccount') }}
          <RouterLink class="auth__link" :to="routeLocation.login()">
            {{ t('auth.register.login') }}
          </RouterLink>
        </Typography>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, useTemplateRef } from 'vue'
  import { RouterLink } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { Form, useForm } from 'vee-validate'
  import { toTypedSchema } from '@vee-validate/valibot'
  import * as v from 'valibot'
  import IconEye from '~icons/tabler/eye'
  import IconEyeOff from '~icons/tabler/eye-off'
  import { Typography } from '@shared/ui/typography'
  import { TextInput } from '@shared/ui/input'
  import { Button } from '@shared/ui/button'
  import { isApiError, useRegisterMutation } from '@shared/api'
  import {
    TurnstileField,
    captchaBody,
    captchaTokenSchema,
    isCaptchaError,
    type TurnstileFieldExpose
  } from '@/features/captcha/turnstile'
  import { routeLocation } from '@/shared/router'

  const { t } = useI18n()

  // Mirror the server rules: display name 3–20 chars, charset [a-zA-Z0-9_.-],
  // password 8–128, email ≤ 254.
  const schema = toTypedSchema(
    v.object({
      name: v.pipe(
        v.string(t('auth.validation.nameRequired')),
        v.nonEmpty(t('auth.validation.nameRequired')),
        v.minLength(3, t('auth.validation.nameLength')),
        v.maxLength(20, t('auth.validation.nameLength')),
        v.regex(/^[a-zA-Z0-9_.-]+$/, t('auth.validation.nameCharset'))
      ),
      email: v.pipe(
        v.string(t('auth.validation.emailRequired')),
        v.nonEmpty(t('auth.validation.emailRequired')),
        v.email(t('auth.validation.emailInvalid')),
        v.maxLength(254, t('auth.validation.emailMax'))
      ),
      password: v.pipe(
        v.string(t('auth.validation.passwordRequired')),
        v.nonEmpty(t('auth.validation.passwordRequired')),
        v.minLength(8, t('auth.validation.passwordMin')),
        v.maxLength(128, t('auth.validation.passwordMax'))
      ),
      turnstileToken: captchaTokenSchema(t('auth.captcha.required'))
    })
  )

  // Seed every typed key: an ABSENT key makes valibot's `v.object` report its
  // own raw "Invalid key" issue on blur, before the localized message runs.
  const { handleSubmit, errors, defineField } = useForm({
    validationSchema: schema,
    initialValues: { name: '', email: '', password: '' }
  })
  const [name, nameProps] = defineField('name')
  const [email, emailProps] = defineField('email')
  const [password, passwordProps] = defineField('password')
  const [turnstileToken] = defineField('turnstileToken')
  const captcha = useTemplateRef<TurnstileFieldExpose>('captcha')

  const visiblePassword = ref(false)
  const submitError = ref('')
  const done = ref(false)

  const { mutateAsync, isPending } = useRegisterMutation()

  const onSubmit = handleSubmit(async (values) => {
    submitError.value = ''
    try {
      await mutateAsync({
        email: values.email,
        password: values.password,
        name: values.name,
        ...captchaBody(values.turnstileToken)
      })
      done.value = true
    } catch (error) {
      // A Turnstile token is single-use: without the reset the retry would
      // resubmit the spent token and fail again, silently.
      if (isCaptchaError(error)) {
        captcha.value?.reset()
        submitError.value = t('auth.captcha.failed')
      } else if (isApiError(error) && error.code === 'name_taken') {
        submitError.value = t('auth.register.nameTaken')
      } else if (isApiError(error) && error.code === 'account_exists') {
        submitError.value = t('auth.register.accountExists')
      } else {
        submitError.value = t('auth.register.failed')
      }
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
    }

    &__footer {
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: center;
    }

    &__link {
      color: var(--main-color);
      text-decoration: underline;
      text-decoration-thickness: from-font;
      text-underline-position: from-font;
    }
  }
</style>
