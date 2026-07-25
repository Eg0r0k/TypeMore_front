<template>
  <ConfigProvider :scroll-body="false">
    <TooltipProvider :delay-duration="80">
      <Transition name="fade" mode="out-in">
        <MainLayout v-if="!screen.isLoading" />
        <LoaderWrapper v-else />
      </Transition>
      <CookieModal v-model:open="cookieOpen" :dismissible="false" />
    </TooltipProvider>
  </ConfigProvider>
</template>
<script setup lang="ts">
  import { useScreenStore } from '@/entities/screen'
  import { LoaderWrapper } from '@/features/layouts/loader'
  import { MainLayout } from '@/features/layouts/main'
  import { CookieModal } from '@/features/modal/cookie'
  import { TooltipProvider } from '@/shared/ui/tooltip'
  import { ConfigProvider } from 'reka-ui'
  import { useAppSetup } from '@/shared/lib/hooks/useAppSetup'
  import { useAuthBootstrap } from '@/entities/auth'
  const screen = useScreenStore()
  const { cookieOpen } = useAppSetup()
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
</style>
