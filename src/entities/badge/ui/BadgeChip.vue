<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <!-- A span, not a button: a badge is a label, and a control that does
           nothing on click is a promise the interface cannot keep. tabindex
           makes it reachable so the tooltip is not pointer-only. -->
      <span
        class="focus-ring inline-flex items-center gap-1 rounded-md bg-sub-alt px-1.5 py-0.5 text-xs"
        :class="badge.tone === 'main' ? 'text-main' : 'text-sub'"
        tabindex="0"
        data-testid="badge-chip"
        :data-badge="badge.code"
      >
        <component :is="badge.icon" class="size-3.5" />
        <span>{{ badge.name }}</span>
      </span>
    </TooltipTrigger>
    <TooltipContent>{{ badge.description }}</TooltipContent>
  </Tooltip>
</template>

<script setup lang="ts">
  import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'
  import type { BadgeDefinition } from '../registry'

  /**
   * One badge, as a chip with its description one hover (or focus) away.
   *
   * Takes a DEFINITION rather than a code: resolving a code is the caller's
   * job, because a code this build cannot draw must render nothing at all
   * rather than an empty chip, and that decision belongs where the list is
   * filtered — not in a component that has already been mounted.
   */
  defineProps<{ badge: BadgeDefinition }>()
</script>
