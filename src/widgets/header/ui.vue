<template>
  <header class="header">
    <!--
      The logo's place, and it is OUTSIDE the group below on purpose: while a run
      is under way everything else in this bar fades out, and the logo is the one
      thing that stays. Empty for now — the slot exists so that adding it later
      is adding a logo, not re-deciding what fades.
    -->
    <slot name="logo" />

    <!--
      Chrome, not content: it fades rather than unmounting, so the bar keeps its
      height and nothing below it moves at the moment a run starts. `inert` is
      what makes it actually gone — invisible controls that still take clicks and
      tab stops are worse than visible ones.
    -->
    <div
      class="header__chrome transition-opacity duration-200 ease-out motion-reduce:transition-none"
      :class="{ 'opacity-0': screen.isTyping }"
      :inert="screen.isTyping"
    >
      <AccountRestricted />
      <Navigation :links="navigationLinks" />
    </div>
  </header>
</template>

<script lang="ts" setup>
  import { AccountRestricted } from '@/features/account-restricted'
  import { Navigation } from '@/features/header/navigation'
  import { useScreenStore } from '@/entities/screen'
  import { NAV_LINKS } from './model/const/values'

  const navigationLinks = NAV_LINKS
  const screen = useScreenStore()
</script>

<style lang="scss" scoped>
  .header {
    z-index: var(--navigation-z);
    display: flex;
    gap: 12px;
    align-items: center;

    // The group takes the row the bar used to be: `Navigation` lays itself out
    // at full width with its ends pushed apart, and it has to keep doing that
    // with a logo beside it.
    &__chrome {
      display: flex;
      flex: 1;
      gap: 12px;
      align-items: center;
      min-width: 0;
    }
  }
</style>
