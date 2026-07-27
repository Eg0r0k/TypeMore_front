<template>
  <header v-if="IS_TAURI" class="titlebar bg-sub-alt text-sub flex h-8 items-center select-none">
    <!--
      The drag region deliberately stops short of the buttons rather than wrapping
      the whole bar: it stretches over all the free width, so grabbing anywhere but
      a control moves the window, and no click can be swallowed by a drag.
      The brand's children are click-through so they drag the window too.
    -->
    <div data-tauri-drag-region class="titlebar__brand flex flex-1 items-center gap-2 pl-3">
      <IconLogo class="titlebar__logo text-main pointer-events-none size-4" aria-hidden="true" />
      <span class="pointer-events-none text-xs">TypeMore</span>
    </div>

    <div role="group" :aria-label="t('window.controls')" class="flex h-full items-stretch">
      <button
        type="button"
        class="titlebar__btn transition-tm focus-ring hover:bg-bg hover:text-text"
        :aria-label="t('window.minimize')"
        :title="t('window.minimize')"
        @click="minimize"
      >
        <IconMinus class="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="titlebar__btn transition-tm focus-ring hover:bg-bg hover:text-text"
        :aria-label="maximizeLabel"
        :title="maximizeLabel"
        @click="toggleMaximize"
      >
        <IconCopy v-if="isMaximized" class="size-4" aria-hidden="true" />
        <IconSquare v-else class="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="titlebar__btn transition-tm focus-ring hover:bg-error hover:text-text"
        :aria-label="t('window.close')"
        :title="t('window.close')"
        @click="close"
      >
        <IconX class="size-4" aria-hidden="true" />
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
  import type { Window } from '@tauri-apps/api/window'
  import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { IS_TAURI } from './lib/is-tauri'
  import IconLogo from '~icons/typemore/logo'
  import IconMinus from '~icons/tabler/minus'
  import IconSquare from '~icons/tabler/square'
  import IconCopy from '~icons/tabler/copy'
  import IconX from '~icons/tabler/x'

  const { t } = useI18n()
  const appWindow = shallowRef<Window | null>(null)
  const isMaximized = ref(false)
  /** One button, two jobs — the label names the job, not the state. */
  const maximizeLabel = computed(() => t(isMaximized.value ? 'window.restore' : 'window.maximize'))

  let unlisten: (() => void) | undefined

  const minimize = (): void => void appWindow.value?.minimize()
  const close = (): void => void appWindow.value?.close()
  const toggleMaximize = (): void => void appWindow.value?.toggleMaximize()

  onMounted(async () => {
    if (!IS_TAURI) return

    // Dynamic so the Tauri IPC bundle stays out of the web build entirely.
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    const win = getCurrentWindow()
    appWindow.value = win
    isMaximized.value = await win.isMaximized()

    // The maximize glyph must also follow resizes we did not trigger: OS snapping,
    // a double-click on the drag region, or the keyboard shortcuts.
    unlisten = await win.onResized(async () => {
      isMaximized.value = await win.isMaximized()
    })
  })

  onBeforeUnmount(() => unlisten?.())
</script>

<style lang="scss" scoped>
  .titlebar {
    // Not sticky: the shell around it is the viewport-tall box and the content
    // below scrolls on its own, so the bar simply never moves (see App.vue).
    // `flex-shrink: 0` keeps it exactly 32px however tall the page gets.
    flex-shrink: 0;

    // The popup layer, so the window controls stay clickable above a dialog's
    // overlay (--modal-z). Portaled popups share this level and, being later in
    // the DOM, still win — a select opened near the top edge is not clipped.
    z-index: var(--popup-z);
  }

  // The bespoke logo ships without a stroke colour so it can inherit one.
  .titlebar__logo {
    stroke: currentcolor;
  }

  .titlebar__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
  }
</style>
