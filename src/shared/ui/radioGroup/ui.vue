<template>
  <div class="radio-group">
    <slot />
  </div>
</template>

<script setup lang="ts">
  //TODO: make it work!
  import { defineProps, defineEmits, ref, watch } from 'vue'

  interface Props {
    modelValue: string | number | boolean
  }

  const props = defineProps<Props>()
  const emit = defineEmits<{
    (e: 'update:modelValue', value: string | number | boolean): void
  }>()

  const selectedValue = ref(props.modelValue)

  watch(selectedValue, (newValue) => {
    emit('update:modelValue', newValue)
  })
</script>

<style lang="scss" scoped>
  .radio-group {
    display: flex;
    gap: 10px;
  }
</style>
