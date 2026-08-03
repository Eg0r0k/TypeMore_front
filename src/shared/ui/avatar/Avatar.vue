<template>
  <AvatarRoot :class="cn(avatarVariant({ size, shape }), props.class)">
    <slot />
  </AvatarRoot>
</template>

<script setup lang="ts">
  import type { HTMLAttributes } from 'vue'
  import { AvatarRoot } from 'reka-ui'

  import { cn } from '@/shared/lib/utils'
  import { avatarVariant, type AvatarShape, type AvatarSize } from '.'

  /**
   * The avatar root — shadcn-vue's component over reka-ui's `AvatarRoot`, which
   * is what gives the image its load/error states for free (see AvatarImage).
   *
   * Sizing has two doors and they compose: `size` for the scale everything else
   * in the app uses, `class` for anything else (`size-[72px]`, `size-full` in a
   * grid cell, a `%` of a parent). Whatever the box ends up being, the contents
   * follow it — see the `@container` note in ./index.ts.
   */
  const props = defineProps<{
    class?: HTMLAttributes['class']
    size?: AvatarSize
    shape?: AvatarShape
  }>()
</script>
