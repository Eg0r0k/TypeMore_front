<template>
  <div class="relative flex min-w-0 flex-col" data-testid="profile-identity">
    <!--
      1.1 — the banner. A flat surface, not a card: no gradient, no image, no
      shadow, and only its TOP corners are rounded, because what sits under it
      is the same block continuing on the page background.
    -->
    <div
      class="relative h-24 overflow-hidden rounded-t-[6px] bg-main sm:h-36"
      data-testid="profile-banner"
    >
      <!-- 1.2 — the wpm line, across the banner's UPPER band. Full width reads
           as texture where a chart pinned to one corner read as a stray chart;
           the band stops well above the avatar, which owns the bottom third. -->
      <ProfileSparkline :points="recentWpm" class="absolute h-full opacity-70 left-0" />
      <!-- 1.2b — "copy this profile's link", in the banner's top-right corner.
           Over the sparkline rather than beside the nick: it is chrome for the
           PAGE, not a fact about the player, and the corner is where a reader
           already looks for a share action. -->
      <!-- 1.2b — the page's own chrome, top-right: share, report, and the
           player's links under them. The links sit here rather than in the
           meta line because they are OUTBOUND — somewhere else to go — and
           grouping them with the two buttons keeps every "leave this page"
           control in one corner instead of scattered through the facts. -->
      <div
        class="absolute right-3 top-0 py-3 flex flex-col justify-between h-full items-end gap-1.5"
      >
        <!-- Its own provider: the report button carries a tooltip, and this
             header is mounted by pages that have no reason to know that. -->
        <TooltipProvider v-if="!shareName || !canReport" :delay-duration="80">
          <div class="flex items-center gap-1.5">
            <ProfileCopyLink v-if="shareName" :name="shareName" />
            <Tooltip v-if="canReport">
              <TooltipTrigger as-child>
                <Button
                  color="shadow"
                  size="icon-sm"
                  :aria-label="t('report.title.user')"
                  data-testid="profile-report"
                  @click="emit('report')"
                >
                  <IconFlag class="size-4 text-background!" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{{ t('report.title.user') }}</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>

        <div v-if="links.length" class="flex items-end gap-4">
          <a
            v-for="link in links"
            :key="link.kind"
            :href="linkUrl(link.kind, link.handle)"
            target="_blank"
            rel="noopener noreferrer"
            class="focus-ring inline-flex min-w-0 items-center gap-1.5 rounded-sm text-xs text-background! transition-tm hover:text-sub"
            :data-testid="`profile-link-${link.kind}`"
          >
            <span class="min-w-0 truncate">{{ link.handle }}</span>
            <component :is="LINK_ICONS[link.kind]" class="size-4 shrink-0" aria-hidden="true" />
          </a>
        </div>
      </div>
    </div>

    <!--
      1.3 — the avatar, exactly half over the banner's bottom edge: the ring is
      the page background, so the circle reads as punched out of the banner.
      `relative` is not decoration — the banner above is a positioned element,
      and a static avatar would be painted UNDER it however late it comes in
      the markup.

      On your OWN page it is also the way into settings — the header has no
      button of its own, and your own face is the thing on this page that means
      "you". It opens on the ACCOUNT tab, because everything this header shows
      (bio, keyboard, links, the badge showcase) is edited there and a click on
      your own face means "let me change this", not "let me change the caret".
      Somebody else's avatar is a picture and nothing more.
    -->
    <button
      v-if="own"
      type="button"
      class="group relative -mt-8 size-16 ring-4 ring-bg sm:size-24 w-fit rounded-full transition-tm focus-ring sm:-mt-12"
      :aria-label="t('settings.title')"
      :title="t('settings.title')"
      data-testid="profile-settings"
      @click="dialogs.openSettings('account')"
    >
      <UserAvatar
        :name="summary.displayName"
        :src="avatarSrc"
        class="w-full h-full"
        data-testid="profile-avatar"
      />
      <span
        class="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-black/45 opacity-0 transition-tm group-hover:opacity-100 group-focus-visible:opacity-100"
        aria-hidden="true"
      >
        <Pencil class="size-5 text-white sm:size-6" />
      </span>
    </button>
    <UserAvatar
      v-else
      :name="summary.displayName"
      :src="avatarSrc"
      class="relative -mt-8 size-16 ring-4 ring-bg sm:-mt-12 sm:size-24"
      data-testid="profile-avatar"
    />

    <!--
      1.5 — the nick. `min-w-0` + `truncate` is what keeps a 24-character
      handle from pushing the layout; the full name stays in the title.
      The identity line under it (rating and place) is deliberately absent:
      the API serves no TP and no position, and a placeholder would be a
      number this page invented.
    -->
    <div class="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
      <h1
        class="min-w-0 truncate text-[22px] font-semibold leading-tight text-text sm:text-[28px]"
        :title="summary.displayName"
        data-testid="profile-nick"
      >
        {{ summary.displayName }}
      </h1>
      <!-- The showcase sits ON the name line: a badge is a fact about WHO this
           is, so it belongs where the reader is already looking, and it is the
           one piece of the identity half worth seeing before anything else. It
           wraps to its own line rather than squeezing a long handle. -->
      <TooltipProvider v-if="shownBadges.length" :delay-duration="80">
        <div class="flex flex-wrap items-center gap-1.5" data-testid="profile-badges">
          <BadgeChip v-for="badge in shownBadges" :key="badge.code" :badge="badge" />
        </div>
      </TooltipProvider>
    </div>

    <!-- 1.5b — the bio, straight under the name it belongs to: it is the
         player's own sentence about themselves, so it reads as part of the
         identity rather than as a footnote after the numbers. Plain text with
         `whitespace-pre-line` — the server stores no markup and this renders
         none. -->
    <p
      v-if="bio"
      class="mt-2 max-w-prose whitespace-pre-line text-sm text-sub"
      data-testid="profile-bio"
    >
      {{ bio }}
    </p>

    <!-- 1.6 — the meta line: how long they have been here, and whether they
         are here today. -->
    <div
      class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-sub"
      data-testid="profile-meta"
    >
      <span class="inline-flex items-center gap-1.5" data-testid="profile-joined">
        <CalendarDays class="size-4 shrink-0" aria-hidden="true" />
        <span :title="joinedFull">{{ t('profile.joined', { date: joinedDate }) }}</span>
      </span>
      <!-- No streak is not "streak: 0": the icon goes too, so the line reads as
           a fact about this player rather than a zeroed counter. -->
      <span class="inline-flex items-center gap-1.5" data-testid="profile-streak">
        <Flame v-if="hasStreak" class="size-4 shrink-0" aria-hidden="true" />
        <span class="tabular-nums">{{ streakText }}</span>
      </span>
    </div>

    <!-- 1.6b — the board they type on, its own line under the meta. It is a
         fact about the person like the two above it, but a longer one: a full
         keyboard name would push "joined" and the streak off a phone. -->
    <div
      v-if="keyboard"
      class="mt-1.5 flex min-w-0 items-center gap-1.5 text-sm text-sub"
      data-testid="profile-keyboard"
    >
      <Keyboard class="size-4 shrink-0" aria-hidden="true" />
      <span class="min-w-0 truncate">{{ keyboard }}</span>
    </div>

    <!--
      1.7 — the counters. Every figure here is the server's own: the runs it
      judged, the time it measured, and the days since the join date it serves.
      Nothing is a link, because none of the three leads anywhere yet.
    -->
    <div class="mt-6 flex flex-wrap items-baseline gap-x-6 gap-y-2" data-testid="profile-counters">
      <div
        v-for="counter in counters"
        :key="counter.testid"
        class="inline-flex items-baseline gap-1.5"
      >
        <span class="font-semibold tabular-nums text-text" :data-testid="counter.testid">
          {{ counter.value }}
        </span>
        <span class="text-sm text-sub">{{ counter.label }}</span>
      </div>
    </div>

    <!-- 1.8 — the languages, most-played first. -->
    <div class="mt-6" data-testid="profile-languages">
      <!-- A brand-new account has no languages BECAUSE it has no runs; saying
           so with the way out beats an empty strip. -->
      <p v-if="noRuns" class="text-sm text-sub" data-testid="profile-no-runs">
        {{ t('profile.identity.noRuns') }}
        <RouterLink class="link-main" :to="routeLocation.home()">
          {{ t('profile.identity.startTyping') }}
        </RouterLink>
      </p>

      <div v-else-if="languages.length > 0" class="flex flex-wrap items-center gap-2">
        <span
          v-for="entry in shownLanguages"
          :key="entry.lang"
          class="rounded-[6px] bg-sub-alt px-2 py-1 text-xs text-sub"
        >
          {{ entry.lang }} ·
          <span class="tabular-nums">{{ groupThousands(entry.tests) }}</span>
        </span>
        <!-- The rest expand in place; the row never scrolls and never grows a
             second control. -->
        <button
          v-if="hiddenCount > 0"
          type="button"
          class="h-11 rounded-[6px] border border-sub px-2 text-xs text-sub transition-tm focus-ring hover:text-text sm:h-auto sm:py-1"
          :aria-expanded="expanded"
          data-testid="profile-languages-more"
          @click="expanded = !expanded"
        >
          {{
            expanded
              ? t('profile.identity.fewerLangs')
              : t('profile.identity.moreLangs', { n: hiddenCount })
          }}
        </button>
      </div>
    </div>

    <!-- 1.9 — the header ends here; everything below is the profile as it was. -->
    <div class="mt-6 border-t border-sub-alt" />
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { RouterLink } from 'vue-router'
  import { CalendarDays, Flame, Keyboard, Pencil } from '@lucide/vue'
  import IconBrandGithub from '~icons/tabler/brand-github'
  import IconBrandYoutube from '~icons/tabler/brand-youtube'
  import IconBrandTwitch from '~icons/tabler/brand-twitch'

  import IconFlag from '~icons/tabler/flag'

  import { BadgeChip, badgesOf } from '@/entities/badge'
  import { linkUrl } from '@shared/api'
  import { Button } from '@/shared/ui/button'
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
  import ProfileCopyLink from '../copy-link/ui.vue'

  import type { LinkKind, ProfileSummary, UserLink } from '@shared/api'
  import { useDialogsStore } from '@/entities/dialogs'
  import { formatExactInstant, formatShortDate } from '@/shared/lib/helpers/datetime'
  import { groupThousands } from '@/shared/lib/helpers/numbers'
  import { routeLocation } from '@/shared/router'
  import { UserAvatar } from '@/shared/ui/avatar'
  import { formatClock } from '../model/format'
  import ProfileSparkline from './sparkline.vue'

  /**
   * The profile header — banner, avatar, identity, counters, languages.
   *
   * Composition follows a social profile (banner → half-overlapping avatar →
   * name → meta → counters → chips) because that is the shape a reader already
   * knows: identity first, then how long, then how much, then what.
   *
   * Every number is the summary's own. Deliberately absent, because the API
   * does not serve them: TP and board position (§1.5), and a characters-typed
   * counter (§1.7 — the server counts runs, milliseconds and estimated WORDS).
   */
  const props = withDefaults(
    defineProps<{
      summary: ProfileSummary
      /** wpm of the recent runs, oldest first — the banner's sparkline. */
      recentWpm?: readonly number[]
      /** The viewer's OWN page: only there does the header offer an action. */
      own?: boolean
      /**
       * The identity half (backend 00029). Optional throughout: a profile
       * whose owner filled nothing in renders exactly the header it rendered
       * before these existed — no empty showcase, no placeholder bio.
       */
      bio?: string | null
      keyboard?: string | null
      links?: readonly UserLink[]
      /** Badge CODES, in their owner's order. */
      badges?: readonly string[]
      /**
       * The display name the share link is built from. Absent on a page with
       * no public URL to offer.
       */
      shareName?: string | null
      /**
       * Offer the "report this player" button. The PAGE decides: reporting
       * needs a session and a subject that is not yourself, and neither is
       * this component's business.
       */
      canReport?: boolean
    }>(),
    {
      recentWpm: () => [],
      own: false,
      bio: null,
      keyboard: null,
      shareName: null,
      canReport: false
    }
  )

  /** The page hosts the report dialog; this only asks for it. */
  const emit = defineEmits<{ report: [] }>()

  const { t, locale } = useI18n()
  /** The settings dialog itself lives in App.vue; this only asks for it. */
  const dialogs = useDialogsStore()

  /**
   * The picture, straight off the summary. Nothing serves it today; the header
   * asks for it anyway so that "avatars exist now" is a server change and a
   * schema line, not a change to this page (see ProfileSummarySchema).
   */
  const avatarSrc = computed(() => props.summary.avatarUrl ?? null)

  const LINK_ICONS: Record<LinkKind, unknown> = {
    github: IconBrandGithub,
    youtube: IconBrandYoutube,
    twitch: IconBrandTwitch
  }

  const links = computed(() => props.links ?? [])
  /**
   * Codes this build cannot draw are dropped rather than rendered blank: a
   * grant of a retired code is a real row the server keeps serving forever,
   * and a client one deploy behind will meet codes it has never heard of.
   */
  const shownBadges = computed(() => badgesOf(props.badges ?? []))

  const joinedDate = computed(() => formatShortDate(props.summary.joined, locale.value))
  /** The exact instant, for the title — the visible date is deliberately short. */
  const joinedFull = computed(() => formatExactInstant(props.summary.joined, locale.value))

  const hasStreak = computed(() => props.summary.streak.current > 0)
  const streakText = computed(() =>
    hasStreak.value
      ? t('profile.identity.streak', {
          current: props.summary.streak.current,
          best: props.summary.streak.best
        })
      : t('profile.identity.noStreak')
  )

  const DAY_MS = 86_400_000
  /**
   * Days here, counted inclusively: the join day is day one, which is what
   * "с нами с 03.08.2026" already claims on the line above.
   */
  const daysHere = computed(() => {
    const joined = Date.parse(props.summary.joined)
    if (Number.isNaN(joined)) return 0
    return Math.max(1, Math.floor((Date.now() - joined) / DAY_MS) + 1)
  })

  const counters = computed(() => [
    {
      value: groupThousands(props.summary.testsCompleted),
      label: t('profile.identity.runs', props.summary.testsCompleted),
      testid: 'profile-counter-runs'
    },
    {
      value: formatClock(props.summary.timeTypingMs),
      label: t('profile.timeTyping'),
      testid: 'profile-counter-time'
    },
    {
      value: groupThousands(daysHere.value),
      label: t('profile.identity.days', daysHere.value),
      testid: 'profile-counter-days'
    }
  ])

  /** Most-played first — the server's order is not guaranteed to be this one. */
  const languages = computed(() => [...props.summary.languages].sort((a, b) => b.tests - a.tests))

  const TOP_LANGUAGES = 5
  const expanded = ref(false)
  const shownLanguages = computed(() =>
    expanded.value ? languages.value : languages.value.slice(0, TOP_LANGUAGES)
  )
  const hiddenCount = computed(() => Math.max(0, languages.value.length - TOP_LANGUAGES))

  const noRuns = computed(
    () => props.summary.testsCompleted === 0 && props.summary.languages.length === 0
  )
</script>
