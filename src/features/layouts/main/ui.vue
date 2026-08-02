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
  import { defineAsyncComponent, onUnmounted, ref, watch, watchEffect } from 'vue'
  import { useEventListener } from '@vueuse/core'

  import { useConfigStore } from '@/entities/config'
  import { useScreenStore } from '@/entities/screen'
  import { BackgroundImage } from '@/features/home/background'

  import { Footer } from '@/widgets/footer'
  import { Header } from '@/widgets/header'
  import { Toaster } from '@/shared/ui/sonner'

  const asyncFpsIndecator = defineAsyncComponent(() => import('@widgets/fps/ui.vue'))
  const configStore = useConfigStore()
  const screen = useScreenStore()

  /**
   * The pointer, while a run is under way.
   *
   * Hidden, because an arrow parked over the words is one more thing in the way
   * of reading them — but hidden the way a video player hides it, not
   * permanently: moving the mouse brings it straight back, and the next
   * keystroke takes it away again. A cursor you cannot find is worse than one
   * you did not want, and "restart" is a button.
   *
   * On the root element rather than a component, because the rule has to reach
   * everything — including the field's own shadow DOM and anything portalled to
   * `body`.
   */
  const pointerVisible = ref(true)

  watch(
    () => screen.isTyping,
    (typing) => {
      pointerVisible.value = !typing
    }
  )
  useEventListener(window, 'mousemove', () => {
    pointerVisible.value = true
  })
  useEventListener(window, 'keydown', () => {
    // Same value written on every keystroke after the first, so this settles
    // into a no-op rather than touching the DOM on the typing hot path.
    if (screen.isTyping) pointerVisible.value = false
  })

  watchEffect(() => {
    document.documentElement.classList.toggle(
      'is-typing',
      screen.isTyping && !pointerVisible.value
    )
  })

  onUnmounted(() => document.documentElement.classList.remove('is-typing'))
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
    padding: 26px 14px 0 14px;
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
