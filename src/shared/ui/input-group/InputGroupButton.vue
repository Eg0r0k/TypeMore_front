<script setup lang="ts">
  import type { HTMLAttributes } from 'vue'
  import { Button } from '@/shared/ui/button'
  import type { ButtonColor } from '@/shared/ui/button'
  import { cn } from '@/shared/lib/utils'

  /**
   * A button that lives inside the group. Sized to sit on the field's own line
   * without stretching it, and `shadow` by default so it reads as part of the
   * control rather than as a second surface on top of one.
   */
  const props = withDefaults(
    defineProps<{ color?: ButtonColor; class?: HTMLAttributes['class'] }>(),
    { color: 'shadow' }
  )
</script>

<template>
  <Button
    :color="props.color"
    size="icon-sm"
    :class="cn('shrink-0 rounded-md', props.class)"
  >
    <slot />
  </Button>
</template>
