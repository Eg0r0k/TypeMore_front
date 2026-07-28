<template>
  <!--
    STICKY on purpose: your own standing stays in view while the ranking
    scrolls under it. It sits under the popup/modal layers (no z-index token —
    plain 1 beats the rows and nothing else).
  -->
  <div class="board-self" data-testid="boards-self">
    <div v-if="state === 'ranked' && entry !== null" class="board-self__row">
      <span class="board-self__cell board-self__rank" data-testid="boards-self-rank">
        #{{ entry.rank }}
      </span>
      <span class="board-self__cell board-self__player">
        <span class="board-self__name">{{ entry.displayName }}</span>
        <span v-if="percent !== null" class="board-self__top" data-testid="boards-self-top">
          {{ t('boards.self.top', { percent }) }}
        </span>
        <BoardModChips :mods="entry.mods" />
      </span>
      <span class="board-self__cell board-self__metric">
        <span class="board-self__score" data-testid="boards-self-score">
          {{ formatScore(entry.score) }}
        </span>
        <span class="board-self__grade">{{ entry.grade }}</span>
      </span>
      <span class="board-self__cell board-self__num">{{ formatWpm(entry.wpm) }}</span>
      <span class="board-self__cell board-self__num">{{ formatWpm(entry.raw) }}</span>
      <span class="board-self__cell board-self__num">{{ formatAccuracy(entry.acc) }}</span>
      <span class="board-self__cell board-self__when">{{ whenLabel(entry) }}</span>
    </div>

    <!-- 204: identified, no slot here. An invitation, never an error. -->
    <RouterLink
      v-else-if="state === 'unranked'"
      class="board-self__hint"
      data-testid="boards-self-play"
      :to="routeLocation.home()"
    >
      {{ t('boards.self.play') }}
    </RouterLink>

    <!-- 401: a public page stays public; the strip only hints. -->
    <RouterLink
      v-else-if="state === 'guest'"
      class="board-self__hint"
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
  import { BoardModChips } from '../mod-chips'
  import { topPercent } from '../model/percentile'
  import { formatAccuracy, formatRelativeAchievedAt, formatScore, formatWpm } from '../model/format'
  import type { OwnRankState } from '../model/use-own-rank'

  /**
   * The pinned self row: your rank, writ large, your percentile, and then the
   * SAME columns the table renders — one shared grid definition
   * (`board-grid.scss`), so the numbers line up with the rows scrolling under
   * them. States mirror what `/me` can honestly answer (see `useOwnRank`).
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

<style lang="scss" scoped>
  @use '../board-grid' as grid;

  .board-self {
    position: sticky;
    top: 0;
    z-index: 1;
    background-color: var(--bg-color);

    &__row {
      @include grid.board-grid;

      padding: 0.5rem;
      font-size: 0.875rem;
      color: var(--main-color);
      background-color: var(--sub-alt-color);
      border-radius: var(--border-radius);
    }

    &__rank {
      font-size: 1.25rem;
      font-weight: 700;
      line-height: 1;
    }

    &__player {
      display: flex;
      gap: 0.5rem;
      align-items: baseline;
      min-width: 0;
    }

    &__name {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    &__top {
      flex-shrink: 0;
      padding: 0.1rem 0.5rem;
      font-size: 0.7rem;
      color: var(--bg-color);
      background-color: var(--main-color);
      border-radius: var(--border-radius);
    }

    &__metric {
      display: inline-flex;
      gap: 0.375rem;
      align-items: baseline;
    }

    &__score {
      font-weight: 700;
    }

    &__grade {
      padding: 0 0.3rem;
      font-size: 0.65rem;
      color: var(--bg-color);
      background-color: var(--main-color);
      border-radius: var(--border-radius);
    }

    &__num,
    &__when {
      text-align: end;
    }

    &__when {
      color: var(--sub-color);
    }

    &__hint {
      display: block;
      padding: 0.375rem 0.5rem;
      font-size: 0.8rem;
      color: var(--sub-color);
      text-decoration: none;
      transition: color var(--transition-duration) ease;

      &:hover,
      &:focus-visible {
        color: var(--main-color);
      }
    }
  }
</style>
