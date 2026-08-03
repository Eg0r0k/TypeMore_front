<template>
  <AvatarFallback
    v-bind="props"
    :class="cn('flex size-full items-center justify-center text-[36cqw] leading-none', props.class)"
  >
    <slot />
  </AvatarFallback>
</template>

<script setup lang="ts">
  import type { HTMLAttributes } from 'vue'
  import { AvatarFallback, type AvatarFallbackProps } from 'reka-ui'

  import { cn } from '@/shared/lib/utils'

  /**
   * What the circle shows with no picture: initials, or whatever the caller
   * puts in the slot.
   *
   * `36cqw` — 36% of the avatar's own width — is the point of the exercise: the
   * type is a proportion of the circle, not a fixed step, so one component
   * covers 24px and 96px without a size-to-font table to keep in step. An icon
   * in the slot does the same with `size-[45%]` (see UserAvatar).
   */
  const props = defineProps<AvatarFallbackProps & { class?: HTMLAttributes['class'] }>()
</script>
