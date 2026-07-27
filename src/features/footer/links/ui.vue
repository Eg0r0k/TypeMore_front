<template>
  <nav class="flex flex-wrap">
    <Button v-for="link in props.links" :key="link.label" size="s" color="shadow">
      <component :is="link.icon" aria-hidden="true" />
      <span class="sr-only">{{ link.label }}</span>
      <span class="link__text">{{ link.label }}</span>
    </Button>
  </nav>

  <!-- <nav class="footer-navigation" aria-label="footer navigation">
    <ul class="footer-navigation__list">
      <li v-for="link in props.links" :key="link.label" class="list__item">
        <a :href="link.link" class="list__link link" target="_blank" :title="link.label">
          <component :is="link.icon" width="18" height="18" aria-hidden="true" />
          <span class="sr-only">{{ link.label }}</span>
          <span class="link__text">{{ link.label }}</span>
        </a>
      </li>
    </ul>
  </nav> -->
</template>

<script setup lang="ts">
  import { Button } from '@/shared/ui/button'
  import type { FooterLink } from './types/links'
  interface Props {
    links: readonly FooterLink[]
  }
  const props = defineProps<Props>()
</script>

<style scoped lang="scss">
  @media (width <=437px) {
    .link {
      &__text {
        display: none;
      }
    }
  }
</style>
