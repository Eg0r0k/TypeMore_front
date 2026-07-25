<script setup lang="ts" generic="T">
  import { computed } from 'vue'
  import Checkbox from './Checkbox.vue'

  interface Props {
    value?: T
    label?: string
    name?: string
    isDisabled?: boolean
    indeterminate?: boolean
  }

  const props = withDefaults(defineProps<Props>(), {
    name: 'checkbox',
    label: ''
  })

  const model = defineModel<T>()

  // Bridge the boolean-toggle model onto reka's `boolean | 'indeterminate'`.
  // The `indeterminate` prop forces the mixed state; a user toggle always
  // resolves back to a boolean.
  const state = computed<boolean | 'indeterminate'>({
    get: () => (props.indeterminate ? 'indeterminate' : Boolean(model.value)),
    set: (next) => {
      model.value = (next === 'indeterminate' ? true : next) as T
    }
  })
</script>

<template>
  <label
    class="inline-flex items-center gap-2 transition-tm"
    :class="isDisabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'"
  >
    <Checkbox v-model="state" :disabled="isDisabled" />
    <input
      type="checkbox"
      tabindex="-1"
      aria-hidden="true"
      class="sr-only"
      :name="name"
      :checked="Boolean(model)"
      :disabled="isDisabled"
    />
    <span v-if="label || $slots.default" class="select-none text-text">
      <slot>{{ label }}</slot>
    </span>
  </label>
</template>
