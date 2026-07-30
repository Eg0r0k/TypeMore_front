<script setup lang="ts">
  import type { PrimitiveProps } from 'reka-ui'
  import type { HTMLAttributes } from 'vue'
  import { Primitive } from 'reka-ui'
  import { cn } from '@/shared/lib/utils'
  import type { ButtonColor, ButtonSize } from '.'
  import { buttonVariants } from '.'

  export interface ButtonI extends PrimitiveProps {
    color?: ButtonColor
    size?: ButtonSize
    class?: HTMLAttributes['class']
  }

  const props = withDefaults(defineProps<ButtonI>(), {
    as: 'button',
    color: 'main',
    size: 'm'
  })
</script>

<template>
  <Primitive :as="as" :as-child="asChild" :class="cn(buttonVariants({ color, size }), props.class)">
    <slot />
  </Primitive>
</template>
