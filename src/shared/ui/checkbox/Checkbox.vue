<script setup lang="ts">
  import type { CheckboxRootEmits, CheckboxRootProps } from 'reka-ui'
  import type { HTMLAttributes } from 'vue'
  import { Check, Minus } from '@lucide/vue'
  import { reactiveOmit } from '@vueuse/core'
  import { CheckboxIndicator, CheckboxRoot, useForwardPropsEmits } from 'reka-ui'
  import { cn } from '@/shared/lib/utils'

  const props = defineProps<CheckboxRootProps & { class?: HTMLAttributes['class'] }>()
  const emits = defineEmits<CheckboxRootEmits>()

  const delegatedProps = reactiveOmit(props, 'class')

  const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <CheckboxRoot
    data-slot="checkbox"
    v-bind="forwarded"
    :class="
      cn(
        'group size-5 shrink-0 rounded-[4px] border border-sub bg-sub-alt outline-none transition-tm focus-ring',
        'data-[state=checked]:border-main data-[state=checked]:bg-main',
        'data-[state=indeterminate]:border-main data-[state=indeterminate]:bg-main',
        'disabled:cursor-not-allowed disabled:opacity-40',
        props.class
      )
    "
  >
    <CheckboxIndicator data-slot="checkbox-indicator" class="grid place-content-center text-bg">
      <Minus class="hidden size-3.5 group-data-[state=indeterminate]:block" :stroke-width="3" />
      <Check class="size-3.5 group-data-[state=indeterminate]:hidden" :stroke-width="3" />
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
