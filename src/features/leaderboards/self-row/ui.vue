<template>
  <!--
    STICKY on purpose: your own standing stays in view while the ranking
    scrolls under it. It sits under the popup/modal layers (no z-index token —
    plain 1 beats the rows and nothing else).
  -->
  <div class="sticky top-0 z-1 bg-bg" data-testid="boards-self">
    <div
      v-if="state === 'ranked' && entry !== null"
      class="bg-sub-alt text-main"
      :class="[BOARD_GRID, TABLE_GRID_ROW]"
    >
      <span class="text-xl font-bold leading-none tabular-nums" data-testid="boards-self-rank">
        #{{ entry.rank }}
      </span>
      <span class="flex min-w-0 items-baseline gap-2">
        <!-- Your own nick opens YOUR profile page (/profile) — the full,
             session-scoped one, not the public preview. -->
        <RouterLink
          :to="routeLocation.profile()"
          class="truncate underline-offset-2 hover:underline focus-visible:underline"
          data-testid="boards-self-profile-link"
        >
          {{ entry.displayName }}
        </RouterLink>
        <span
          v-if="percent !== null"
          class="shrink-0 rounded bg-main px-2 py-px text-[0.7rem] text-bg"
          data-testid="boards-self-top"
        >
          {{ t('boards.self.top', { percent }) }}
        </span>
        <BoardModChips :mods="entry.mods" />
      </span>
      <span class="inline-flex items-baseline gap-1.5">
        <span class="rounded bg-main px-1 text-lg text-bg font-bold">{{ entry.grade }}</span>
        <span class="font-bold text-sm text-sub tabular-numss" data-testid="boards-self-score">
          {{ formatScore(entry.score) }}
        </span>
      </span>
      <span class="text-end tabular-nums">{{ formatWpm(entry.wpm) }}</span>
      <span class="text-end tabular-nums">{{ formatWpm(entry.raw) }}</span>
      <span class="text-end tabular-nums">{{ formatAccuracy(entry.acc) }}</span>
      <span class="text-end text-sub">{{ whenLabel(entry) }}</span>
    </div>

    <!-- 204: identified, no slot here. An invitation, never an error. -->
    <RouterLink
      v-else-if="state === 'unranked'"
      class="block px-2 py-1.5 text-[0.8rem] text-sub no-underline transition-tm hover:text-main focus-visible:text-main"
      data-testid="boards-self-play"
      :to="routeLocation.home()"
    >
      {{ t('boards.self.play') }}
    </RouterLink>

    <!-- 401: a public page stays public; the strip only hints. -->
    <RouterLink
      v-else-if="state === 'guest'"
      class="block px-2 py-1.5 text-[0.8rem] text-sub no-underline transition-tm hover:text-main focus-visible:text-main"
      data-testid="boards-self-sign-in"
      :to="routeLocation.login()"
    >
      {{ t('boards.self.signIn') }}
    </RouterLink>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { RouterLink } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import type { BoardEntry } from '@shared/api'
  import { routeLocation } from '@/shared/router'
  import { TABLE_GRID_ROW } from '@/shared/ui/table'
  import { BOARD_GRID } from '../board-grid'
  import { BoardModChips } from '../mod-chips'
  import { topPercent } from '../model/percentile'
  import { formatAccuracy, formatRelativeAchievedAt, formatScore, formatWpm } from '../model/format'
  import type { OwnRankState } from '../model/use-own-rank'

  /**
   * The pinned self row: your rank, writ large, your percentile, and then the
   * SAME columns the table renders — one shared grid definition
   * (`../board-grid`) painted by the app's shared table recipe, so the numbers
   * line up with the rows scrolling under them. States mirror what `/me` can
   * honestly answer (see `useOwnRank`).
   */
  const props = defineProps<{
    state: OwnRankState
    entry: BoardEntry | null
    /** The bucket's visible entry count, from the catalogue — the percentile's denominator. */
    entriesTotal?: number
  }>()

  const { t, locale } = useI18n()

  const percent = computed(() =>
    props.entry === null ? null : topPercent(props.entry.rank, props.entriesTotal)
  )

  const whenLabel = (entry: BoardEntry): string =>
    formatRelativeAchievedAt(entry.achievedAt, locale.value)
</script>
