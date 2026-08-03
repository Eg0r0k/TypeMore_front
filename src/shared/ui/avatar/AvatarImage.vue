<template>
  <AvatarImage v-bind="props" :class="cn('size-full object-cover', props.class)">
    <slot />
  </AvatarImage>
</template>

<script setup lang="ts">
  import type { HTMLAttributes } from 'vue'
  import { AvatarImage, type AvatarImageProps } from 'reka-ui'

  import { cn } from '@/shared/lib/utils'

  /**
   * The picture. reka loads it out of the DOM first and only swaps it in once
   * it decodes, so a broken or slow URL never blanks the circle — the fallback
   * simply stays. That is the whole reason this sits on reka rather than a bare
   * `<img>`: the day the server starts serving avatars, a 404 is already a
   * handled state.
   */
  const props = defineProps<AvatarImageProps & { class?: HTMLAttributes['class'] }>()
</script>
