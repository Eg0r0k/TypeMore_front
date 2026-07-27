<script lang="ts" setup>
  import { Toaster } from 'vue-sonner'
  import 'vue-sonner/style.css'

  /**
   * The app's toaster (shadcn-vue's Sonner). One instance, mounted by the main
   * layout; everything else just calls `toast(...)`.
   *
   * Sonner ships its own dark/light themes, and neither is ours — a TypeMore
   * theme is four runtime variables that a published theme file can change under
   * the app's feet. So the surface is re-tokenised here through `toastOptions`
   * rather than left to a hardcoded palette: the toast is `--sub-alt-color` on
   * `--text-color`, the same raised surface every popover and tooltip uses, and
   * it follows a theme switch for free.
   */
  const TOAST_CLASSES = {
    toast:
      'bg-sub-alt! text-text! border-sub! rounded-md! font-sans! text-sm! shadow-none! items-start!',
    title: 'text-text! font-medium!',
    description: 'text-sub!',
    actionButton: 'bg-main! text-bg!',
    cancelButton: 'bg-bg! text-sub!',
    closeButton: 'bg-sub-alt! text-sub! border-sub! hover:text-text!',
    // The four kinds differ ONLY in the icon's colour. A toast that repainted
    // its whole surface per kind would shout at a player mid-run — and `error`
    // is the one this app refuses to shout with (see the results screen).
    success: '[&_[data-icon]]:text-main!',
    info: '[&_[data-icon]]:text-sub!',
    warning: '[&_[data-icon]]:text-main!',
    error: '[&_[data-icon]]:text-error!'
  }
</script>

<template>
  <Toaster
    position="top-right"
    :duration="4000"
    close-button
    :toast-options="{ classes: TOAST_CLASSES, unstyled: false }"
    :style="{ '--width': '22rem', zIndex: 'var(--alert-z)' }"
  />
</template>
