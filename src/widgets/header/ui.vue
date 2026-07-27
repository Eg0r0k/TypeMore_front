<template>
  <header class="header">
    <AccountRestricted />
    <Navigation :links="navigationLinks" />
  </header>
</template>

<script lang="ts" setup>
  import { AccountRestricted } from '@/features/account-restricted'
  import { Navigation } from '@/features/header/navigation'
  import { NAV_LINKS } from './model/const/values'

  const navigationLinks = NAV_LINKS
</script>

<style lang="scss" scoped>
  .header {
    z-index: var(--navigation-z);
    display: flex;
    gap: 12px;
    align-items: center;
  }
</style>
