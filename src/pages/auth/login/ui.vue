<template>
  <div class="login__wrapper">
    <div class="login">
      <div class="login__header">
        <Typography color="main" tag-name="h2" size="xl" class="login__title">Login</Typography>
      </div>
      <Form class="login__body" autocomplete="off" @submit="onSubmit()">
        <TextInput
          @keydown="focusNextField"
          v-bind="usernameProps"
          v-model="username"
          :has-error-space="true"
          required
          placeholder="Username"
          autocomplete="username"
          :error-message="errors.username"
          name="username"
        >
          <Typography color="primary">
            Username
            <Typography tag-name="span" size="xs" color="error">*</Typography>
          </Typography>
        </TextInput>

        <TextInput
          @keydown="focusNextField"
          v-bind="passwordProps"
          v-model="password"
          :has-error-space="true"
          :error-message="errors.password"
          :type="visiblePassword ? 'text' : 'password'"
          placeholder="Password"
          label="Password*"
          autocomplete="new-password"
          name="password"
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

        <Button type="submit" class="login__sumbit">Login</Button>
      </Form>

      <div class="divider">
        <Typography color="main">or</Typography>
      </div>
      <div class="other login__other">
        <Button
          button-label="login with google"
          color="gray"
          class="other__button other__button--google"
        >
          <template #left-icon>
            <Icon width="24" icon="ri:google-fill"></Icon>
          </template>
        </Button>
        <Button
          button-label="login with github"
          color="gray"
          class="other__button other__button--github"
        >
          <template #left-icon>
            <Icon width="24" icon="mdi:github"></Icon>
          </template>
        </Button>
      </div>
      <div class="login__footer">
        <Typography tag-name="p" color="primary" size="xs">
          No account?
          <router-link to="/registration" class="login__link">Create</router-link>
        </Typography>

        <Button size="s" color="shadow" @click="openResetModal">
          <Typography class="login__link" color="sub" size="xs" role="button">
            forgot password?
          </Typography>
        </Button>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
  import { Icon } from '@iconify/vue'
  import { Typography } from '@shared/ui/typography'
  import { TextInput } from '@shared/ui/input'
  import { Button } from '@shared/ui/button'
  import { Form, useForm } from 'vee-validate'
  import * as yup from 'yup'
  import { useAlertStore } from '@/entities/alert'
  import { AlertType } from '@/entities/alert/types/alertData'
  import { useAuthStore } from '@/entities/auth/model/store'
  import { useModal } from '@/entities/modal'
  import { ResetModal } from '@/features/modal/reset'
  import { focusNextField } from '@/shared/lib/helpers/forms'
  import { passwordReg, usernameReg } from '@/shared/lib/helpers/validation'
  import { ref } from 'vue'

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
    password: yup
      .string()
      .matches(
        passwordReg,
        'Password must contain only Latin letters, numbers, and special characters'
      )
      .min(8, 'Password must be at least 8 characters')
      .required('Password is required')
  })
  const { handleSubmit, errors, defineField } = useForm({
    validationSchema: schema
  })
  const visiblePassword = ref(false)

  const modalStore = useModal()
  const authStore = useAuthStore()
  const alertStore = useAlertStore()
  const [username, usernameProps] = defineField('username')
  const [password, passwordProps] = defineField('password')
  const openResetModal = () => {
    modalStore.open(ResetModal, 'center', 'center')
  }
  const onSubmit = handleSubmit(
    async () => {
      try {
        await authStore.login({ username: username.value, password: password.value })
        alertStore.addAlert({
          type: AlertType.Success,
          title: 'Success',
          msg: 'Login successful',
          duration: 1500
        })
      } catch (error) {
        console.error('Login error:', error)
        alertStore.addAlert({
          type: AlertType.Error,
          title: 'Login Failed',
          msg: 'Invalid email or password',
          duration: 0
        })
      }
    },
    (errors) => {
      console.error(errors)
      alertStore.addAlert({
        type: AlertType.Error,
        title: 'WTF',
        msg: 'Please fill all fields correctly',
        duration: 0
      })
    }
  )
</script>

<style scoped lang="scss">
  .other {
    display: flex;
    gap: 12px;

    &__button {
      width: 100%;
    }
  }

  .divider {
    position: relative;
    display: flex;
    justify-content: center;
  }

  .login {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    max-width: 359px;
    padding: 20px;
    background-color: var(--bg-color);
    border: 2px solid var(--sub-alt-color);
    border-radius: var(--border-radius);

    &__header {
      text-align: center;
    }

    &__body {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    &__footer {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
    }

    &__title {
      margin-bottom: 0;
    }

    &__sumbit {
      width: 100%;
    }

    &__link {
      user-select: none;
      transition: all var(--transition-duration);

      &:hover {
        color: var(--main-color);
        cursor: pointer;
      }
    }

    &__wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
    }
  }
</style>
