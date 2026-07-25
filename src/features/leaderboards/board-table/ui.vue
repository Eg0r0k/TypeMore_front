<template>
  <div class="board">
    <Typography v-if="isLoading" class="board__state" size="s" color="sub">
      {{ t('boards.loading') }}
    </Typography>

    <template v-else>
      <div v-if="entries.length > 0" class="board__head" aria-hidden="true">
        <span class="board__cell board__cell--rank">{{ t('boards.column.rank') }}</span>
        <span class="board__cell board__cell--player">{{ t('boards.column.player') }}</span>
        <span class="board__cell board__cell--mods"></span>
        <span class="board__cell board__cell--num">{{ t('boards.column.wpm') }}</span>
        <span class="board__cell board__cell--num">{{ t('boards.column.acc') }}</span>
        <span class="board__cell board__cell--num">{{ t('boards.column.score') }}</span>
        <span class="board__cell board__cell--when">{{ t('boards.column.when') }}</span>
      </div>

      <ul v-if="entries.length > 0" class="board__rows">
        <li
          v-for="entry in entries"
          :key="entry.runId"
          class="board__row"
          :class="{ 'board__row--self': entry.userId === selfUserId }"
          data-testid="boards-row"
        >
          <!--
            The whole row is the affordance, so the whole row is one real
            button: keyboard reachable, named after whose run it plays back.
          -->
          <button
            type="button"
            class="board__watch"
            data-testid="boards-watch"
            :aria-label="t('boards.watch', { player: entry.displayName })"
            @click="watchRun(entry)"
          >
            <span class="board__cell board__cell--rank" data-testid="boards-rank">
              {{ entry.rank }}
            </span>
            <span class="board__cell board__cell--player" data-testid="boards-player">
              {{ entry.displayName }}
              <span v-if="entry.userId === selfUserId" class="board__you">
                {{ t('boards.you') }}
              </span>
            </span>
            <span class="board__cell board__cell--mods">
              <BoardModChips :mods="entry.mods" />
            </span>
            <span class="board__cell board__cell--num">{{ formatWpm(entry.wpm) }}</span>
            <span class="board__cell board__cell--num">{{ formatAccuracy(entry.acc) }}</span>
            <span class="board__cell board__cell--num" data-testid="boards-score">
              {{ formatScore(entry.score) }}
            </span>
            <span class="board__cell board__cell--when">{{ whenLabel(entry) }}</span>
          </button>
        </li>
      </ul>

      <Typography
        v-else-if="!isError"
        class="board__state"
        data-testid="boards-empty"
        size="s"
        color="sub"
      >
        {{ t('boards.empty') }}
      </Typography>

      <div v-if="isError" class="board__error">
        <Typography data-testid="boards-error" size="s" color="error">
          {{ t('boards.pageError') }}
        </Typography>
        <Button data-testid="boards-retry" color="gray" size="s" @click="retry">
          {{ t('boards.retry') }}
        </Button>
      </div>

      <Button
        v-else-if="hasMore"
        class="board__more"
        data-testid="boards-more"
        color="gray"
        size="s"
        :disabled="isLoadingMore"
        @click="loadMore"
      >
        {{ isLoadingMore ? t('boards.loading') : t('boards.more') }}
      </Button>
    </template>
  </div>
</template>

<script setup lang="ts">
  import { toRef } from 'vue'
  import { useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import type { BoardEntry } from '@shared/api'
  import { ROUTE_NAMES } from '@/app/router/route-names'
  import { Button } from '@/shared/ui/button'
  import { Typography } from '@/shared/ui/typography'
  import { BoardModChips } from '../mod-chips'
  import { useBoardFeed } from '../model/use-board-feed'
  import { formatAccuracy, formatAchievedAt, formatScore, formatWpm } from '../model/format'

  /**
   * One ranking. Owns its own paging (keyset, forward-only, accumulated) so a
   * bucket switch or a failed page never reaches back into the picker above it.
   */
  const props = defineProps<{
    bucket: string
    /** Marks the caller's own row when they hold a slot on this board. */
    selfUserId?: string
  }>()

  const { t, locale } = useI18n()
  const router = useRouter()

  const { entries, isLoading, isLoadingMore, isError, hasMore, loadMore, retry } = useBoardFeed(
    toRef(props, 'bucket')
  )

  const whenLabel = (entry: BoardEntry): string => formatAchievedAt(entry.achievedAt, locale.value)

  /** The bucket rides along so the replay page can offer a link back to it. */
  const watchRun = (entry: BoardEntry): void => {
    void router.push({
      name: ROUTE_NAMES.REPLAY,
      params: { runId: entry.runId },
      query: { bucket: props.bucket }
    })
  }
</script>

<style lang="scss" scoped>
  .board {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;

    &__state {
      display: block;
      padding: 1.5rem 0.5rem;
    }

    &__head,
    &__watch {
      display: grid;
      align-items: center;
      width: 100%;
      gap: 0.75rem;
      grid-template-columns: 2.5rem minmax(6rem, 1fr) minmax(0, 1.5fr) 4rem 4rem 5rem 5rem;
      text-align: start;
    }

    &__head {
      padding: 0 0.5rem;
      font-size: 0.75rem;
      color: var(--sub-color);
      text-transform: uppercase;
    }

    &__rows {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    &__row {
      border-top: 1px solid var(--sub-alt-color);
    }

    &__row--self .board__watch {
      color: var(--main-color);
    }

    &__watch {
      padding: 0.5rem;
      font-family: inherit;
      font-size: 0.875rem;
      color: var(--text-color);
      background: none;
      border: none;
      cursor: pointer;

      &:hover,
      &:focus-visible {
        background-color: var(--sub-alt-color);
      }
    }

    &__cell--num,
    &__cell--when {
      text-align: end;
    }

    &__cell--when {
      color: var(--sub-color);
    }

    &__you {
      margin-left: 0.375rem;
      font-size: 0.7rem;
      color: var(--main-color);
    }

    &__error {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem;
    }

    &__more {
      align-self: center;
    }
  }
</style>
