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
          :is-disabled="isSubmitting"
          v-bind="passwordProps"
          v-model="password"
          type="password"
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
        </TextInput>
        <TextInput
          :is-disabled="isSubmitting"
          v-bind="passwordConfirmationProps"
          v-model="passwordConfirmation"
          type="password"
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
  import { emailReg } from '@/shared/lib/helpers/validation'

  const router = useRouter()
  const alertStore = useAlertStore()
  const modalStore = useModal()

  const schema = yup.object({
    username: yup
      .string()
      .min(3, 'Username min 3 characters')
      .max(16, 'Username max 16 characters')
      .required('Username required'),
    email: yup.string().matches(emailReg, 'Email must be correct').required('Email is required'),
    password: yup.string().min(6, 'Min 6 characters for password').required('Password is required'),
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
    border: 2px solid var(--sub-alt-color);
    border-radius: var(--border-radius);

    &__body {
      display: flex;
      flex-direction: column;
      gap: 0px;
    }

    &__wrapper {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
      margin: 0 auto;
    }

    &__header {
      text-align: center;
    }

    &__title {
      margin-bottom: 0px;
    }

    &__popper,
    &__sumbit {
      width: 100% !important;
    }
  }
</style>
