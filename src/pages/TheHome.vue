<style lang="scss" scoped></style>
<template>
  <div>
    <Typography class="test" size="s" color="primary" dir="auto">{{ input }}</Typography>
    <!-- <form action="" novalidate @submit.prevent="test">
        <Button color="gray" size="l">Login</Button>
      </form>
      <div class="test">
        <div class="test__header">
          <Typography class="test__title" tag-name="h3" :color="'main'" size="xl">Registration</Typography>
          <Typography color="primary" size="m">Fill in all fields to register</Typography>
        </div>
        <form class="test__from">
          <div>
            <TextInput :placeholder="'Username'" v-model="username" :usernameProps />
            <Typography tag-name="span" color="error">{{ errors.username }}</Typography>
          </div>
          <div>
            <TextInput :placeholder="'Email'" v-model="email" :emailProps />
            <Typography tag-name="span" color="error">{{ errors.email }}</Typography>
          </div>
          <div>
            <TextInput :placeholder="'Password'" v-model="password" :passwordProps />
            <Typography tag-name="span" color="error">{{ errors.password }}</Typography>
          </div>
        </form>
  
        <Button @click="openConfirmPopup">Goggle</Button>
        <Button color="main" :isLoading="false">Create</Button>
        <Typography color="primary" size="s">No accaunt?
          <Typography tag-name="p" color="main" decoration="underline"> Create</Typography>
        </Typography>
      </div>
      <RecaptchaV2 @widget-id="handleWidgetId" @error-callback="handleErrorCalback"
        @expired-callback="handleExpiredCallback" @load-callback="handleLoadCallback" /> -->
    <TestChart />
    <input type="text" @keyup="handleKeyup" v-model="input" dir="auto">
    <button></button>
  </div>

</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Typography } from '@shared/ui/typography'
import * as yup from 'yup'
import { useForm } from 'vee-validate'
import { RecaptchaV2 } from 'vue3-recaptcha-v2'
import { TestChart } from '../shared/ui/chart'









const input = ref('');
const startTime = ref(0);
const timer = ref();
const handleKeyup = (event: any) => {
  if (timer.value) {
    startTime.value = performance.now()
    timer.value = setInterval(() => {
      console.log(`Typing ${Math.floor(performance.now() - startTime.value)}ms`)
    }, 100)
  }
  console.log(`Key pressed: ${event.key} at ${Math.floor(performance.now() - startTime.value)}ms`)
}


const handleWidgetId = (widgetId: number) => {
  console.log('Widget ID: ', widgetId)
}
const handleErrorCalback = () => {
  console.log('Error callback')
}
const handleExpiredCallback = () => {
  console.log('Expired callback')
}
const handleLoadCallback = (response: unknown) => {
  console.log('Load callback', response)
}

function findDuplicates(words: Array<string>): Array<any> {
  const wordFrequencies: any = {}
  const duplicates: Array<any> = []

  words.forEach((word: string) => {
    wordFrequencies[word] = word in wordFrequencies ? wordFrequencies[word] + 1 : 1

    if (wordFrequencies[word] === 2) {
      duplicates.push(word)
    }
  })
  return duplicates
}
const words = ref<string[]>([])


const { errors, defineField } = useForm({
  validationSchema: yup.object({
    username: yup.string().min(4).max(16).required(),
    email: yup.string().email().required(),
    password: yup.string().min(6).max(16).required()
  })
})
const [email, emailProps] = defineField('email', {
  props: (state) => ({
    error: state.errors[0]
  })
})
const [username, usernameProps] = defineField('username', {
  props: (state) => ({
    error: state.errors[0]
  })
})
const [password, passwordProps] = defineField('password', {
  props: (state) => ({
    error: state.errors[0]
  })
})



</script>
