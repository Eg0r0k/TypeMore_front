<template>
  <nav class="navigation header-navigation" role="navigation" aria-label="header navigation">
    <ul class="navigation__list" role="list">
      <li v-for="link in props.links" :key="link.link" class="list__item" role="listitem">
        <Popper hover arrow offset-distance="6" class="registration__popper" :content="link.label">
          <router-link
            :to="link.link"
            class="list__link"
            tabindex="0"
            :title="link.label"
            role="link"
          >
            <Icon :icon="link.iconName" width="30" aria-hidden="true" />
          </router-link>
        </Popper>
      </li>
    </ul>
    <div class="navigation__controls controls">
      <Button
        tabindex="0"
        class="controls__alert"
        size="s"
        color="shadow"
        button-label="Open alerts"
        @click="handleOpenNews"
      >
        <template #left-icon>
          <Icon :icon="'ion:notifications'" width="30" />
        </template>
      </Button>

      <router-link tabindex="0" class="controls__user" to="/login" title="Login" aria-label="Login">
        <Icon :icon="'mdi:user'" width="30" aria-hidden="true" />
      </router-link>
    </div>
  </nav>
  <Transition name="slide-fade">
    <NewsModal v-if="isVisible" @close="handleOpenNews" />
  </Transition>
</template>

<script setup lang="ts">
  import { NewsModal } from '@/features/modal/news'
  import { Button } from '@/shared/ui/button'
  import { HeaderLink } from '@/widgets/header/types/links'
  import { Icon } from '@iconify/vue'

  import { ref } from 'vue'

  interface Props {
    links: readonly HeaderLink[]
  }

  const isVisible = ref(false)
  const props = defineProps<Props>()

  const handleOpenNews = (): void => {
    isVisible.value = !isVisible.value
  }
</script>

<style lang="scss" scoped>
  .list {
    &__link {
      display: flex;
      padding: 4px;
    }
  }

  .controls {
    &__user {
      padding: 4px 8px;
    }
  }

  .navigation {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    width: 100%;

    &__controls {
      display: flex;
      align-items: center;
    }

    &__list {
      display: flex;
      gap: 2px;
    }
  }

  .slide-fade-enter-active {
    transition: all 0.2s ease-out;
  }

  .slide-fade-leave-active {
    transition: all 0.2s ease-in;
  }

  .slide-fade-enter-from {
    opacity: 0;
    transform: translateX(100%);
  }

  .slide-fade-leave-to {
    opacity: 0;
    transform: translateX(100%);
  }

  @media screen and (width <=375px) {
    .navigation__controls .iconify,
    .list__link .iconify {
      width: 20px;
      height: 20px;
    }
  }
</style>
