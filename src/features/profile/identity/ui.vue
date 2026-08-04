<template>
  <!-- Nothing filled in renders NOTHING: no empty showcase, no "no badges yet",
       no placeholder bio. A profile whose owner wrote nothing looks exactly as
       it did before this section existed. -->
  <div v-if="hasAnything" class="flex flex-col gap-3" data-testid="profile-identity">
    <!-- Its OWN provider: the chips carry tooltips, and this section is
         mounted by pages that have no reason to know that. A nested provider
         is legal and is what keeps the component self-contained. -->
    <TooltipProvider v-if="badges.length" :delay-duration="80">
      <div class="flex flex-wrap gap-1.5" data-testid="profile-badges">
        <BadgeChip v-for="badge in badges" :key="badge.code" :badge="badge" />
      </div>
    </TooltipProvider>

    <!-- Plain text, interpolated: the server stores no markup and this renders
         none. `whitespace-pre-line` keeps the author's line breaks without
         letting anything else through. -->
    <Typography
      v-if="bio"
      class="max-w-prose whitespace-pre-line"
      size="s"
      color="sub"
      data-testid="profile-bio"
    >
      {{ bio }}
    </Typography>

    <div v-if="keyboard || links.length" class="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      <span
        v-if="keyboard"
        class="flex items-center gap-1.5 text-sm text-sub"
        data-testid="profile-keyboard"
      >
        <IconKeyboard class="size-4 shrink-0" aria-hidden="true" />
        <span class="min-w-0 truncate">{{ keyboard }}</span>
      </span>

      <a
        v-for="link in links"
        :key="link.kind"
        :href="linkUrl(link.kind, link.handle)"
        target="_blank"
        rel="noopener noreferrer"
        class="link-main flex items-center gap-1.5 text-sm"
        :data-testid="`profile-link-${link.kind}`"
      >
        <component :is="LINK_ICONS[link.kind]" class="size-4 shrink-0" aria-hidden="true" />
        <span class="min-w-0 truncate">{{ link.handle }}</span>
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import IconKeyboard from '~icons/tabler/keyboard'
  import IconBrandGithub from '~icons/tabler/brand-github'
  import IconBrandYoutube from '~icons/tabler/brand-youtube'
  import IconBrandTwitch from '~icons/tabler/brand-twitch'
  import { BadgeChip, badgesOf } from '@/entities/badge'
  import { linkUrl } from '@shared/api'
  import type { LinkKind, UserLink } from '@shared/api'
  import { TooltipProvider } from '@/shared/ui/tooltip'
  import { Typography } from '@/shared/ui/typography'

  /**
   * The self-described half of a profile header: the badge showcase, the bio,
   * the board, the links.
   *
   * PURE VIEW. It receives what the API served and renders it; it decides
   * nothing about visibility. A closed profile simply never gets these props —
   * the server withholds them, and a client that filtered them itself would be
   * privacy theatre over an API that already answered.
   */
  const props = defineProps<{
    bio?: string | null
    keyboard?: string | null
    links?: readonly UserLink[]
    /** Badge CODES, in the owner's order. */
    badges?: readonly string[]
  }>()

  const LINK_ICONS: Record<LinkKind, unknown> = {
    github: IconBrandGithub,
    youtube: IconBrandYoutube,
    twitch: IconBrandTwitch
  }

  const links = computed(() => props.links ?? [])

  /**
   * Codes this build cannot draw are dropped rather than rendered blank: a
   * grant of a retired code is a real row the server keeps serving, and a
   * client one deploy behind will meet codes it has never heard of.
   */
  const badges = computed(() => badgesOf(props.badges ?? []))

  const hasAnything = computed(
    () => badges.value.length > 0 || !!props.bio || !!props.keyboard || links.value.length > 0
  )
</script>
