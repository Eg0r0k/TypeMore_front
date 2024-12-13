<template>
  <div class="registration__wrapper">
    <div class="registration">
      <div class="registration__header">
        <Typography color="main" tag-name="h2" size="xl" class="registration__title">
          Registration
        </Typography>
      </div>
      <Form class="registration__body" autocomplete="off" @submit="onSubmit()">
        <TextInput
          @keydown="focusNextField"
          :is-disabled="isSubmitting"
          v-bind="usernameProps"
          v-model="username"
          required
          :has-error-space="true"
          :error-message="errors.username"
          placeholder="Username"
          autocomplete="username"
        >
          <Typography color="primary">
            Username
            <Typography tag-name="span" size="xs" color="error">*</Typography>
          </Typography>
        </TextInput>
        <TextInput
          @keydown="focusNextField"
          :is-disabled="isSubmitting"
          v-bind="emailProps"
          v-model="email"
          required
          :has-error-space="true"
          :error-message="errors.email"
          name="email"
          autocomplete="off"
          placeholder="Email"
        >
          <Typography color="primary">
            Email
            <Typography tag-name="span" size="xs" color="error">*</Typography>
          </Typography>
        </TextInput>
        <TextInput
          :type="visiblePassword ? 'text' : 'password'"
          @keydown="focusNextField"
          :is-disabled="isSubmitting"
          v-bind="passwordProps"
          v-model="password"
          :has-error-space="true"
          name="password"
          required
          autocomplete="new-password"
          :error-message="errors.password"
          placeholder="Password"
        >
          <Typography color="primary">
            Password
            <Typography tag-name="span" size="xs" color="error">*</Typography>
          </Typography>
          <template #right-icon>
            <Button
              button-label="show password"
              size="s"
              color="shadow"
              class="password-toggle"
              @click.prevent="visiblePassword = !visiblePassword"
              type="button"
            >
              <template #left-icon>
                <Icon :icon="visiblePassword ? 'mdi:eye-off' : 'mdi:eye'" width="24" />
              </template>
            </Button>
          </template>
        </TextInput>
        <TextInput
          :type="visiblePasswordRepeat ? 'text' : 'password'"
          @keydown="focusNextField"
          :is-disabled="isSubmitting"
          v-bind="passwordConfirmationProps"
          v-model="passwordConfirmation"
          :has-error-space="true"
          name="passwordConfirmation"
          autocomplete="new-password"
          required
          :error-message="errors.passwordConfirmation"
          placeholder="Confirm password"
        >
          <Typography color="primary">
            Repeat password
            <Typography tag-name="span" size="xs" color="error">*</Typography>
          </Typography>
          <template #right-icon>
            <Button
              button-label="show password repeat"
              size="s"
              color="shadow"
              class="password-toggle"
              @click.prevent="visiblePasswordRepeat = !visiblePasswordRepeat"
              type="button"
            >
              <template #left-icon>
                <Icon :icon="visiblePasswordRepeat ? 'mdi:eye-off' : 'mdi:eye'" width="24" />
              </template>
            </Button>
          </template>
        </TextInput>
        <Button type="submit" class="registration__submit" :is-loading="isSubmitting">
          Create
        </Button>
      </Form>
      <div class="registration__footer">
        <Typography tag-name="p" color="primary" size="xs">
          Has account?
          <router-link to="/login" class="registration__link">Login</router-link>
        </Typography>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { Typography } from '@/shared/ui/typography'
  import { TextInput } from '@/shared/ui/input'
  import { Button } from '@/shared/ui/button'
  import { Form, useForm } from 'vee-validate'
  import * as yup from 'yup'
  import { useAlertStore } from '@/entities/alert'
  import { AlertType } from '@/entities/alert/types/alertData'
  import { CaptchaModal } from '@/features/modal/captcha'
  import { useModal } from '@/entities/modal/model/store'
  import { ref, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import { emailReg, passwordReg, usernameReg } from '@/shared/lib/helpers/validation'
  import { focusNextField } from '@/shared/lib/helpers/forms'
  import { Icon } from '@iconify/vue'

  const router = useRouter()
  const alertStore = useAlertStore()
  const modalStore = useModal()
  const visiblePassword = ref(false)
  const visiblePasswordRepeat = ref(false)
  const schema = yup.object({
    username: yup
      .string()
      .matches(
        usernameReg,
        'Username must contain only Latin letters, numbers, underscores, or dashes'
      )
      .min(3, 'Min 3 characters for username')
      .max(16, 'Max 16 characters for username')
      .required('Username is required'),
    email: yup.string().matches(emailReg, 'Email must be correct').required('Email is required'),
    password: yup
      .string()
      .matches(
        passwordReg,
        'Password must contain only Latin letters, numbers, and special characters'
      )
      .min(8, 'Password must be at least 8 characters')
      .required('Password is required'),
    passwordConfirmation: yup
      .string()
      .oneOf([yup.ref('password')], 'Passwords do not match')
      .required('Password confirmation is required')
  })

  const { handleSubmit, errors, defineField } = useForm({
    validationSchema: schema
  })

  const [email, emailProps] = defineField('email')
  const [username, usernameProps] = defineField('username')
  const [password, passwordProps] = defineField('password')
  const [passwordConfirmation, passwordConfirmationProps] = defineField('passwordConfirmation')

  const isSubmitting = ref(false)
  const captchaToken = ref('')

  const onSubmit = handleSubmit(async (values) => {
    if (isSubmitting.value) return
    isSubmitting.value = true
    console.log(values)
    try {
      modalStore.open(CaptchaModal, 'center', 'center', true, {
        onVerified: handleCaptchaVerified,
        onError: handleCaptchaError,
        onExpired: handleCaptchaExpired
      })
    } catch (error) {
      console.error('Error opening captcha modal:', error)
      alertStore.addAlert({
        type: AlertType.Error,
        title: 'Error',
        msg: 'An error occurred. Please try again.',
        duration: 3000
      })
      isSubmitting.value = false
    } finally {
      isSubmitting.value = false
      captchaToken.value = ''
    }
  })

  const handleCaptchaVerified = (token: string) => {
    captchaToken.value = token
    modalStore.close()
    submitForm(token).catch(() => {
      isSubmitting.value = false
    })
  }

  const handleCaptchaError = () => {
    isSubmitting.value = false
    alertStore.addAlert({
      type: AlertType.Error,
      title: 'Error',
      msg: 'CAPTCHA verification failed. Please try again.',
      duration: 3000
    })
  }

  const handleCaptchaExpired = () => {
    isSubmitting.value = false
    alertStore.addAlert({
      type: AlertType.Warning,
      title: 'Warning',
      msg: 'CAPTCHA expired. Please try again.',
      duration: 3000
    })
  }

  const submitForm = async (token: string) => {
    if (isSubmitting.value) return

    try {
      isSubmitting.value = true
      const formData = {
        username: username.value,
        email: email.value,
        password: password.value,
        captchaToken: token
      }

      const response = await mockApiResponse(formData)
      console.log('response:', response)

      if (response.status === 201) {
        alertStore.addAlert({
          type: AlertType.Success,
          title: 'Success',
          msg: 'Registration successful',
          duration: 3000
        })
        username.value = ''
        email.value = ''
        password.value = ''
        passwordConfirmation.value = ''
        router.push('/login')
      } else {
        alertStore.addAlert({
          type: AlertType.Error,
          title: 'Error',
          msg: response.data.error || 'Registration failed. Please try again.',
          duration: 5000
        })
      }
    } catch (error) {
      console.error('Registration error:', error)
      alertStore.addAlert({
        type: AlertType.Error,
        title: 'Error',
        msg: 'Registration failed. Please try again.',
        duration: 5000
      })
    } finally {
      isSubmitting.value = false
      captchaToken.value = ''
    }
  }

  const mockApiResponse = async (formData: any) => {
    console.log('mockApiResponse:', mockApiResponse)

    await new Promise((resolve) => setTimeout(resolve, 1500)) // Simulate API delay

    if (formData.username === 'admin' || formData.email === 'admin@example.com') {
      return { status: 400, data: { error: 'Username or email already exists' } }
    }

    if (formData.captchaToken.length < 10) {
      return { status: 400, data: { error: 'Invalid captcha token' } }
    }

    return { status: 201, data: {} }
  }

  watch(
    () => modalStore.isOpen,
    (isOpen) => {
      if (!isOpen && captchaToken.value) {
        submitForm(captchaToken.value)
      }
    }
  )
</script>

<style scoped lang="scss">
  .registration {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    max-width: 359px;
    padding: 20px;
    background-color: var(--bg-color);
    border: 2px solid var(--sub-alt-color);
    border-radius: var(--border-radius);

    &__body {
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    &__wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      margin: 0 auto;
    }

    &__header {
      text-align: center;
    }

    &__title {
      margin-bottom: 0;
    }

    &__popper,
    &__sumbit {
      width: 100% !important;
    }
  }
</style>
