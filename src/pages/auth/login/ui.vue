<template>
  <div class="login__wrapper">
    <div class="login">
      <div class="login__header">
        <Typography color="main" tag-name="h2" size="xl" class="login__title">Login</Typography>
      </div>
      <Form class="login__body" autocomplete="off" @submit="onSubmit()">
        <TextInput
          v-bind="emailProps"
          v-model="email"
          :has-error-space="true"
          required
          placeholder="Email"
          :error-message="errors.email"
          name="email"
        >
          <Typography color="primary"
            >Email<Typography tag-name="span" size="xs" color="error">*</Typography>
          </Typography>
        </TextInput>

        <TextInput
          v-bind="passwordProps"
          v-model="password"
          :has-error-space="true"
          :error-message="errors.password"
          type="password"
          placeholder="Password"
          label="Password*"
          name="password"
        >
          <Typography color="primary"
            >Password<Typography tag-name="span" size="xs" color="error">*</Typography>
          </Typography>
        </TextInput>

        <Button type="submit" class="login__sumbit">Login</Button>
      </Form>

      <div class="divider">
        <Typography color="main">or</Typography>
      </div>
      <div class="other login__other">
        <Button color="gray" class="other__button other__button--google">
          <template #left-icon>
            <Icon width="24" icon="ri:google-fill"></Icon>
          </template>
          Google
        </Button>
        <Button color="gray" class="other__button other__button--github">
          <template #left-icon>
            <Icon width="24" icon="mdi:github"></Icon>
          </template>
          GitHub
        </Button>
      </div>
      <div class="login__footer">
        <Typography tag-name="p" color="primary"
          >No account?
          <router-link to="/registration" class="login__link">Create</router-link>
        </Typography>
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
import { useAlertStore } from '@/entities/alert/model'
import { AlertType } from '@/entities/alert/model/types/alertData'
const emailReg = new RegExp(
  /^(([^<>()[]+(\.[^<>()[]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
)
const schema = yup.object({
  email: yup.string().matches(emailReg, 'Email must be correct').required('Email is required'),
  password: yup.string().min(6, 'Min 6 characters for password').required('Password is required')
})
const { handleSubmit, errors, defineField } = useForm({
  validationSchema: schema
})

const alertStore = useAlertStore()
const [email, emailProps] = defineField('email', {
  validateOnModelUpdate: false
})
const [password, passwordProps] = defineField('password', {
  validateOnModelUpdate: false
})

const onSubmit = handleSubmit(
  () => {
    alertStore.addAlert({
      type: AlertType.Success,
      title: 'Success',
      msg: 'Form submitted successfully',
      duration: 1500
    })
  },
  (errors) => {
    console.log(errors)
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
  flex-direction: column;
  gap: 12px;

  &__button {
    width: 100%;
  }
}

.divider {
  display: flex;
  position: relative;
  justify-content: center;
}

.login {
  width: 100%;
  max-width: 359px;
  display: flex;
  flex-direction: column;
  padding: 32px;
  border: 2px solid var(--sub-alt-color);
  border-radius: var(--border-radius);
  gap: 24px;

  &__header {
    text-align: center;
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  &__title {
    margin-bottom: 8px;
  }

  &__sumbit {
    width: 100%;
  }

  &__wrapper {
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
  }
}
</style>
