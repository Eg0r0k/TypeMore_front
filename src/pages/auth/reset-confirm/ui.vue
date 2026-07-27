<template>
  <div class="auth__wrapper">
    <div class="auth">
      <div class="auth__header">
        <Typography color="main" tag-name="h2" size="xl">
          {{ t('auth.resetConfirm.title') }}
        </Typography>
      </div>

      <Typography v-if="done" color="primary" size="s" role="status">
        {{ t('auth.resetConfirm.success') }}
      </Typography>
      <Typography v-else-if="!token" color="error" size="s" role="alert">
        {{ t('auth.resetConfirm.missingToken') }}
      </Typography>

      <Form v-else class="auth__body" autocomplete="off" @submit="onSubmit()">
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

        <Button type="submit" :disabled="isPending">{{ t('auth.resetConfirm.submit') }}</Button>
      </Form>

      <RouterLink v-if="done || !token" class="auth__link" :to="routeLocation.login()">
        <Typography color="sub" size="xs">{{ t('auth.resetConfirm.toLogin') }}</Typography>
      </RouterLink>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { RouterLink, useRoute } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { Form, useForm } from 'vee-validate'
  import { toTypedSchema } from '@vee-validate/valibot'
  import * as v from 'valibot'
  import IconEye from '~icons/tabler/eye'
  import IconEyeOff from '~icons/tabler/eye-off'
  import { Typography } from '@shared/ui/typography'
  import { TextInput } from '@shared/ui/input'
  import { Button } from '@shared/ui/button'
  import { usePasswordResetConfirmMutation } from '@shared/api'
  import { routeLocation } from '@/shared/router'

  const { t } = useI18n()
  const route = useRoute()

  const rawToken = route.query.token
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken

  const schema = toTypedSchema(
    v.object({
      password: v.pipe(
        v.string(t('auth.validation.passwordRequired')),
        v.nonEmpty(t('auth.validation.passwordRequired')),
        v.minLength(8, t('auth.validation.passwordMin')),
        v.maxLength(72, t('auth.validation.passwordMax'))
      )
    })
  )

  const { handleSubmit, errors, defineField } = useForm({ validationSchema: schema })
  const [password, passwordProps] = defineField('password')

  const visiblePassword = ref(false)
  const submitError = ref('')
  const done = ref(false)

  const { mutateAsync, isPending } = usePasswordResetConfirmMutation()

  const onSubmit = handleSubmit(async (values) => {
    if (!token) return
    submitError.value = ''
    try {
      await mutateAsync({ token, password: values.password })
      done.value = true
    } catch {
      submitError.value = t('auth.resetConfirm.failed')
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

    &__link {
      color: var(--main-color);
      text-decoration: underline;
    }
  }
</style>
