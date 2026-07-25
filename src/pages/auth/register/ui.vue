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
          autocomplete="username"
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
              :button-label="
                visiblePassword ? t('auth.common.hidePassword') : t('auth.common.showPassword')
              "
              @click.prevent="visiblePassword = !visiblePassword"
            >
              <template #left-icon>
                <component :is="visiblePassword ? IconEyeOff : IconEye" width="24" height="24" />
              </template>
            </Button>
          </template>
        </TextInput>

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
  import { ref } from 'vue'
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
  import { routeLocation } from '@/app/router/route-locations'

  const { t } = useI18n()

  // Mirror the server rules: display name 3–20 chars, charset [a-zA-Z0-9_.-].
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
        v.email(t('auth.validation.emailInvalid'))
      ),
      password: v.pipe(
        v.string(t('auth.validation.passwordRequired')),
        v.nonEmpty(t('auth.validation.passwordRequired')),
        v.minLength(8, t('auth.validation.passwordMin')),
        v.maxLength(72, t('auth.validation.passwordMax'))
      )
    })
  )

  const { handleSubmit, errors, defineField } = useForm({ validationSchema: schema })
  const [name, nameProps] = defineField('name')
  const [email, emailProps] = defineField('email')
  const [password, passwordProps] = defineField('password')

  const visiblePassword = ref(false)
  const submitError = ref('')
  const done = ref(false)

  const { mutateAsync, isPending } = useRegisterMutation()

  const onSubmit = handleSubmit(async (values) => {
    submitError.value = ''
    try {
      await mutateAsync({ email: values.email, password: values.password, name: values.name })
      done.value = true
    } catch (error) {
      if (isApiError(error) && error.code === 'name_taken') {
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
    gap: 12px;
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
      margin-top: 8px;
    }

    &__link {
      color: var(--main-color);
      text-decoration: underline;
    }
  }
</style>
