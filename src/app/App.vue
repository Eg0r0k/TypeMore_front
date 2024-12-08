<template>
  <metainfo>
    <template v-slot:title="{ content }">Type More | {{ content }}</template>
  </metainfo>
  <Transition name="fade" mode="out-in">

    <MainLayout v-if="!testState.isLoading" />
    <LoaderWrapper v-else />
  </Transition>
</template>
<script setup lang="ts">
import { useTestStateStore } from '@/entities/test/model/store'
import { LoaderWrapper } from '@/features/layouts/loader'
import { MainLayout } from '@/features/layouts/main'
import { useAppSetup } from '@/shared/lib/hooks/useAppSetup'

const testState = useTestStateStore()
useAppSetup()


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
