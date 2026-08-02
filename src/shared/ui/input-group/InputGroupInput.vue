<script setup lang="ts">
  import type { HTMLAttributes } from 'vue'
  import { cn } from '@/shared/lib/utils'

  /**
   * The control inside an {@link InputGroup}. Transparent and borderless — the
   * group draws the surface — and `flex-1 min-w-0`, so it takes every pixel the
   * addons leave it and never pushes them off the end.
   *
   * `data-slot="input-group-control"` is what the group's focus rule looks for.
   */
  const props = defineProps<{ class?: HTMLAttributes['class'] }>()
  const model = defineModel<string>({ default: '' })
</script>

<template>
  <input
    v-model="model"
    data-slot="input-group-control"
    :class="
      cn(
        'text-text caret-main placeholder:text-sub min-w-0 flex-1 bg-transparent px-3 py-1.5',
        'text-base outline-none sm:text-sm disabled:cursor-not-allowed',
        props.class
      )
    "
  />
</template>
