<template>
  <div class="auth__wrapper">
    <div class="auth">
      <div class="auth__header">
        <Typography color="main" tag-name="h2" size="xl">{{ t('auth.login.title') }}</Typography>
      </div>

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

        <TextInput
          v-bind="passwordProps"
          v-model="password"
          :type="visiblePassword ? 'text' : 'password'"
          autocomplete="current-password"
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

        <Button type="submit" :disabled="isPending">{{ t('auth.login.submit') }}</Button>
      </Form>

      <div class="auth__divider">
        <Typography color="sub" size="xs">{{ t('auth.common.or') }}</Typography>
      </div>

      <div class="auth__oauth">
        <Button color="gray" :button-label="t('auth.login.github')" @click="startOAuth('github')">
          <template #left-icon><IconBrandGithub width="22" height="22" /></template>
          {{ t('auth.login.github') }}
        </Button>
        <Button color="gray" :button-label="t('auth.login.google')" @click="startOAuth('google')">
          <template #left-icon><IconBrandGoogle width="22" height="22" /></template>
          {{ t('auth.login.google') }}
        </Button>
      </div>

      <div class="auth__footer">
        <Typography tag-name="p" color="primary" size="xs">
          {{ t('auth.login.noAccount') }}
          <RouterLink class="auth__link" :to="routeLocation.register()">
            {{ t('auth.login.createOne') }}
          </RouterLink>
        </Typography>
        <RouterLink class="auth__link" :to="routeLocation.reset()">
          <Typography color="sub" size="xs">{{ t('auth.login.forgotPassword') }}</Typography>
        </RouterLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { useRouter, RouterLink } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { Form, useForm } from 'vee-validate'
  import { toTypedSchema } from '@vee-validate/valibot'
  import * as v from 'valibot'
  import IconEye from '~icons/tabler/eye'
  import IconEyeOff from '~icons/tabler/eye-off'
  import IconBrandGoogle from '~icons/tabler/brand-google'
  import IconBrandGithub from '~icons/tabler/brand-github'
  import { Typography } from '@shared/ui/typography'
  import { TextInput } from '@shared/ui/input'
  import { Button } from '@shared/ui/button'
  import { oauthStartUrl, useLoginMutation, type OAuthProvider } from '@shared/api'
  import { routeLocation } from '@/shared/router'

  const { t } = useI18n()
  const router = useRouter()

  const schema = toTypedSchema(
    v.object({
      email: v.pipe(
        v.string(t('auth.validation.emailRequired')),
        v.nonEmpty(t('auth.validation.emailRequired')),
        v.email(t('auth.validation.emailInvalid'))
      ),
      password: v.pipe(
        v.string(t('auth.validation.passwordRequired')),
        v.nonEmpty(t('auth.validation.passwordRequired'))
      )
    })
  )

  const { handleSubmit, errors, defineField } = useForm({ validationSchema: schema })
  const [email, emailProps] = defineField('email')
  const [password, passwordProps] = defineField('password')

  const visiblePassword = ref(false)
  const submitError = ref('')

  const { mutateAsync, isPending } = useLoginMutation()

  const onSubmit = handleSubmit(async (values) => {
    submitError.value = ''
    try {
      await mutateAsync({ email: values.email, password: values.password })
      await router.push(routeLocation.home())
    } catch {
      submitError.value = t('auth.login.failed')
    }
  })

  const startOAuth = (provider: OAuthProvider) => {
    window.location.href = oauthStartUrl(provider)
  }
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

    &__divider {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4px 0;
    }

    &__oauth {
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
