<script setup lang="ts">
  import type { SelectContentEmits, SelectContentProps } from 'reka-ui'
  import type { HTMLAttributes } from 'vue'
  import { reactiveOmit } from '@vueuse/core'
  import { SelectContent, SelectPortal, SelectViewport, useForwardPropsEmits } from 'reka-ui'
  import { cn } from '@/shared/lib/utils'
  import { SelectScrollDownButton, SelectScrollUpButton } from '.'

  defineOptions({
    inheritAttrs: false
  })

  const props = withDefaults(
    defineProps<SelectContentProps & { class?: HTMLAttributes['class'] }>(),
    {
      position: 'popper'
    }
  )
  const emits = defineEmits<SelectContentEmits>()

  const delegatedProps = reactiveOmit(props, 'class')

  const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <SelectPortal>
    <SelectContent
      data-slot="select-content"
      v-bind="{ ...$attrs, ...forwarded }"
      :class="
        cn(
          'relative z-[var(--popup-z)] max-h-(--reka-select-content-available-height) min-w-[8rem] overflow-x-hidden overflow-y-auto rounded-md border border-sub bg-sub-alt text-text transition-tm data-[state=open]:opacity-100 data-[state=closed]:opacity-0 data-[state=open]:scale-100 data-[state=closed]:scale-95 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-md [&::-webkit-scrollbar-thumb]:bg-sub',
          position === 'popper' &&
            'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
          props.class
        )
      "
    >
      <SelectScrollUpButton />
      <SelectViewport
        :class="
          cn(
            'flex flex-col gap-0.5 p-2',
            position === 'popper' &&
              'h-(--reka-select-trigger-height) w-full min-w-(--reka-select-trigger-width) scroll-my-1'
          )
        "
      >
        <slot />
      </SelectViewport>
      <SelectScrollDownButton />
    </SelectContent>
  </SelectPortal>
</template>
