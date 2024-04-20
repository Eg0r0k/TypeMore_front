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
</style>
<template>
   <Header />

   <div class="wrapper">

      <form action="" novalidate @submit.prevent="test">
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
         <Typography color="primary" size="s">No accaunt? <Typography tag-name="p" color="main" decoration="underline">
               Create</Typography>
         </Typography>
      </div>
      <RecaptchaV2 @widget-id="handleWidgetId" @error-callback="handleErrorCalback"
         @expired-callback="handleExpiredCallback" @load-callback="handleLoadCallback" />
   </div>

   <PopUp />
   <Footer />
</template>

<script setup lang="ts">

import { Button } from '@/shared/ui/button';
import { Container } from '@/shared/ui/container'
import { PopUp } from '@/features/popup';
import { ref, onMounted } from 'vue';
import { Header } from '@/widgets/header';
import { Footer } from '@/widgets/footer';
import { Icon } from '@iconify/vue'
import { Typography } from '@/shared/ui/typography';
import { TextInput } from '@/shared/ui/input';
import * as yup from 'yup';
import { useForm } from 'vee-validate';
import { RecaptchaV2 } from 'vue3-recaptcha-v2';
import { useResolvedPopUp } from '@/shared/lib/hooks/useResolvedPopUp';


const openConfirmPopup = async () => {
   const result = await useResolvedPopUp(PopUp, true);
   if (result) {
      console.log('Пользователь подтвердил действие');
      // Выполнить действия при подтверждении
   } else {
      console.log('Пользователь отменил действие');
      // Выполнить действия при отмене
   }
};
const handleWidgetId = (widgetId: number) => {
   console.log("Widget ID: ", widgetId);
};
const handleErrorCalback = () => {
   console.log("Error callback");
};
const handleExpiredCallback = () => {
   console.log("Expired callback");
};
const handleLoadCallback = (response: unknown) => {
   console.log("Load callback", response);
};

function findDuplicates(words: Array<string>): Array<any> {
   const wordFrequencies: any = {};
   const duplicates: Array<any> = [];

   words.forEach((word: string) => {
      wordFrequencies[word] =
         word in wordFrequencies ? wordFrequencies[word] + 1 : 1;

      if (wordFrequencies[word] === 2) {
         duplicates.push(word);
      }
   });
   return duplicates;
}
const words = ref<string[]>([]);
onMounted(async () => {
   try {
      const response = await fetch('./src/static/japanese-words.json');
      const data = await response.json();
      words.value = data.words;
   } catch (error) {
      console.error('Ошибка при загрузке данных:', error);
   }
});

const { errors, defineField } = useForm({
   validationSchema: yup.object({
      username: yup.string().min(4).max(16).required(),
      email: yup.string().email().required(),
      password: yup.string().min(6).max(16).required()
   }),
});
const [email, emailProps] = defineField('email', {
   props: state => ({
      error: state.errors[0],
   }),
});
const [username, usernameProps] = defineField('username', {
   props: state => ({
      error: state.errors[0],
   }),
});
const [password, passwordProps] = defineField('password', {
   props: state => ({
      error: state.errors[0],
   }),
});


const test = () => {
   console.log(email.value);
}
const root: HTMLElement | null = document.querySelector(':root')

type Theme = { [key: string]: string }
type Themes = { [key: string]: Theme }
const themes: Themes = {

   Theme1:
   {
      '--bg-color': '#fff9f2',
      '--main-color': '#55c6f0',
      '--sub-color': '#1e107a',
      '--sub-alt-color': '#e5ddd4',
      '--text-color': '#1d1e1e',
      '--error-color': '#fb5745',
      '--error-extra-color': '#b03c30',
   },
   Theme2:
   {
      '--bg-color': '#f37f83',
      '--main-color': '#fcfcf8',
      '--sub-color': '#e53c58',
      '--sub-alt-color': '#ef6e77',
      '--text-color': '#fff',
      '--error-color': '#fcd23f',
      '--error-extra-color': '#d7ae1e',
   },
   Theme3:
   {
      '--bg-color': '#f2aa00',
      '--main-color': '#fff546',
      '--sub-color': '#a66b00',
      '--sub-alt-color': '#e19e00',
      '--text-color': '#f3eecb',
      '--error-color': '#df3333',
      '--error-extra-color': '#6d1f1f',
   },
   Theme4:
   {
      '--bg-color': '#e8f7f7',
      '--main-color': '#1e656d',
      '--sub-color': '#13a0a0',
      '--sub-alt-color': '#c1e1e1',
      '--text-color': '#2b2b2b',
      '--error-color': '#ff4d4d',
      '--error-extra-color': '#cc0000',
   },
   Theme5:
   {
      '--bg-color': '#f0f0f0',
      '--main-color': '#595959',
      '--sub-color': '#808080',
      '--sub-alt-color': '#b3b3b3',
      '--text-color': '#1a1a1a',
      '--error-color': '#ff6666',
      '--error-extra-color': '#e60000',
   },
   Theme6:
   {
      '--bg-color': '#c9e8e8',
      '--main-color': '#005959',
      '--sub-color': '#008080',
      '--sub-alt-color': '#73b3b3',
      '--text-color': '#002b2b',
      '--error-color': '#ff9999',
      '--error-extra-color': '#cc0000',
   },
   Theme7:
   {
      '--bg-color': '#f9f9f9',
      '--main-color': '#4c4c4c',
      '--sub-color': '#8c8c8c',
      '--sub-alt-color': '#d1d1d1',
      '--text-color': '#1f1f1f',
      '--error-color': '#ff7f50',
      '--error-extra-color': '#ff4500',
   },
   Theme8:
   {
      '--bg-color': '#f5f5f5',
      '--main-color': '#333333',
      '--sub-color': '#666666',
      '--sub-alt-color': '#999999',
      '--text-color': '#000000',
      '--error-color': '#cc0000',
      '--error-extra-color': '#ff3300',
   },
   Theme9:
   {
      '--bg-color': '#c2e0c6',
      '--main-color': '#006400',
      '--sub-color': '#008000',
      '--sub-alt-color': '#9acd32',
      '--text-color': '#002200',
      '--error-color': '#ff6347',
      '--error-extra-color': '#ff4500',
   },
   Theme10:
   {
      '--bg-color': '#dcdcdc',
      '--main-color': '#2f4f4f',
      '--sub-color': '#708090',
      '--sub-alt-color': '#a9a9a9',
      '--text-color': '#000000',
      '--error-color': '#ff0000',
      '--error-extra-color': '#b22222',
   },
   Theme11:
   {
      '--bg-color': '#f0e68c',
      '--main-color': '#8b4513',
      '--sub-color': '#cd853f',
      '--sub-alt-color': '#deb887',
      '--text-color': '#000000',
      '--error-color': '#dc143c',
      '--error-extra-color': '#800000',
   },
}
const default1 = {
   theme: {
      '--bg-color': '#f2aa00',
      '--main-color': '#fff546',
      '--sub-color': '#a66b00',
      '--sub-alt-color': '#e19e00',
      '--text-color': '#f3eecb',
      '--error-color': '#df3333',
      '--error-extra-color': '#6d1f1f',
   }
}
const selectedTheme = ref<Theme>(default1.theme);

const changeTheme = (themeKey: string | number) => {
   selectedTheme.value = themes[themeKey]
   setVariables(selectedTheme.value)
}


const setVariables = (selectedTheme: Theme): void => {
   Object.entries(selectedTheme).forEach(el => root?.style.setProperty(el[0], el[1]));
};






</script>
@/shared/ui/button@/shared/ui/container@/shared/ui/typography@/shared/ui/input