<template>
  <nav class="flex flex-wrap" :aria-label="ariaLabel">
    <!--
      A footer entry is a DESTINATION, so it renders as a link and not as a
      button that happens to look like one. It used to be a bare `Button`, which
      meant the whole row carried no href at all: nothing opened, nothing could
      be middle-clicked or copied, and a screen reader announced four buttons
      that did nothing. `as-child` keeps the button's exact shape while the
      anchor underneath does the navigating.
    -->
    <Button v-for="link in props.links" :key="link.label" as-child size="s" color="shadow">
      <Link :to="link.link" :title="link.label">
        <component :is="link.icon" aria-hidden="true" />
        <!-- The name lives in the sr-only copy and NOT in the visible one:
             below 437px the label is `display: none`, which hides it from
             assistive tech as well, and an icon with no name is an unlabelled
             control. Hiding the visible twin is what keeps the announced name
             from being said twice at wider widths. -->
        <span class="sr-only">{{ link.label }}</span>
        <span class="link__text" aria-hidden="true">{{ link.label }}</span>
      </Link>
    </Button>
  </nav>
</template>

<script setup lang="ts">
  import { Button } from '@/shared/ui/button'
  import { Link } from '@/shared/ui/link'
  import type { FooterLink } from './types/links'

  interface Props {
    links: readonly FooterLink[]
    /** Named so the two navigations on a page are distinguishable. */
    ariaLabel?: string
  }
  const props = withDefaults(defineProps<Props>(), { ariaLabel: 'footer' })
</script>

<style scoped lang="scss">
  // Below this width the row cannot hold four labels; the icons carry it, and
  // the accessible name survives in each link's `title`.
  @media (width <=437px) {
    .link__text {
      display: none;
    }
  }
</style>
