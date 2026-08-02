<template>
  <AuthLayout
    :title="t('auth.resetConfirm.title')"
    :subtitle="showForm ? t('auth.resetConfirm.subtitle') : undefined"
  >
    <Typography v-if="done" color="primary" size="s" role="status">
      {{ t('auth.resetConfirm.success') }}
    </Typography>
    <Typography v-else-if="!token" color="error" size="s" role="alert">
      {{ t('auth.resetConfirm.missingToken') }}
    </Typography>

    <Form v-else class="flex flex-col gap-2" autocomplete="off" @submit="onSubmit()">
      <TextInput
        v-bind="passwordProps"
        v-model="password"
        :type="visiblePassword ? 'text' : 'password'"
        autocomplete="new-password"
        name="password"
        :has-error-space="true"
        :error-message="errors.password"
        :label="t('auth.common.newPassword')"
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
      </Typography>

      <Button class="mt-2" type="submit" :disabled="isPending">
        {{ t('auth.resetConfirm.submit') }}
      </Button>
    </Form>

    <template v-if="submitError || done || !token" #footer>
      <!-- An expired link is the most common failure here; without this escape
           the only way to a fresh link is guessing the route by hand. -->
      <Typography v-if="submitError" tag-name="p" color="sub" size="xs">
        <Link class="link-main" :to="routeLocation.reset()">
          {{ t('auth.resetConfirm.requestNew') }}
        </Link>
      </Typography>

      <Typography v-if="done || !token" tag-name="p" color="sub" size="xs">
        <Link class="link-main" :to="routeLocation.login()">
          {{ t('auth.resetConfirm.toLogin') }}
        </Link>
      </Typography>
    </template>
  </AuthLayout>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useRoute } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { Form, useForm } from 'vee-validate'
  import { toTypedSchema } from '@vee-validate/valibot'
  import * as v from 'valibot'
  import IconEye from '~icons/tabler/eye'
  import IconEyeOff from '~icons/tabler/eye-off'
  import { Typography } from '@shared/ui/typography'
  import { TextInput } from '@shared/ui/input'
  import { Button } from '@shared/ui/button'
  import { Link } from '@shared/ui/link'
  import { AuthLayout } from '@/features/layouts/auth'
  import { usePasswordResetConfirmMutation } from '@shared/api'
  import { apiErrorKey } from '@/entities/auth'
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
        // Mirrors the server bound (passwordMaxLen = 128).
        v.maxLength(128, t('auth.validation.passwordMax'))
      )
    })
  )

  // Seed every key: an ABSENT key makes valibot's `v.object` report its own raw
  // "Invalid key" issue on blur, before the localized message runs.
  const { handleSubmit, errors, defineField } = useForm({
    validationSchema: schema,
    initialValues: { password: '' }
  })
  const [password, passwordProps] = defineField('password')

  const visiblePassword = ref(false)
  const submitError = ref('')
  const done = ref(false)

  // The heading's supporting line describes the FORM, so it goes away with it.
  const showForm = computed(() => !done.value && Boolean(token))

  const { mutateAsync, isPending } = usePasswordResetConfirmMutation()

  const onSubmit = handleSubmit(async (values) => {
    if (!token) return
    submitError.value = ''
    try {
      await mutateAsync({ token, password: values.password })
      done.value = true
    } catch (error) {
      // A dead link is the common case and keeps this page's own wording; a
      // rate limit or the hashing-capacity 503 is not a dead link, and telling
      // someone to request a new one would waste the perfectly good one they
      // are holding.
      submitError.value = t(apiErrorKey(error, 'auth.resetConfirm.failed'))
    }
  })
</script>
