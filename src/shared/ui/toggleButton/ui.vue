<template>
  <Button
    :size="size"
    :isLoading="isLoading"
    :is-disabled="isDisabled"
    :buttonLabel="buttonLabel"
    :color="isActive ? toggledColor : color"
    @click="toggle"
  >
    <template #left-icon>
      <slot name="left-icon"></slot>
    </template>

    <slot />

    <template #right-icon>
      <slot name="right-icon"></slot>
    </template>
  </Button>
</template>

<script setup lang="ts">
  import { computed, inject, Ref } from 'vue'
  import { ButtonColor, ButtonI } from '../button/ui.vue'
  import { Button } from '../button'
  import { TOGGLE_GROUP } from '@/shared/constants/inject-keys'

  interface ToggleButton extends ButtonI {
    modelValue?: boolean
    toggledColor: ButtonColor
    value: string | number
  }
  const toggleGroup = inject<{
    selectedValue: Ref<string | number | (string | number)[]>
    selectButton: (value: string | number) => void
  } | null>(TOGGLE_GROUP, null)

  const props = defineProps<ToggleButton>()
  const emit = defineEmits(['update:modelValue'])

  const isActive = computed(() => {
    if (toggleGroup) {
      if (toggleGroup.selectedValue.value instanceof Array) {
        // Check for multiple selections
        return (toggleGroup.selectedValue.value as (string | number)[]).includes(props.value)
      } else {
        return toggleGroup.selectedValue.value === props.value
      }
    } else {
      return props.modelValue ?? false
    }
  })

  const toggle = () => {
    if (toggleGroup) {
      toggleGroup.selectButton(props.value)
    } else {
      emit('update:modelValue', !(props.modelValue ?? false))
    }
  }
</script>
