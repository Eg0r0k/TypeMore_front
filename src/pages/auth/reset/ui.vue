<template>
  <div class="auth__wrapper">
    <div class="auth">
      <div class="auth__header">
        <Typography color="main" tag-name="h2" size="xl">{{ t('auth.reset.title') }}</Typography>
      </div>

      <!-- Anti-enumeration: the same copy shows whether or not the email exists. -->
      <Typography v-if="submitted" color="primary" size="s" role="status">
        {{ t('auth.reset.sent') }}
      </Typography>

      <template v-else>
        <Typography color="sub" size="xs">{{ t('auth.reset.description') }}</Typography>

        <Form class="auth__body" autocomplete="off" @submit="onSubmit()">
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
          <Button type="submit" :disabled="isPending">{{ t('auth.reset.submit') }}</Button>
        </Form>
      </template>

      <RouterLink class="auth__link" :to="routeLocation.login()">
        <Typography color="sub" size="xs">{{ t('auth.reset.backToLogin') }}</Typography>
      </RouterLink>
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
  import { Typography } from '@shared/ui/typography'
  import { TextInput } from '@shared/ui/input'
  import { Button } from '@shared/ui/button'
  import { usePasswordResetRequestMutation } from '@shared/api'
  import { routeLocation } from '@/app/router/route-locations'

  const { t } = useI18n()

  const schema = toTypedSchema(
    v.object({
      email: v.pipe(
        v.string(t('auth.validation.emailRequired')),
        v.nonEmpty(t('auth.validation.emailRequired')),
        v.email(t('auth.validation.emailInvalid'))
      )
    })
  )

  const { handleSubmit, errors, defineField } = useForm({ validationSchema: schema })
  const [email, emailProps] = defineField('email')

  const submitted = ref(false)
  const { mutateAsync, isPending } = usePasswordResetRequestMutation()

  const onSubmit = handleSubmit(async (values) => {
    // Swallow the outcome deliberately: revealing success/failure per-email would
    // leak which addresses are registered.
    try {
      await mutateAsync({ email: values.email })
    } catch {
      // ignore — identical UX regardless.
    }
    submitted.value = true
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
