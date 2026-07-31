<template>
  <div id="wrapper" role="main">
    <asyncFpsIndecator v-if="configStore.config.showFps" />
    <BackgroundImage />
    <Header />
    <main id="main" role="main">
      <router-view v-slot="{ Component, route }">
        <Transition name="fade" mode="out-in">
          <component :is="Component" :key="route.path" />
        </Transition>
      </router-view>
    </main>
    <Footer />
    <Toaster />
  </div>
</template>

<script lang="ts" setup>
  import { useConfigStore } from '@/entities/config'
  import { BackgroundImage } from '@/features/home/background'

  import { Footer } from '@/widgets/footer'
  import { Header } from '@/widgets/header'
  import { Toaster } from '@/shared/ui/sonner'
  import { defineAsyncComponent } from 'vue'

  const asyncFpsIndecator = defineAsyncComponent(() => import('@widgets/fps/ui.vue'))
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

  #wrapper {
    box-sizing: border-box;
    z-index: 0;
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 100%;
    max-width: 1532px;
    min-height: 100vh;
    margin: 0 auto;
    padding: 26px 0 0 0;
    background-size: cover;
  }

  /*
   * The page area absorbs the slack, which is what actually pins the footer to
   * the bottom: a full-height COLUMN only reaches the bottom, it does not push
   * its last child there — without this the footer stops wherever the content
   * happens to end.
   */
  #main {
    flex: 1;
    min-height: 0;
  }
</style>
