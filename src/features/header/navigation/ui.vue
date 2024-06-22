<template>
  <nav class="navigation header-navigation" role="navigation" aria-label="header navigation">
    <ul class="navigation__list" role="list">
      <li class="list__item" role="listitem" v-for="link in props.data" :key="link.link">
        <Popper hover arrow offset-distance="6" class="registration__popper" :content="link.label">
          <router-link :to="link.link" class="list__link" :title="link.label" role="link">
            <Icon :icon="link.iconName" width="30" aria-hidden="true" />
          </router-link>
        </Popper>
      </li>
    </ul>
    <div class="navigation__controls">
      <Button size="s">
        <template #left-icon>
          <Icon :icon="'ion:notifications'" width="30" />
        </template>
      </Button>
      <router-link to="/login" title="Login" aria-label="Login">
        <Icon :icon="'mdi:user'" width="30" aria-hidden="true" />
      </router-link>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { Button } from '@/shared/ui/button'
import { Icon } from '@iconify/vue'
import Popper from 'vue3-popper'
interface Props {
  data: Array<{
    link: string
    iconName: string
    label: string
  }>
}
const props = defineProps<Props>()
</script>

<style lang="scss" scoped>
.list {
  &__link {
    display: flex;
    padding: 4px;
  }
}

.navigation {
  width: 100%;
  display: flex;
  gap: 8px;
  align-items: flex-end;
  justify-content: space-between;

  &__controls {
    display: flex;

  }

  &__list {
    display: flex;
    gap: 2px;
  }
}
</style>
