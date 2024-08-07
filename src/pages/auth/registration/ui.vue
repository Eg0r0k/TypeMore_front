<template>
  <div class="registration__wrapper">
    <div class="registration">
      <div class="registration__header">
        <Typography color="main" tag-name="h2" size="xl" class="registration__title">Registration</Typography>
        <Typography color="primary" size="m">Fill in all fields to register</Typography>
      </div>
      <Form class="login__body" autocomplete="off" @submit="onSubmit()">
        <TextInput required v-bind="usernameProps" v-model="username" :error-message="errors.username"
          placeholder="Username">
          <Typography color="primary">Username<Typography tagName="span" size="xs" color="error">*</Typography>
          </Typography>
        </TextInput>
        <TextInput required v-bind="emailProps" v-model="email" :error-message="errors.email" name="email"
          placeholder="Email">
          <Typography color="primary">Email<Typography tagName="span" size="xs" color="error">*</Typography>
          </Typography>
        </TextInput>
        <TextInput type="password" v-bind="passwordProps" v-model="password" name="password" required
          :error-message="errors.password" placeholder="Password">
          <Typography color="primary">Password<Typography tagName="span" size="xs" color="error">*</Typography>
          </Typography>
        </TextInput>
        <TextInput type="password" v-bind="passwordConfirmationProps" v-model="passwordConfirmation"
          name="passwordConfirmation" required :error-message="errors.passwordConfirmation"
          placeholder="Confirm password">
          <Typography color="primary">Repeat password<Typography tagName="span" size="xs" color="error">*</Typography>
          </Typography>
        </TextInput>
        <Button type="submit" class="registration__submit" :isLoading="isSubmitting">Create</Button>
      </Form>
      <div class="registration__footer">
        <Typography tag-name="p" color="primary">Has account?
          <router-link to="/login" class="registration__link">Login</router-link>
        </Typography>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Typography } from '@/shared/ui/typography';
import { TextInput } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';
import { Form, useForm } from 'vee-validate';
import * as yup from 'yup';
import { useAlertStore } from '@/entities/alert/model';
import { AlertType } from '@/entities/alert/model/types/alertData';
import { CaptchaModal } from '@/features/modal/captcha';
import { useModal } from '@/entities/modal/model/store';
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';

const router = useRouter();
const alertStore = useAlertStore();
const modalStore = useModal();

const emailReg = new RegExp(/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/);

const schema = yup.object({
  username: yup.string().min(3).max(16).required('Username required'),
  email: yup.string().matches(emailReg, 'Email must be correct').required('Email is required'),
  password: yup.string().min(6, 'Password must be at least 6 characters').required('Password is required'),
  passwordConfirmation: yup.string().oneOf([yup.ref('password')], 'Passwords do not match').required('Password confirmation is required'),
});

const { handleSubmit, errors, defineField } = useForm({
  validationSchema: schema,
});

const [email, emailProps] = defineField('email');
const [username, usernameProps] = defineField('username');
const [password, passwordProps] = defineField('password');
const [passwordConfirmation, passwordConfirmationProps] = defineField('passwordConfirmation');

const isSubmitting = ref(false);
const captchaToken = ref('');

const onSubmit = handleSubmit(async (values) => {
  console.log('onSubmit:', onSubmit); // Add this line to check if handleSubmit is called
  console.log('values:', values); // Add this line to check if values are being passed

  if (isSubmitting.value) return;
  isSubmitting.value = true;

  try {
    modalStore.open(CaptchaModal, [], 'center', 'center', true, {
      onVerified: handleCaptchaVerified,
      onError: handleCaptchaError,
      onExpired: handleCaptchaExpired,
    });
  } catch (error) {
    console.error('Error opening captcha modal:', error);
    alertStore.addAlert({
      type: AlertType.Error,
      title: "Error",
      msg: "An error occurred. Please try again.",
      duration: 3000
    });
    isSubmitting.value = false;
  }
  finally {
    isSubmitting.value = false;
    captchaToken.value = '';
  }
});

const handleCaptchaVerified = (token: string) => {
  captchaToken.value = token;
  modalStore.close();
  submitForm(token).catch(() => {
    isSubmitting.value = false;
  });
};

const handleCaptchaError = () => {
  isSubmitting.value = false;
  alertStore.addAlert({
    type: AlertType.Error,
    title: "Error",
    msg: "CAPTCHA verification failed. Please try again.",
    duration: 3000
  });
};

const handleCaptchaExpired = () => {
  isSubmitting.value = false;
  alertStore.addAlert({
    type: AlertType.Warning,
    title: "Warning",
    msg: "CAPTCHA expired. Please try again.",
    duration: 3000
  });
};

const submitForm = async (token: string) => {
  console.log('submitForm:', submitForm); // Add this line to check if submitForm is called
  if (isSubmitting.value) return;

  try {
    isSubmitting.value = true;
    const formData = {
      username: username.value,
      email: email.value,
      password: password.value,
      captchaToken: token
    };
    console.log('formData:', formData); // Log formData before the API call

    const response = await mockApiResponse(formData);
    console.log('response:', response); // Log response inside the promise

    if (response.status === 201) {
      alertStore.addAlert({
        type: AlertType.Success,
        title: "Success",
        msg: "Registration successful",
        duration: 3000
      });
      username.value = '';
      email.value = '';
      password.value = '';
      passwordConfirmation.value = '';
      router.push('/login');
    } else {
      alertStore.addAlert({
        type: AlertType.Error,
        title: "Error",
        msg: response.data.error || "Registration failed. Please try again.",
        duration: 5000
      });
    }
  } catch (error) {
    console.error('Registration error:', error);
    alertStore.addAlert({
      type: AlertType.Error,
      title: "Error",
      msg: "Registration failed. Please try again.",
      duration: 5000
    });
  } finally {
    isSubmitting.value = false;
    captchaToken.value = '';
  }
};

// Mock API response function
const mockApiResponse = async (formData: any) => {
  console.log('mockApiResponse:', mockApiResponse); // Add this line to check if mockApiResponse is called

  await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API delay

  if (formData.username === 'admin' || formData.email === 'admin@example.com') {
    return { status: 400, data: { error: 'Username or email already exists' } };
  }

  if (formData.captchaToken.length < 10) {
    return { status: 400, data: { error: 'Invalid captcha token' } };
  }

  return { status: 201, data: {} }; // Successful registration
};

watch(() => modalStore.isOpen, (isOpen) => {
  if (!isOpen && captchaToken.value) {
    submitForm(captchaToken.value);
  }
});

</script>

<style scoped lang="scss">
.registration {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
  max-width: 359px;
  padding: 32px;
  border: 2px solid var(--sub-alt-color);
  border-radius: var(--border-radius);

  &__body {
    display: flex;
    flex-direction: column;
    gap: 12px;
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
    margin-bottom: 8px;
  }

  &__popper,
  &__sumbit {
    width: 100%;
  }
}
</style>
