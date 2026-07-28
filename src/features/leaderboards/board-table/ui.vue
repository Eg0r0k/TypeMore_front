<template>
  <div class="board">
    <Typography v-if="isLoading" class="board__state" size="s" color="sub">
      {{ t('boards.loading') }}
    </Typography>

    <TooltipProvider v-else :delay-duration="80">
      <div v-if="entries.length > 0" class="board__head" aria-hidden="true">
        <span class="board__cell board__cell--rank">{{ t('boards.column.rank') }}</span>
        <span class="board__cell board__cell--player">{{ t('boards.column.player') }}</span>
        <span class="board__cell board__cell--score">{{ t('boards.column.score') }}</span>
        <span class="board__cell board__cell--num">{{ t('boards.column.wpm') }}</span>
        <span class="board__cell board__cell--num">{{ t('boards.column.raw') }}</span>
        <span class="board__cell board__cell--num">{{ t('boards.column.acc') }}</span>
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
            The whole row is still one real button — keyboard reachable, named
            after whose run it plays back — and the explicit actions float over
            the date cell on hover/focus.
          -->
            <button
              type="button"
              class="board__watch"
              data-testid="boards-watch"
              :aria-label="t('boards.watch', { player: entry.displayName })"
              @click="watchRun(entry)"
            >
              <span class="board__cell board__cell--rank" data-testid="boards-rank">
                <!-- Crown for the throne, muted medals for the podium. -->
                <IconCrown v-if="entry.rank === 1" class="board__crown" aria-hidden="true" />
                <IconMedal
                  v-else-if="entry.rank === 2 || entry.rank === 3"
                  class="board__medal"
                  aria-hidden="true"
                />
                <span :class="{ 'sr-only': entry.rank === 1 }">{{ entry.rank }}</span>
              </span>
              <span class="board__cell board__cell--player" data-testid="boards-player">
                <span class="board__name">{{ entry.displayName }}</span>
                <span v-if="entry.userId === selfUserId" class="board__you">
                  {{ t('boards.you') }}
                </span>
                <BoardModChips :mods="entry.mods" />
              </span>
              <span class="board__cell board__cell--score" data-testid="boards-score">
                <span class="board__score">{{ formatScore(entry.score) }}</span>
                <span
                  class="board__grade"
                  :class="{ 'board__grade--top': entry.grade === 'SS' || entry.grade === 'S' }"
                  data-testid="boards-grade"
                >
                  {{ entry.grade }}
                </span>
              </span>
              <span class="board__cell board__cell--num">{{ formatWpm(entry.wpm) }}</span>
              <span class="board__cell board__cell--num">{{ formatWpm(entry.raw) }}</span>
              <span class="board__cell board__cell--num">{{ formatAccuracy(entry.acc) }}</span>
              <span class="board__cell board__cell--when">
                <Tooltip>
                  <TooltipTrigger as-child>
                    <span data-testid="boards-when" tabindex="-1">{{ whenLabel(entry) }}</span>
                  </TooltipTrigger>
                  <TooltipContent>{{ exactLabel(entry) }}</TooltipContent>
                </Tooltip>
              </span>
            </button>

            <!-- Hover actions: watch is the row's own click, race seats you
                 against this run's ghost. Focusable, so the keyboard reaches
                 them without the hover. -->
            <span class="board__actions">
              <button
                type="button"
                class="board__action"
                data-testid="boards-action-watch"
                :aria-label="t('boards.watch', { player: entry.displayName })"
                :title="t('boards.actions.watch')"
                @click.stop="watchRun(entry)"
              >
                <IconPlayerPlay />
              </button>
              <button
                type="button"
                class="board__action"
                data-testid="boards-action-race"
                :aria-label="t('boards.race', { player: entry.displayName })"
                :title="t('boards.actions.race')"
                @click.stop="raceRun(entry)"
              >
                <IconSwords />
              </button>
            </span>
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
    </TooltipProvider>
  </div>
</template>

<script setup lang="ts">
  import { nextTick, onUnmounted, ref, toRef, useTemplateRef } from 'vue'
  import { useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import type { BoardEntry } from '@shared/api'
  import { ROUTE_NAMES } from '@/app/router/route-names'
  import IconCrown from '~icons/tabler/crown'
  import IconMedal from '~icons/tabler/medal'
  import IconPlayerPlay from '~icons/tabler/player-play-filled'
  import IconSwords from '~icons/tabler/swords'
  import { Button } from '@/shared/ui/button'
  import { Typography } from '@/shared/ui/typography'
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
  import { BoardModChips } from '../mod-chips'
  import { useBoardFeed } from '../model/use-board-feed'
  import {
    formatAccuracy,
    formatExactAchievedAt,
    formatRelativeAchievedAt,
    formatScore,
    formatWpm
  } from '../model/format'

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

  const whenLabel = (entry: BoardEntry): string =>
    formatRelativeAchievedAt(entry.achievedAt, locale.value)
  const exactLabel = (entry: BoardEntry): string =>
    formatExactAchievedAt(entry.achievedAt, locale.value)

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

  /** Race this run's ghost — the same public replay data, typed against live. */
  const raceRun = (entry: BoardEntry): void => {
    void router.push({
      name: ROUTE_NAMES.RACE,
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
      position: relative;
      border-top: 1px solid var(--sub-alt-color);

      &:hover .board__actions,
      &:focus-within .board__actions {
        opacity: 1;
        pointer-events: auto;
      }

      &:hover .board__cell--when,
      &:focus-within .board__cell--when {
        opacity: 0;
      }
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
      transition: opacity var(--transition-duration) ease;
    }

    &__cell--rank {
      display: inline-flex;
      gap: 0.25rem;
      align-items: center;
    }

    &__crown {
      font-size: 1rem;
      color: var(--main-color);
    }

    &__medal {
      font-size: 0.9rem;
      color: var(--sub-color);
    }

    &__cell--player {
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

    /* The ranking metric: what the column order says with weight. */
    &__cell--score {
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
      color: var(--sub-color);
      background-color: var(--sub-alt-color);
      border-radius: var(--border-radius);
    }

    &__grade--top {
      color: var(--bg-color);
      background-color: var(--main-color);
    }

    /* Hover actions float over the date cell; keyboard focus reveals them too. */
    &__actions {
      position: absolute;
      top: 50%;
      right: 0.5rem;
      display: inline-flex;
      gap: 0.25rem;
      opacity: 0;
      transform: translateY(-50%);
      transition: opacity var(--transition-duration) ease;
      pointer-events: none;
    }

    &__action {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.6rem;
      height: 1.6rem;
      padding: 0;
      font-size: 0.9rem;
      color: var(--sub-color);
      background-color: var(--sub-alt-color);
      border: none;
      border-radius: var(--border-radius);
      cursor: pointer;
      transition: color var(--transition-duration) ease;

      &:hover,
      &:focus-visible {
        color: var(--main-color);
      }
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
