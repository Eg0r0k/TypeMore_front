<style lang="scss" scoped>
.test {
  max-width: 350px;
  border-radius: var(--border-radius);
  background-color: var(--sub-alt-color);
  display: flex;
  justify-content: center;
  flex-direction: column;
  padding: 32px;

  &__header {
    display: flex;
    flex-direction: column;
    justify-content: center;
    margin-bottom: 35px;
    text-align: center;
  }

  &__title {
    margin-bottom: 8px;
  }
}

.wrapper {
  height: 100%;
  max-width: 1532px;
  width: 100%;
  margin: 0 auto;
}

.test__from {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin-bottom: 35px;
}

.cot {
  height: 204px;
  overflow: hidden;
  display: flex;
  flex-wrap: wrap;
  width: 100%;
  color: white;
  align-content: flex-start;
  //user-select: none;
}

.word {
  font-size: 1.7em;
  line-height: 1.7em;
  position: relative;
  font-variant: no-common-ligatures;
  margin: 4px;
}

.letter {
  color: var(--text-color);
}
</style>
<template>
  <div>
    <Typography size="s" color="primary" dir="auto">{{ input }}</Typography>
    <div class="cot">
      <div class="word" v-for="word in words" :key="word">
        <span class="letter" v-for="letter in word" :key="letter">
          {{ letter }}
        </span>
      </div>

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
    </div>

    <input type="text" @keyup="handleKeyup" v-model="input" dir="auto">
  </div>

</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Typography } from '@shared/ui/typography'
import { TextInput } from '@/shared/ui/input'
import * as yup from 'yup'
import { useForm } from 'vee-validate'
import { RecaptchaV2 } from 'vue3-recaptcha-v2'
import { useResolvedPopUp } from '@shared/lib/hooks/useResolvedPopUp'
import { useWordGeneratorStore } from '@/entities/generator/store'

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
onMounted(async () => {
  try {
    const response = await fetch('./src/static/russian-words.json')
    const data = await response.json()
    words.value = data.words
  } catch (error) {
    console.error('Ошибка при загрузке данных:', error)
  }
})

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
