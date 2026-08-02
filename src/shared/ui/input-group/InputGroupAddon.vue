<script setup lang="ts">
  import type { HTMLAttributes } from 'vue'
  import { cn } from '@/shared/lib/utils'
  import { inputGroupAddonVariants, type InputGroupAlign } from '.'

  /**
   * A slot at one end of the group — an icon, a hint, a button.
   *
   * Clicking the padding focuses the control, the way clicking a label does:
   * the addon is part of the field, so hitting it must not feel like hitting a
   * dead margin. A click that landed on a real button is left alone.
   */
  const props = withDefaults(
    defineProps<{ align?: InputGroupAlign; class?: HTMLAttributes['class'] }>(),
    { align: 'inline-start' }
  )

  const focusControl = (event: MouseEvent): void => {
    const target = event.target as HTMLElement | null
    if (target?.closest('button')) return
    const group = (event.currentTarget as HTMLElement | null)?.parentElement
    const control = group?.querySelector('input, textarea')
    if (control instanceof HTMLElement) control.focus()
  }
</script>

<template>
  <div
    role="group"
    data-slot="input-group-addon"
    :data-align="props.align"
    :class="cn(inputGroupAddonVariants({ align: props.align }), props.class)"
    @click="focusControl"
  >
    <slot />
  </div>
</template>
