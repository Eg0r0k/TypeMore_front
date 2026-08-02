<template>
  <AuthLayout :title="t('auth.login.title')" :subtitle="t('auth.login.subtitle')">
    <Form class="flex flex-col gap-2" autocomplete="off" @submit="onSubmit()">
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

      <TextInput
        v-bind="passwordProps"
        v-model="password"
        :type="visiblePassword ? 'text' : 'password'"
        autocomplete="current-password"
        name="password"
        :has-error-space="true"
        :error-message="errors.password"
        :label="t('auth.common.password')"
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

      <Typography v-if="submitError" color="error" size="xs" role="alert">
        {{ submitError }}
        <!-- The one login failure with a way out of it: the verify page is
             where a fresh link is requested, so the message that names the
             problem also carries the fix. -->
        <Link v-if="needsVerification" class="link-main" :to="routeLocation.verify()">
          {{ t('auth.login.resendVerification') }}
        </Link>
      </Typography>

      <Button class="mt-2" type="submit" :disabled="isPending">
        {{ t('auth.login.submit') }}
      </Button>
    </Form>

    <div class="flex items-center gap-3" aria-hidden="true">
      <span class="bg-sub-alt h-px flex-1"></span>
      <Typography color="sub" size="xxs">{{ t('auth.common.or') }}</Typography>
      <span class="bg-sub-alt h-px flex-1"></span>
    </div>

    <div class="flex flex-col gap-2">
      <Button color="gray" @click="startOAuth('github')">
        <IconBrandGithub class="size-5" />
        {{ t('auth.login.github') }}
      </Button>
      <Button color="gray" @click="startOAuth('google')">
        <IconBrandGoogle class="size-5" />
        {{ t('auth.login.google') }}
      </Button>
    </div>

    <template #footer>
      <Typography tag-name="p" color="sub" size="xs">
        {{ t('auth.login.noAccount') }}
        <Link class="link-main" :to="routeLocation.register()">
          {{ t('auth.login.createOne') }}
        </Link>
      </Typography>
      <Typography tag-name="p" color="sub" size="xs">
        <Link class="link-main" :to="routeLocation.reset()">
          {{ t('auth.login.forgotPassword') }}
        </Link>
      </Typography>
    </template>
  </AuthLayout>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { useRouter } from 'vue-router'
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
  import { Link } from '@shared/ui/link'
  import { AuthLayout } from '@/features/layouts/auth'
  import { isApiError, oauthStartUrl, useLoginMutation, type OAuthProvider } from '@shared/api'
  import { apiErrorKey } from '@/entities/auth'
  import { routeLocation } from '@/shared/router'

  const { t } = useI18n()
  const router = useRouter()

  const schema = toTypedSchema(
    v.object({
      email: v.pipe(
        v.string(t('auth.validation.emailRequired')),
        v.nonEmpty(t('auth.validation.emailRequired')),
        v.email(t('auth.validation.emailInvalid')),
        // Mirrors the server bound (validateEmail: ≤ 254 characters).
        v.maxLength(254, t('auth.validation.emailMax'))
      ),
      password: v.pipe(
        v.string(t('auth.validation.passwordRequired')),
        v.nonEmpty(t('auth.validation.passwordRequired'))
      )
    })
  )

  // Seed every key: an ABSENT key makes valibot's `v.object` report its own raw
  // "Invalid key" issue on blur, before the localized `nonEmpty` message runs.
  const { handleSubmit, errors, defineField } = useForm({
    validationSchema: schema,
    initialValues: { email: '', password: '' }
  })
  const [email, emailProps] = defineField('email')
  const [password, passwordProps] = defineField('password')

  const visiblePassword = ref(false)
  const submitError = ref('')
  /** Set when the sign-in failed only because the address is unverified. */
  const needsVerification = ref(false)

  const { mutateAsync, isPending } = useLoginMutation()

  const onSubmit = handleSubmit(async (values) => {
    submitError.value = ''
    needsVerification.value = false
    try {
      await mutateAsync({ email: values.email, password: values.password })
      await router.push(routeLocation.home())
    } catch (error) {
      /*
       * Not every login failure is a wrong password, and saying so when it is
       * not sends the reader to check a password that was correct. The server
       * distinguishes an unverified address (403 email_not_verified, which the
       * reader can act on — and only ever answered once the password was
       * PROVEN correct, so it leaks nothing), a rate limit, and a hashing-
       * capacity 503 that really does clear on a retry.
       *
       * `invalid_credentials` stays deliberately vague: it is the one answer
       * the server gives for both an unknown email and a wrong password, and
       * pulling those apart is exactly what it refuses to do.
       */
      submitError.value = t(apiErrorKey(error, 'auth.error.generic'))
      needsVerification.value = isApiError(error) && error.code === 'email_not_verified'
    }
  })

  const startOAuth = (provider: OAuthProvider) => {
    window.location.href = oauthStartUrl(provider)
  }
</script>
