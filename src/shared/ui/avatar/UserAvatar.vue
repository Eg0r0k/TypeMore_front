<template>
  <Avatar v-bind="a11y" :size="size" :shape="shape" :class="props.class">
    <!-- Rendered only when there is something to render: with no `src` reka
         would keep an <img> in the DOM waiting for a URL that never comes. -->
    <AvatarImage v-if="src" :src="src" :alt="label ?? ''" />
    <!--
      `undefined`, not `0`, when there is no picture. reka starts the fallback
      hidden whenever `delayMs` is passed at all and only reveals it from a
      timer it sets for a TRUTHY delay — so `0` means "never render", which is
      an empty circle for every account that has no avatar, i.e. all of them
      today. Undefined renders it at once.
    -->
    <AvatarFallback :delay-ms="src ? FALLBACK_DELAY_MS : undefined">
      <span v-if="initials" class="font-bold">{{ initials }}</span>
      <!-- Nobody in particular (a guest seat, an unresolved name): an icon, at
           45% of the circle, so it scales with it like the initials do. -->
      <UserRound v-else class="size-[45%]" aria-hidden="true" />
    </AvatarFallback>
  </Avatar>
</template>

<script setup lang="ts">
  import { computed, type HTMLAttributes } from 'vue'
  import { UserRound } from '@lucide/vue'

  import Avatar from './Avatar.vue'
  import AvatarFallback from './AvatarFallback.vue'
  import AvatarImage from './AvatarImage.vue'
  import type { AvatarShape, AvatarSize } from '.'

  /**
   * A PLAYER's avatar: their picture when there is one, their initials when
   * there is not, a person icon when there is not even a name.
   *
   * The picture is the forward-looking half. No endpoint serves an avatar URL
   * today — no schema in `shared/api` has the field — so every call site passes
   * `src` as whatever it has (today: nothing). When the server grows the field,
   * the work is adding it to the schema and handing it to this prop; nothing
   * about the layout, the fallbacks or the sizes changes, because a missing and
   * a broken picture already render the same way they will then.
   *
   * Accessibility: an avatar next to the name it belongs to is decoration and
   * says so (`aria-hidden`). Give it a `label` only where it stands ALONE and a
   * reader would otherwise be told nothing.
   */
  const props = defineProps<{
    /** Display name — the initials come from it. */
    name?: string | null
    /** Picture URL, when the account has one. */
    src?: string | null
    /** Accessible name; without it the avatar is hidden from readers. */
    label?: string
    size?: AvatarSize
    shape?: AvatarShape
    class?: HTMLAttributes['class']
  }>()

  /** Long enough that a cached picture never flashes initials first. */
  const FALLBACK_DELAY_MS = 200

  /**
   * `preview_you` → `PY`, `Егор` → `Е`, `ada lovelace` → `AL`. Underscores and
   * dots are word breaks because that is how display names are actually built
   * here; a name that is one word gives one letter rather than two arbitrary
   * ones.
   */
  const initials = computed(() => {
    const words = (props.name ?? '')
      .split(/[\s._-]+/)
      .filter((word) => word.length > 0)
      .slice(0, 2)
    return words.map((word) => (Array.from(word)[0] ?? '').toLocaleUpperCase()).join('')
  })

  const a11y = computed(() =>
    props.label === undefined
      ? { 'aria-hidden': 'true' as const }
      : { role: 'img', 'aria-label': props.label }
  )
</script>
