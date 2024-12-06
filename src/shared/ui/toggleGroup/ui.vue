<template>
  <div class="toggle-group">
    <slot />
  </div>
</template>

<script setup lang="ts">
  import { ref, provide, watch } from 'vue'
  import { TOGGLE_GROUP } from '@shared/constants/inject-keys'

  const props = defineProps<{
    modelValue?: string | number | (string | number)[]
    multiple?: boolean
  }>()

  const emit = defineEmits(['update:modelValue', 'change'])

  const selectedValue = ref<string | number | (string | number)[] | null>(
    props.multiple ? [] : (props.modelValue ?? null)
  )

  const selectButton = (value: string | number) => {
    if (props.multiple) {
      const selectedArray = selectedValue.value as (string | number)[]
      if (selectedArray.includes(value)) {
        return
      }
      selectedArray.push(value)
    } else {
      if (selectedValue.value === value) {
        return
      }
      selectedValue.value = value
    }

    emit('update:modelValue', selectedValue.value)
    emit('change', selectedValue.value)
  }

  provide(TOGGLE_GROUP, {
    selectedValue,
    selectButton
  })
  watch(
    () => props.modelValue,
    (newValue) => {
      selectedValue.value = newValue ?? null
    }
  )
</script>

<style scoped>
  .toggle-group {
    display: flex;
  }
</style>
