<script setup lang="ts">
  import { computed, type HTMLAttributes } from 'vue'
  import type { RouteLocationRaw } from 'vue-router'
  import { RouterLink } from 'vue-router'

  export interface LinkProps {
    /**
     * A route (by name or by path) OR an absolute url. Both go through this one
     * component on purpose: a caller holding a LIST of destinations — the
     * footer, a social row — should not have to sort them into two kinds of
     * markup, and the rule for telling them apart belongs in one place rather
     * than in every such list.
     */
    to: RouteLocationRaw
    replace?: boolean
    target?: string
    rel?: string
    activeClass?: string
    exactActiveClass?: string
    ariaCurrentValue?: 'page' | 'step' | 'location' | 'date' | 'time' | 'true' | 'false'
    class?: HTMLAttributes['class']
  }

  const props = defineProps<LinkProps>()

  /**
   * Anything that leaves the app: an absolute url, a protocol-relative one, or
   * a `mailto:`/`tel:`. A RouterLink cannot express these — vue-router resolves
   * them as paths and lands on the catch-all — so they render as an anchor.
   */
  const EXTERNAL_PREFIXES = ['http://', 'https://', '//', 'mailto:', 'tel:'] as const

  const externalHref = computed<string | null>(() => {
    const to = props.to
    if (typeof to !== 'string') return null
    return EXTERNAL_PREFIXES.some((prefix) => to.startsWith(prefix)) ? to : null
  })

  /**
   * An outbound link opens in a new tab and is isolated from the opener unless
   * the caller says otherwise. `noopener` is the security half — the opened
   * page gets no handle on this one — and it is a default here rather than
   * something every call site has to remember.
   */
  const outboundTarget = computed(() => props.target ?? '_blank')
  const outboundRel = computed(() =>
    props.rel ?? (outboundTarget.value === '_blank' ? 'noopener noreferrer' : undefined)
  )
</script>

<template>
  <a
    v-if="externalHref"
    :href="externalHref"
    :target="outboundTarget"
    :rel="outboundRel"
    :class="$props.class"
  >
    <slot />
  </a>
  <RouterLink
    v-else
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
