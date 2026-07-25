<script setup lang="ts">
  import type { ListboxFilterProps } from 'reka-ui'
  import type { HTMLAttributes } from 'vue'
  import { Search } from '@lucide/vue'
  import { reactiveOmit } from '@vueuse/core'
  import { ListboxFilter, useForwardProps } from 'reka-ui'
  import { cn } from '@/shared/lib/utils'
  import { useCommand } from '.'

  defineOptions({
    inheritAttrs: false
  })

  const props = defineProps<
    ListboxFilterProps & {
      class?: HTMLAttributes['class']
    }
  >()

  const delegatedProps = reactiveOmit(props, 'class')

  const forwardedProps = useForwardProps(delegatedProps)

  const { filterState } = useCommand()
</script>

<template>
  <div
    data-slot="command-input-wrapper"
    class="flex h-9 items-center gap-2 border-b border-sub px-3"
  >
    <Search class="size-4 shrink-0 text-sub" />
    <ListboxFilter
      v-bind="{ ...forwardedProps, ...$attrs }"
      v-model="filterState.search"
      data-slot="command-input"
      auto-focus
      :class="
        cn(
          'placeholder:text-sub caret-main text-text flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
          props.class
        )
      "
    />
  </div>
</template>
