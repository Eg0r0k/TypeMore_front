<script setup lang="ts">
  import type { HTMLAttributes } from 'vue'
  import type { RouteLocationRaw } from 'vue-router'
  import { RouterLink } from 'vue-router'

  export interface LinkProps {
    to: RouteLocationRaw
    replace?: boolean
    target?: string
    rel?: string
    activeClass?: string
    exactActiveClass?: string
    ariaCurrentValue?: 'page' | 'step' | 'location' | 'date' | 'time' | 'true' | 'false'
    class?: HTMLAttributes['class']
  }

  defineProps<LinkProps>()
</script>

<template>
  <RouterLink
    :to="to"
    :replace="replace"
    :target="target"
    :rel="rel"
    :active-class="activeClass"
    :exact-active-class="exactActiveClass"
    :aria-current-value="ariaCurrentValue"
    :class="$props.class"
  >
    <slot />
  </RouterLink>
</template>
