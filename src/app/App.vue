<template>
  <Transition name="fade" mode="out-in">
    <div v-if="!testState.isLoading" class="wrapper" role="main">
      <asyncFpsIndecator v-if="configStore.config.showFps" />

      <Header />

      <div class="customBackground">
        <img
          :src="configStore.config.backgroundImg"
          draggable="false"
          onerror="console.log('inplement alert on failed loading image [App.vue]')"
          alt="Background Image"
          style="
            width: calc(100% + 0rem);
            height: calc(100% + 0rem);
            left: 0rem;
            top: 0rem;
            position: absolute;
            user-select: none;
            object-fit: cover;
          "
        />
      </div>

      <main role="main">
        <router-view v-slot="{ Component, route }">
          <transition name="fade" mode="out-in">
            <component :is="Component" :key="route.path" />
          </transition>
        </router-view>
      </main>
      <Footer />
      <Alerts />

      <asyncDevtools v-if="configStore.config.devTools" />
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
  import { Alerts } from '@/widgets/alerts'
  import { useConfigStore } from '@/entities/config/model/store'
  import { useTestStateStore } from '@/entities/test/model/store'
  import { useThemes } from '@/shared/lib/hooks/useThemes'
  import { getLangList } from '@/shared/lib/helpers/json-files'
  import {
    defineAsyncComponent,
    onBeforeMount,
    onMounted,
    onUnmounted,
    provide,
    ref,
    Teleport
  } from 'vue'
  import { CookieModal } from '@/features/modal/cookie'
  import { useModal } from '@/entities/modal/model/store'
  import { useFavicon } from '@vueuse/core'
  import { LANG_KEY, THEMES_KEY } from '@/shared/constants/inject-keys'
  const configStore = useConfigStore()
  const testState = useTestStateStore()
  const ModalWindow = defineAsyncComponent(() => import('@/widgets/modal/ui.vue'))
  const { applyTheme, themesList, themesOnUnmounted, favicon } = useThemes()
  const { config, setFontFamily } = useConfigStore()
  const modalStore = useModal()
  const lang = ref()

  const asyncFpsIndecator = defineAsyncComponent(() => import('@widgets/fps/ui.vue'))
  const asyncDevtools = defineAsyncComponent(() => import('@widgets/devtools/ui.vue'))
  provide(THEMES_KEY, themesList)
  provide(LANG_KEY, lang)
  onBeforeMount(async () => {
    await applyTheme(config.theme)
    document.querySelector('#app')?.classList.remove('hidden')
    useFavicon(favicon)
  })

  onMounted(async () => {
    lang.value = await getLangList()
    setFontFamily(config.fontFamily)
    try {
      if (!localStorage.getItem('cookieConsentGiven')) {
        modalStore.open(CookieModal, 'bottom', 'right', false)
      }
    } catch (e) {
      console.error('Failed to get localstorage', e)
    }
  })
  onUnmounted(() => {
    themesOnUnmounted()
  })
</script>
<style lang="scss" scoped>
  .fade-enter-active,
  .fade-leave-active {
    transition: all 0.125s;
  }

  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
  }

  .customBackground {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: -1;
  }

  .customBackground img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    position: absolute;
    top: 0;
    left: 0;
    z-index: -1;
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

  .wrapper {
    z-index: 0;
    /* Убедитесь, что wrapper не перекрывает фон */
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
