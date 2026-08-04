<template>
  <div class="flex w-full flex-col gap-3 p-3" data-testid="profile-mini">
    <!-- Identity, on every state that has a name to show: a card that says
         "closed" still has to say WHOSE. -->
    <div class="flex items-center gap-2.5">
      <UserAvatar :name="name" :src="header?.avatarUrl ?? undefined" class="size-10 shrink-0" />
      <div class="flex min-w-0 flex-col">
        <span class="min-w-0 truncate font-semibold text-text" :title="name">{{ name }}</span>
        <span v-if="joined" class="text-xs text-sub">{{ joined }}</span>
      </div>
    </div>

    <!-- The showcase, when the profile is open and its owner picked any. -->
    <TooltipProvider v-if="badges.length" :delay-duration="80">
      <div class="flex flex-wrap items-center gap-1.5" data-testid="profile-mini-badges">
        <BadgeChip v-for="badge in badges" :key="badge.code" :badge="badge" />
      </div>
    </TooltipProvider>

    <p
      v-if="bio"
      class="line-clamp-3 whitespace-pre-line text-sm text-sub"
      data-testid="profile-mini-bio"
    >
      {{ bio }}
    </p>

    <!-- The three numbers worth a glance mid-lobby: how fast, how accurate,
         how much. Everything else is a click away and the card stays small. -->
    <div v-if="stats.length" class="grid grid-cols-3 gap-2" data-testid="profile-mini-stats">
      <div v-for="stat in stats" :key="stat.label" class="flex flex-col">
        <span class="text-base tabular-nums text-main">{{ stat.value }}</span>
        <span class="text-[11px] leading-tight text-sub">{{ stat.label }}</span>
      </div>
    </div>

    <p
      v-if="keyboard"
      class="inline-flex items-center gap-1.5 text-xs text-sub"
      data-testid="profile-mini-keyboard"
    >
      <Keyboard class="size-3.5 shrink-0" aria-hidden="true" />
      <span class="min-w-0 truncate">{{ keyboard }}</span>
    </p>

    <div v-if="links.length" class="flex flex-wrap items-center gap-3">
      <a
        v-for="link in links"
        :key="link.kind"
        :href="linkUrl(link.kind, link.handle)"
        target="_blank"
        rel="noopener noreferrer"
        class="focus-ring inline-flex min-w-0 items-center gap-1 rounded-sm text-xs text-sub transition-tm hover:text-text"
        :data-testid="`profile-mini-link-${link.kind}`"
      >
        <component :is="LINK_ICONS[link.kind]" class="size-3.5 shrink-0" aria-hidden="true" />
        <span class="min-w-0 truncate">{{ link.handle }}</span>
      </a>
    </div>

    <!-- The states that replace the body. Each is its own `v-if` against one
         computed value rather than a chain: a chain here is one stray node away
         from detaching, and this component renders inside a popover where that
         would be invisible until somebody opened it. -->
    <p v-if="state === 'loading'" class="text-sm text-sub" data-testid="profile-mini-loading">
      {{ t('profile.loading') }}
    </p>
    <p v-if="state === 'closed'" class="text-sm text-sub" data-testid="profile-mini-closed">
      {{ t('user.closed') }}
    </p>
    <p v-if="state === 'missing'" class="text-sm text-sub" data-testid="profile-mini-missing">
      {{ t('user.notFound', { name }) }}
    </p>
    <p v-if="state === 'error'" class="text-sm text-sub" data-testid="profile-mini-error">
      {{ t('profile.mini.error') }}
    </p>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useQuery } from '@tanstack/vue-query'
  import { Keyboard } from '@lucide/vue'
  import IconBrandGithub from '~icons/tabler/brand-github'
  import IconBrandYoutube from '~icons/tabler/brand-youtube'
  import IconBrandTwitch from '~icons/tabler/brand-twitch'

  import {
    isApiError,
    linkUrl,
    publicProfileQueryOptions,
    publicProfileSummaryQueryOptions,
    type LinkKind
  } from '@shared/api'
  import { BadgeChip, badgesOf } from '@/entities/badge'
  import { formatShortDate } from '@/shared/lib/helpers/datetime'
  import { groupThousands, percent } from '@/shared/lib/helpers/numbers'
  import { UserAvatar } from '@/shared/ui/avatar'
  import { TooltipProvider } from '@/shared/ui/tooltip'

  /**
   * A player's profile in the space of a popover: who they are, the three
   * numbers worth a glance, and a link to the rest.
   *
   * It asks the PUBLIC endpoints by display name, which is the whole reason it
   * needs nothing new from the server — a seat's `nick` IS the account's
   * `display_name` for an authenticated player (the relay resolves it at the
   * upgrade), so `/users/{nick}` is already the right question. A GUEST has no
   * account and therefore no card at all; refusing to render one is the
   * caller's job, because only the caller knows the seat.
   *
   * Privacy stays the server's, exactly as on the full page: a closed profile
   * answers the header (name, joined, closed) and refuses everything else, and
   * a banned or non-existent name answers 404 — the two are deliberately
   * indistinguishable from here, and this card must not out-guess that.
   *
   * The queries are the SAME `queryOptions` the profile page uses, so opening a
   * card warms the page and a page already visited opens the card from cache.
   */
  const props = defineProps<{
    /** The player's display name — the public profile is addressed by it. */
    name: string
  }>()

  const { t } = useI18n()

  const LINK_ICONS: Record<LinkKind, unknown> = {
    github: IconBrandGithub,
    youtube: IconBrandYoutube,
    twitch: IconBrandTwitch
  }

  const headerQuery = useQuery(computed(() => publicProfileQueryOptions(props.name)))

  const header = computed(() => headerQuery.data.value)
  const isOpenProfile = computed(() => header.value?.public === true)

  /**
   * The numbers are a SECOND request and are asked for only when the header
   * said the profile is open — otherwise this card would collect a 403 on
   * every hover of a private player, which is a refusal the server already
   * answered once.
   */
  const gatedBy = <T extends object>(options: T, on: boolean): T & { enabled: boolean } => ({
    ...options,
    enabled: on
  })
  const summaryQuery = useQuery(
    computed(() => gatedBy(publicProfileSummaryQueryOptions(props.name), isOpenProfile.value))
  )

  const state = computed<'loading' | 'open' | 'closed' | 'missing' | 'error'>(() => {
    if (headerQuery.isPending.value) return 'loading'
    const error = headerQuery.error.value
    if (error) return isApiError(error) && error.status === 404 ? 'missing' : 'error'
    return isOpenProfile.value ? 'open' : 'closed'
  })

  const joined = computed(() =>
    header.value ? t('profile.joined', { date: formatShortDate(header.value.joined) }) : ''
  )

  // Everything below the identity line exists only on an OPEN profile: the
  // server omits it otherwise, and these guards keep that true even if it
  // one day does not.
  const bio = computed(() => (isOpenProfile.value ? (header.value?.bio ?? '') : ''))
  const keyboard = computed(() => (isOpenProfile.value ? (header.value?.keyboard ?? '') : ''))
  const links = computed(() => (isOpenProfile.value ? (header.value?.links ?? []) : []))
  const badges = computed(() => (isOpenProfile.value ? badgesOf(header.value?.badges ?? []) : []))

  /** wpm and accuracy as the last-10 average — "how they type NOW", which is
      what a lobby is asking — and the completed-test count for scale. */
  const stats = computed(() => {
    const summary = summaryQuery.data.value
    if (!summary) return []
    return [
      { label: t('profile.metric.wpm'), value: Math.round(summary.wpm.averageLast10) },
      { label: t('profile.metric.acc'), value: percent(summary.acc.averageLast10) },
      { label: t('profile.testsCompleted'), value: groupThousands(summary.testsCompleted) }
    ]
  })
</script>
