<template>
  <ConfigProvider :scroll-body="false">
    <TooltipProvider :delay-duration="80">
      <div class="app-shell" :class="{ 'app-shell--tauri': IS_TAURI }">
        <WindowToolbar />
        <!-- The scroller in the desktop build; a plain wrapper in a browser. -->
        <div class="app-shell__view">
          <Transition name="fade" mode="out-in">
            <MainLayout v-if="!screen.isLoading" />
            <LoaderWrapper v-else />
          </Transition>
        </div>
      </div>
      <!--
        The app-level dialogs, mounted ONCE. Settings and the theme picker are
        opened from the header, the profile and from each other; a per-opener
        instance meant the same tree existed twice with two open states. Every
        opener now flips a flag in the dialogs store (entities/dialogs), which
        also owns the settings ⇄ theme/cookie drill-down.
      -->
      <SettingsModal v-model:open="dialogs.settings" />
      <ThemesModal v-model:open="dialogs.themes" />
      <CookieModal v-model:open="dialogs.cookies" :dismissible="dialogs.cookiesDismissible" />
    </TooltipProvider>
  </ConfigProvider>
</template>
<script setup lang="ts">
  import { useScreenStore } from '@/entities/screen'
  import { useDialogsStore } from '@/entities/dialogs'
  import { LoaderWrapper } from '@/features/layouts/loader'
  import { MainLayout } from '@/features/layouts/main'
  import { IS_TAURI, WindowToolbar } from '@/features/layouts/titlebar'
  import { CookieModal } from '@/features/modal/cookie'
  import { SettingsModal } from '@/features/modal/settings'
  import { ThemesModal } from '@/features/modal/themes'
  import { TooltipProvider } from '@/shared/ui/tooltip'
  import { ConfigProvider } from 'reka-ui'
  import { useAppSetup } from '@/shared/lib/hooks/useAppSetup'
  import { useAuthBootstrap } from '@/entities/auth'
  const screen = useScreenStore()
  const dialogs = useDialogsStore()
  useAppSetup()
  useAuthBootstrap()
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

  /*
   * `#app` (index.html) is a centering FLEX row, and its child used to be
   * `#wrapper`, which carries `width: 100%`. This shell took that place without
   * one, so it shrank to fit its content and dragged the whole app in with it.
   * `flex: 1` is what `width: 100%` was doing there — the page's own max-width
   * and auto margins still do the centering, exactly as before.
   */
  .app-shell {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  /*
   * DESKTOP ONLY — one box, two rows: the titlebar on top, the content below,
   * and the SCROLL belongs to the content alone. The box itself never scrolls
   * (`overflow: hidden`), and the document above it does not either (see
   * `html.is-tauri` in main.scss) — that pair is what stops the two scrollbars.
   *
   * `min-height: 0` on the content row is what makes its overflow real: a flex
   * item defaults to `min-height: auto`, refuses to shrink below its content,
   * and grows the box instead of scrolling inside it.
   */
  .app-shell--tauri {
    height: 100%;
    overflow: hidden;
  }

  .app-shell--tauri .app-shell__view {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    overflow-y: auto;
  }

  /*
   * The page's full-height column measured itself against the WINDOW (100vh);
   * inside a scroller it has to measure against the scroller, or the footer
   * stops at the content's end instead of the bottom of the view.
   */
  .app-shell--tauri :deep(#wrapper) {
    // Never shrink, at least a full view tall, and free to grow past it: a flex
    // item defaults to `flex-shrink: 1`, which would squeeze the page to the
    // window and spill its content out from under the footer instead of
    // scrolling it.
    flex: 0 0 auto;
    min-height: 100%;
  }
</style>
