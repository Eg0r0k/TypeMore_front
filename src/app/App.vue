<template>
  <Transition name="fade" mode="out-in">
    <div class="wrapper" v-if="!testState.isLoading" role="main">
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
import { defineAsyncComponent, onBeforeMount, onMounted, provide, ref } from 'vue'
import { CookieModal } from '@/features/modal/cookie'
import { useModal } from '@/entities/modal/model/store'


const configStore = useConfigStore()
const testState = useTestStateStore()
const ModalWindow = defineAsyncComponent(() =>
  import('@/widgets/modal/ui.vue')
)
const { applyTheme, themesList } = useThemes()
const { config } = useConfigStore()
const modalStore = useModal()
const lang = ref()
provide('themes', themesList)
provide('lang', lang)
onBeforeMount(async () => {
  await applyTheme(config.theme)
  document.querySelector('#app')?.classList.remove('hidden')
})

onMounted(async () => {
  //Set platform on load window : 'desktop' | 'tablet' | 'mobile'
  lang.value = await getLangList()
  if (!localStorage.getItem('cookieConsentGiven')) {
    modalStore.open(CookieModal, [], 'bottom', 'right', false);
  }

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
