<template>
  <nav class="header-navigation" title="header navigation">
    <ul class="header-navigation__list" title="menu">
      <li class="list list__item" v-for="link in props.data" :key="link.link">
        <Popper hover arrow offset-distance="6" class="registration__popper" :content="link.label">
          <router-link :to="link.link" class="list__link" :title="link.label">
            <Icon :icon="link.iconName" width="30" />
          </router-link>
        </Popper>
      </li>
    </ul>

    <div style="display: flex">
      <Button size="s">
        <template #left-icon>
          <Icon :icon="'ion:notifications'" width="30" />
        </template>
      </Button>
      <router-link to="/login" title="Login">
        <Icon :icon="'mdi:user'" width="30" />
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
a {
  display: flex;
  padding: 4px;
}

.header-navigation {
  width: 100%;
  display: flex;
  gap: 8px;
  align-items: flex-end;
  justify-content: space-between;

  &__list {
    display: flex;
  }
}
</style>
