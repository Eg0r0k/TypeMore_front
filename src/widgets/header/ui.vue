<template>
  <header class="header">
    <Logo />
    <Navigation :data="navigationLinks" />
  </header>
</template>

<script lang="ts" setup>
import { Navigation } from '@/features/header/navigation'
import { NAV_LINKS } from './model/const/values'
import { Logo } from '@/shared/ui/logo';
import { useTestStateStore } from '@/entities/test';
const navigationLinks = NAV_LINKS

</script>

<style lang="scss" scoped>
.header {
  z-index: var(--navigation-z);
  display: flex;
}
</style>
