<template>
  <Transition name="fade" mode="out-in">
    <div v-if="!testState.isLoading" class="wrapper" role="main">
      <FpsIndecator v-if="configStore.config.showFps" />
      <Header />
   
      <main>
        <router-view v-slot="{ Component, route }">
          <transition name="fade" mode="out-in">
            <component :is="Component" :key="route.path" />
          </transition>
        </router-view>
      </main>
      <Footer />
      <Alerts />

      <ModalWindow />
    </div>
    <div v-else class="loader-wrapper wrapper" role="loading">
      <header class="loader-wrapper__header">
        <Logo />
      </header>
      <div class="loader-wrapper__body">
        <div>
          <div class="loader"></div>
        </div>
      </div>
      <footer class="loader-wrapper__footer"></footer>
    </div>
  </Transition>
</template>
<script setup lang="ts">
import { Header } from '@/widgets/header'
import { Footer } from '@/widgets/footer'
import { Logo } from '@/shared/ui/logo'
import { FpsIndecator } from '@/widgets/fps'
import { Alerts } from '@/widgets/alerts'
import { useConfigStore } from '@/entities/config/model/store'
import { useTestStateStore } from '@/entities/test'
import { useThemes } from '@/shared/lib/hooks/useThemes'
import { getLangList } from '@/shared/lib/helpers/json-files'
import {
  computed,
  defineAsyncComponent,
  onBeforeMount,
  onMounted,
  onUnmounted,
  provide,
  ref
} from 'vue'
import { CookieModal } from '@/features/modal/cookie'
import { useModal } from '@/entities/modal/model/store'
import { useFavicon } from '@vueuse/core'
const configStore = useConfigStore()
const testState = useTestStateStore()
const ModalWindow = defineAsyncComponent(() => import('@/widgets/modal/ui.vue'))
const { applyTheme, themesList, themesOnUnmounted, refColors } = useThemes()
const { config, setFontFamily } = useConfigStore()
const modalStore = useModal()
const lang = ref()

const test = () => {
  setFontFamily("JetBrainsMono")
}
provide('themes', themesList)
provide('lang', lang)
onBeforeMount(async () => {
  await applyTheme(config.theme)
  document.querySelector('#app')?.classList.remove('hidden')
  const favicon = computed(() => {
    return `data:image/svg+xml;base64,${btoa(`<svg width="23" height="23" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="23" height="23" rx="2.65385" fill="${refColors['--bg-color']}"/>
<path d="M14.404 10.2025C15.5769 9.18228 17.5828 9.75094 18.6367 9.70077C19.1611 9.6758 19.8706 9.05873 19.9843 8.35224M14.404 10.2025C13.294 11.1681 12.0927 11.4445 11.7941 13.4702M14.404 10.2025C14.6189 11.4088 14.3978 13.7512 11.7941 13.4702M11.7941 13.4702C11.7772 13.585 11.7632 13.7055 11.7522 13.832C11.6169 15.3963 12.5188 16.2336 13.2024 16.5121C13.4309 16.6053 13.6721 16.4859 13.8647 16.3317C14.7234 15.6437 16.6482 15.1706 17.036 15.3177C17.1036 15.3433 17.0946 15.4285 17.068 15.4957C16.7857 16.2104 15.8627 17.3906 15.6521 17.7657C15.6152 17.8314 15.6209 17.9055 15.6483 17.9756C15.8773 18.56 16.5821 19.9228 16.4929 19.9263C16.1429 19.9263 16.204 20.0266 15.0991 19.9932C14.1973 19.9659 13.7723 19.3439 13.4802 18.9161C13.3693 18.7536 13.1836 18.6628 12.9872 18.651C7.38619 18.3149 5.82878 14.1752 5.86183 11.0749C5.86252 11.01 5.87648 10.9387 5.83372 10.89C5.59565 10.6185 4.11027 10.2195 3.39034 10.0314C3.14861 9.96818 3.07758 9.79075 3.18983 9.56754C3.66848 8.61582 4.05465 7.6963 6.38152 7.13346C6.57664 7.08626 6.74636 6.95933 6.84796 6.78619C9.7221 1.88841 15.0469 1.80817 17.5423 6.16408C17.6463 6.3456 17.822 6.4777 18.0252 6.52753C19.6626 6.92909 20.0924 7.68102 19.9843 8.35224M13.9621 9.47285C13.5339 10.5694 12.2025 12.5964 10.2277 12.2104C10.1011 12.1857 9.94265 12.1559 9.93807 12.0269C9.93463 11.9301 9.95863 11.774 10.0354 11.5301C10.2121 10.9681 10.517 9.96904 10.6473 9.53975M15.422 7.8003C16.6107 8.16826 19.1873 8.79379 19.9843 8.35224" stroke="${refColors['--main-color']}" stroke-width="1.22778" stroke-linecap="round"/>
<circle cx="13.3888" cy="6.77777" r="0.905112" fill="${refColors['--main-color']}" stroke="${refColors['--main-color']}" stroke-width="0.0786642"/>
</svg>
`)}`
  })
  useFavicon(favicon)
})

onMounted(async () => {
  lang.value = await getLangList()
  setFontFamily(config.fontFamily)
  if (!localStorage.getItem('cookieConsentGiven')) {
    modalStore.open(CookieModal, 'bottom', 'right', false)
  }
})
onUnmounted(() => {
  themesOnUnmounted()
})
</script>
<style lang="scss">
.fade-enter-active,
.fade-leave-active {
  transition: all 0.125s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.loader {
  min-width: 40px;
  min-height: 40px;
  border: 4px solid var(--main-color);

  border-bottom-color: var(--bg-color);
  border-radius: 100%;
  display: inline-block;
  box-sizing: border-box;
  animation: rotation 1.5s linear infinite;
}

.loader-wrapper {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 20px;
  justify-content: center;
  align-items: center;

  &__header {
    display: flex;
    width: 100%;
  }

  &__body {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
  }
}

@keyframes rotation {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.wrapper {
  background-size: cover;
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
  min-height: 100vh;
  max-width: 1532px;
  margin: 0 auto;
  padding: 28px 16px;
  box-sizing: border-box;
}
</style>
