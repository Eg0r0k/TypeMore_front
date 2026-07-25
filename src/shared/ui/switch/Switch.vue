<script setup lang="ts">
  import type { SwitchRootEmits, SwitchRootProps } from 'reka-ui'
  import type { HTMLAttributes } from 'vue'
  import { reactiveOmit } from '@vueuse/core'
  import { SwitchRoot, SwitchThumb, useForwardPropsEmits } from 'reka-ui'
  import { cn } from '@/shared/lib/utils'

  const props = defineProps<SwitchRootProps & { class?: HTMLAttributes['class'] }>()

  const emits = defineEmits<SwitchRootEmits>()

  const delegatedProps = reactiveOmit(props, 'class')

  const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <SwitchRoot
    v-slot="slotProps"
    data-slot="switch"
    v-bind="forwarded"
    :class="
      cn(
        'peer inline-flex h-6 w-[42px] shrink-0 items-center rounded-md px-[3px] outline-none transition-tm focus-ring data-[state=unchecked]:bg-sub data-[state=checked]:bg-main disabled:cursor-not-allowed disabled:opacity-40',
        props.class
      )
    "
  >
    <SwitchThumb
      data-slot="switch-thumb"
      :class="
        cn(
          'pointer-events-none block size-[18px] rounded-[calc(var(--border-radius)-2px)] switch-thumb-motion data-[state=unchecked]:translate-x-0 data-[state=checked]:translate-x-[18px] data-[state=unchecked]:bg-sub-alt data-[state=checked]:bg-bg'
        )
      "
    >
      <slot name="thumb" v-bind="slotProps" />
    </SwitchThumb>
  </SwitchRoot>
</template>
