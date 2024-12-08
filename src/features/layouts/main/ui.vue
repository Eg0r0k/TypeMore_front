<template>
  <div class="wrapper" role="main">
    <asyncFpsIndecator v-if="configStore.config.showFps" />
    <BackgroundImage />
    <Header />
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
</template>

<script lang="ts" setup>
  import { useConfigStore } from '@/entities/config/model/store'
  import { BackgroundImage } from '@/features/home/background'
  import { Alerts } from '@/widgets/alerts'
  import { Footer } from '@/widgets/footer'
  import { Header } from '@/widgets/header'
  import { defineAsyncComponent } from 'vue'

  const ModalWindow = defineAsyncComponent(() => import('@/widgets/modal/ui.vue'))
  const asyncFpsIndecator = defineAsyncComponent(() => import('@widgets/fps/ui.vue'))
  const asyncDevtools = defineAsyncComponent(() => import('@widgets/devtools/ui.vue'))
  const configStore = useConfigStore()
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

  .wrapper {
    box-sizing: border-box;
    z-index: 0;
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 100%;
    max-width: 1532px;
    min-height: 100vh;
    margin: 0 auto;
    padding: 28px 16px;
    background-size: cover;
  }
</style>
