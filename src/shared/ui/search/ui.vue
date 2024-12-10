<template>
  <div class="search-bar">
    <Icon width="20" :icon="icon" class="search-bar__icon" />
    <input
      ref="searchInput"
      :value="modelValue"
      @input="onInput"
      type="text"
      class="search-bar__input"
      :placeholder="placeholder"
      aria-label="Search"
    />
  </div>
</template>

<script setup lang="ts">
  import { onMounted, ref } from 'vue'
  import { Icon } from '@iconify/vue'

  interface Props {
    modelValue: string
    placeholder?: string
    icon?: string
  }

  const emit = defineEmits<{
    (event: 'update:modelValue', value: string): void
  }>()

  const props = withDefaults(defineProps<Props>(), {
    modelValue: '',
    placeholder: 'Search...',
    icon: 'fluent:search-12-filled'
  })

  const searchInput = ref<HTMLInputElement | null>(null)

  const onInput = (event: Event): void => {
    const target = event.target as HTMLInputElement
    emit('update:modelValue', target.value.trim())
  }

  onMounted(() => {
    if (searchInput.value) {
      searchInput.value.focus()
    }
  })
</script>

<style scoped lang="scss">
  .search-bar {
    position: relative;
    width: 100%;

    &__icon {
      position: absolute;
      top: 50%;
      left: 15px;
      color: var(--sub-color);
      pointer-events: none;
      transition: color var(--transition-duration);
      transform: translateY(-50%);
    }

    &__input {
      box-sizing: border-box;
      width: 100%;
      padding: 10px 20px 10px 50px;
      font-size: 16px;
      line-height: normal;
      color: var(--text-color);
      caret-color: var(--main-color);
      user-select: none;
      background-color: var(--sub-alt-color);
      border: none;
      border-radius: var(--border-radius);
      outline: none;

      &::placeholder {
        color: var(--sub-color);
        opacity: 1;
      }
    }

    &:focus-within .search-bar__icon {
      color: var(--text-color);
    }
  }
</style>
