<template>
  <Transition name="fade" mode="out-in">
    <div class="wrapper" v-if="!testState.isLoading">
      <FpsIndecator v-if="configStore.config.showFps" />
      <Header />
      <main>
        <router-view v-slot="{ Component, route }">
          <transition name="fade" mode="out-in">
            <component :is="Component" :key="route.path" />
          </transition>
        </router-view>
      </main>
      <button @click="showAlert"></button>
      <Footer />
      <Alerts ref="alertsRef" />

      <ModalWindow />

    </div>
    <div v-else class="loader-wrapper wrapper">
      <header class="loader-wrapper__header">
        <Logo />
      </header>
      <main class="loader-wrapper__body">
        <div>
          <div class="loader"></div>
        </div>
      </main>
      <footer class="loader-wrapper__footer"></footer>
    </div>

  </Transition>

</template>
<script setup lang="ts">
import { defineAsyncComponent, onBeforeMount, onMounted, onUnmounted, provide, ref } from 'vue'
import { Header } from '@/widgets/header'
import { Logo } from '@/shared/ui/logo'
import { Footer } from '@/widgets/footer'
import { useConfigStore } from '@/entities/config/store'
import { FpsIndecator } from '@/widgets/fps'
import { useTestStateStore } from '@/entities/test'
import { Alerts } from '@/widgets/alerts'
const configStore = useConfigStore()
const testState = useTestStateStore()
import { applyTheme, styleObserver, themesList } from '@/shared/lib/hooks/useThemes'
import { getLangList } from '@/shared/lib/helpers/json-files'
enum AlertType {
  Error = "error",
  Info = "info",
  Success = "success",
  Warning = "warn",
}

const alertsRef = ref<InstanceType<typeof Alerts>>();
const showAlert = () => {
  if (alertsRef.value) {
    alertsRef.value.addAlert({
      type: AlertType.Info,
      msg: 'Its joke do not take to heart. Adasd sdasd asdasds asdsad',
      title: 'ФВфывфывфы',
      duration: 3000,
      closable: true,
    });
  }
};
const ModalWindow = defineAsyncComponent(() =>
  import('@/widgets/modal/ui.vue')
)

const { config } = useConfigStore()
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

  console.log(lang)

})
onUnmounted(() => {
  styleObserver.disconnect()
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
