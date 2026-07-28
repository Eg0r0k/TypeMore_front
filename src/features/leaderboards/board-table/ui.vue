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

      <ul v-if="entries.length > 0" ref="rows" class="board__rows">
        <template v-for="segment in segments" :key="segment.id">
          <!--
            A segment that does not start at rank 1 sits under a gap; this is
            the upward continuation of the keyset walk (?before=), the mirror
            of the "load more" at the bottom.
          -->
          <li v-if="segment.prevCursor !== undefined" class="board__gap">
            <Button
              data-testid="boards-more-above"
              color="gray"
              size="s"
              :disabled="isLoadingMore"
              @click="loadBefore(segment.id)"
            >
              {{ isLoadingMore ? t('boards.loading') : t('boards.moreAbove') }}
            </Button>
          </li>
          <li
            v-for="entry in segment.entries"
            :key="entry.runId"
            class="board__row"
            :class="{
              'board__row--self': entry.userId === selfUserId,
              'board__row--flash': entry.userId === flashUserId
            }"
            :data-user-id="entry.userId"
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
        </template>
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
  import { nextTick, onUnmounted, ref, toRef, useTemplateRef } from 'vue'
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

  const {
    segments,
    entries,
    isLoading,
    isLoadingMore,
    isError,
    hasMore,
    loadMore,
    loadBefore,
    ensureSelf,
    retry
  } = useBoardFeed(toRef(props, 'bucket'))

  const whenLabel = (entry: BoardEntry): string => formatAchievedAt(entry.achievedAt, locale.value)

  // ── Scroll targets for the controls strip ──────────────────────────────────

  const rows = useTemplateRef('rows')
  const flashUserId = ref<string | undefined>()
  let flashTimer: ReturnType<typeof setTimeout> | undefined

  const scrollToTop = (): void => {
    rows.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  /**
   * Scroll to a player's LOADED row and flash it so the eye lands somewhere.
   * Answers whether the row was there — the caller owns what to do when it
   * was not (today: nothing; the around=me window is the missing half).
   */
  const scrollToUser = (userId: string): boolean => {
    // Attribute compare rather than a selector: a user id needs no escaping
    // rules this way, and happy-dom needs no CSS.escape.
    const row = Array.from(rows.value?.querySelectorAll('[data-user-id]') ?? []).find(
      (el) => el.getAttribute('data-user-id') === userId
    )
    if (!(row instanceof HTMLElement)) return false
    row.scrollIntoView({ behavior: 'smooth', block: 'center' })
    flashUserId.value = userId
    clearTimeout(flashTimer)
    flashTimer = setTimeout(() => {
      flashUserId.value = undefined
    }, FLASH_MS)
    return true
  }

  const FLASH_MS = 1600

  /**
   * Jump to a player's row, fetching the around=me window first when the row
   * is not loaded. Resolves to whether the jump landed.
   */
  const jumpToUser = async (userId: string): Promise<boolean> => {
    if (scrollToUser(userId)) return true
    if (!(await ensureSelf(userId))) return false
    await nextTick()
    return scrollToUser(userId)
  }

  onUnmounted(() => clearTimeout(flashTimer))

  defineExpose({ scrollToTop, scrollToUser, jumpToUser })

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
  @use '../board-grid' as grid;

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
      @include grid.board-grid;
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

    &__gap {
      display: flex;
      justify-content: center;
      padding: 0.25rem 0;
      border-top: 1px dashed var(--sub-alt-color);
    }

    &__row--self .board__watch {
      color: var(--main-color);
    }

    /* The jump-to-me landing flash: long enough to catch, gone before it nags. */
    &__row--flash .board__watch {
      animation: board-flash 1.6s ease-out;
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

  @keyframes board-flash {
    0%,
    40% {
      background-color: var(--sub-alt-color);
    }

    100% {
      background-color: transparent;
    }
  }
</style>
