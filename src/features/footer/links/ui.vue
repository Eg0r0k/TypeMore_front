<template>
  <nav class="footer-navigation" aria-label="footer navigation">
    <ul class="footer-navigation__list">
      <li v-for="link in props.links" :key="link.label" class="list__item">
        <a :href="link.link" class="list__link" target="_blank" :title="link.label">
          <Icon :icon="link.iconName" width="18" aria-hidden="true" />
          <span class="sr-only">{{ link.label }}</span>
          {{ link.label }}
        </a>
      </li>
    </ul>
  </nav>
</template>
>

<script setup lang="ts">
  import { FooterLink } from '@/widgets/footer/model/types/links'
  import { Icon } from '@iconify/vue'
  interface Props {
    links: readonly FooterLink[]
  }
  const props = defineProps<Props>()
</script>

<style scoped lang="scss">
  .sr-only {
    @include hide-visually;
  }

  .list {
    &__link {
      display: flex;
      gap: 2px;
      align-items: center;
      text-decoration: none;
      user-select: none;
    }
  }

  .footer-navigation {
    display: flex;

    &__list {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
    }
  }
</style>
