<script setup lang="ts">
  import type { HTMLAttributes } from 'vue'
  import { useVModel } from '@vueuse/core'
  import { cn } from '@/shared/lib/utils'

  const props = defineProps<{
    defaultValue?: string | number
    modelValue?: string | number
    class?: HTMLAttributes['class']
  }>()

  const emits = defineEmits<{
    (e: 'update:modelValue', payload: string | number): void
  }>()

  const modelValue = useVModel(props, 'modelValue', emits, {
    passive: true,
    defaultValue: props.defaultValue
  })
</script>

<template>
  <input
    v-model="modelValue"
    data-slot="input"
    :class="
      cn(
        'file:text-foreground placeholder:text-sub selection:bg-primary selection:text-primary-foreground caret-main text-text h-9 w-full min-w-0 rounded-md bg-sub-alt px-3 py-1 text-base transition-tm outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:cursor-not-allowed disabled:opacity-50',
        'focus-ring',
        props.class
      )
    "
  />
</template>
