<template>
  <component
    :is="props.tagName"
    v-bind="tagName === 'a' ? { href: props.href } : {}"
    :class="classes"
  >
    <slot></slot>
  </component>
</template>

<script setup lang="ts">
  import { computed, type HTMLAttributes } from 'vue'

  import { cn } from '@/shared/lib/utils'
  import { typographyVariants, type TypographyVariants } from './variants'

  interface Props {
    isBold?: boolean
    tagName?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'a'
    size?: NonNullable<TypographyVariants['size']>
    color?: NonNullable<TypographyVariants['color']>
    decoration?: 'underline'
    href?: string
    class?: HTMLAttributes['class']
  }
  const props = withDefaults(defineProps<Props>(), {
    color: 'unset',
    isBold: false,
    tagName: 'p',
    size: 's'
  })

  /**
   * Composed through `cn` (tailwind-merge), not string concatenation: a caller
   * passing `class="text-xs"` then WINS over the size variant instead of racing
   * it on stylesheet order — which is exactly what the old scoped-BEM version
   * could not do.
   */
  const classes = computed(() =>
    cn(
      typographyVariants({
        size: props.size,
        color: props.color,
        decoration: props.decoration,
        isBold: props.isBold
      }),
      props.class
    )
  )
</script>
