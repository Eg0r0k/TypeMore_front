<template>
  <footer class="footer-navigation" aria-label="footer navigation">
    <ul class="footer-navigation__list" role="navigation">
      <li class="list__item" role="listitem" v-for="link in props.data" :key="link.label">
        <a :href="link.link" class="list__link" target="_blank" :title="link.label" role="link">
          <Icon :icon="link.iconName" width="18" aria-hidden="true" />
          {{ link.label }}
        </a>
      </li>
    </ul>
  </footer>
</template>>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
interface Props {
  data: Array<{
    link: string
    iconName: string
    label: string
  }>
}
const props = defineProps<Props>()
</script>

<style scoped lang="scss">
.list {
  &__link {
    -webkit-user-select: none;
    -moz-user-select: none;
    user-select: none;
    text-decoration: none;
    display: flex;
    align-items: center;
    gap: 2px;
  }
}

.footer-navigation {
  display: flex;

  &__list {
    flex-wrap: wrap;
    display: flex;
    gap: 16px;
  }
}
</style>
