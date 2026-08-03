<template>
  <div class="flex w-full flex-col gap-2">
    <Typography v-if="isLoading" class="board__state block px-2 py-6" size="s" color="sub">
      {{ t('boards.loading') }}
    </Typography>

    <TooltipProvider v-else :delay-duration="80">
      <div v-if="entries.length > 0" :class="[BOARD_GRID, TABLE_GRID_HEAD]" aria-hidden="true">
        <span class="inline-flex items-center gap-1">{{ t('boards.column.rank') }}</span>
        <span>{{ t('boards.column.player') }}</span>
        <span>{{ t('boards.column.score') }}</span>
        <span class="text-end">{{ t('boards.column.wpm') }}</span>
        <span class="text-end">{{ t('boards.column.raw') }}</span>
        <span class="text-end">{{ t('boards.column.acc') }}</span>
        <span class="text-end">{{ t('boards.column.when') }}</span>
      </div>

      <ul v-if="entries.length > 0" ref="rows" class="m-0 list-none p-0">
        <template v-for="segment in segments" :key="segment.id">
          <!--
            A segment that does not start at rank 1 sits under a gap; this is
            the upward continuation of the keyset walk (?before=), the mirror
            of the "load more" at the bottom.
          -->
          <li
            v-if="segment.prevCursor !== undefined"
            class="flex justify-center border-t border-dashed border-sub-alt py-1"
          >
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
            class="board__row group relative"
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
              class="board__watch cursor-pointer border-none bg-transparent font-sans text-text transition-tm group-odd:bg-sub-alt hover:text-main focus-visible:bg-sub-alt"
              :class="[
                BOARD_GRID,
                TABLE_GRID_ROW,
                { 'text-main': entry.userId === selfUserId },
                { 'animate-row-flash': entry.userId === flashUserId }
              ]"
              data-testid="boards-watch"
              :aria-label="t('boards.watch', { player: entry.displayName })"
              @click="watchRun(entry)"
            >
              <span class="inline-flex items-center gap-1" data-testid="boards-rank">
                <!-- Crown for the throne, muted medals for the podium. -->
                <IconCrown
                  v-if="entry.rank === 1"
                  class="board__crown text-main"
                  aria-hidden="true"
                />
                <IconMedal
                  v-else-if="entry.rank === 2 || entry.rank === 3"
                  class="board__medal text-sub"
                  aria-hidden="true"
                />
                <span :class="{ 'sr-only': entry.rank === 1 }">{{ entry.rank }}</span>
              </span>
              <span class="flex min-w-0 items-baseline gap-2" data-testid="boards-player">
                <!-- The nick is a real link to the player's profile page —
                     new-tab and middle-click behave like any link — while the
                     row's own click stays "watch this run". stop: the link
                     must not also fire the row. A closed profile still has
                     this page; it renders its closed state there. One's OWN
                     nick opens /profile — the full page, not the preview. -->
                <RouterLink
                  :to="
                    entry.userId === selfUserId
                      ? routeLocation.profile()
                      : routeLocation.user(entry.displayName)
                  "
                  class="truncate underline-offset-2 hover:underline focus-visible:underline"
                  data-testid="boards-profile-link"
                  :aria-label="t('boards.profileOf', { player: entry.displayName })"
                  @click.stop
                >
                  {{ entry.displayName }}
                </RouterLink>
                <span v-if="entry.userId === selfUserId" class="ml-1.5 text-[0.7rem] text-main">
                  {{ t('boards.you') }}
                </span>
                <BoardModChips :mods="entry.mods" />
              </span>
              <span class="flex items-baseline gap-1.5" data-testid="boards-score">
                <span
                  class="board__grade font-bold rounded px-1 text-lg"
                  :class="
                    entry.grade === 'SS' || entry.grade === 'S' ? 'bg-main text-bg' : 'bg-sub-alt '
                  "
                  data-testid="boards-grade"
                >
                  {{ entry.grade }}
                </span>
                <span class="font-bold text-sm text-sub tabular-nums">
                  {{ formatScore(entry.score) }}
                </span>
              </span>
              <span class="text-end tabular-nums">{{ formatWpm(entry.wpm) }}</span>
              <span class="text-end tabular-nums">{{ formatWpm(entry.raw) }}</span>
              <span class="text-end tabular-nums">{{ percent(entry.acc) }}</span>
              <!-- The date makes way for the actions on hover/focus. -->
              <span
                class="text-end text-sub transition-tm group-hover:opacity-0 group-focus-within:opacity-0"
              >
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
                 them without the hover. Same icon pair as every other table. -->
            <span
              class="pointer-events-none absolute right-2 top-1/2 inline-flex -translate-y-1/2 gap-1 opacity-0 transition-tm group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
            >
              <Button
                color="shadow"
                size="icon-sm"
                data-testid="boards-action-watch"
                :aria-label="t('boards.watch', { player: entry.displayName })"
                :title="t('boards.actions.watch')"
                @click.stop="watchRun(entry)"
              >
                <IconEye />
              </Button>
              <Button
                color="shadow"
                size="icon-sm"
                data-testid="boards-action-race"
                :aria-label="t('boards.race', { player: entry.displayName })"
                :title="t('boards.actions.race')"
                @click.stop="raceRun(entry)"
              >
                <IconSwords />
              </Button>
            </span>
          </li>
        </template>
      </ul>

      <Typography
        v-else-if="!isError"
        class="board__state block px-2 py-6"
        data-testid="boards-empty"
        size="s"
        color="sub"
      >
        {{ t('boards.empty') }}
      </Typography>

      <div v-if="isError" class="flex items-center gap-3 p-2">
        <Typography data-testid="boards-error" size="s" color="error">
          {{ t('boards.pageError') }}
        </Typography>
        <Button data-testid="boards-retry" color="gray" size="s" @click="retry">
          {{ t('boards.retry') }}
        </Button>
      </div>

      <Button
        v-else-if="hasMore"
        class="self-center"
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
  import { RouterLink, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import type { BoardEntry } from '@shared/api'
  import { ROUTE_NAMES } from '@/app/router/route-names'
  import { routeLocation } from '@/shared/router'
  import IconCrown from '~icons/tabler/crown'
  import IconMedal from '~icons/tabler/medal'
  import IconEye from '~icons/tabler/eye'
  import IconSwords from '~icons/tabler/swords'
  import { Button } from '@/shared/ui/button'
  import { TABLE_GRID_HEAD, TABLE_GRID_ROW } from '@/shared/ui/table'
  import { Typography } from '@/shared/ui/typography'
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
  import { BOARD_GRID } from '../board-grid'
  import { BoardModChips } from '../mod-chips'
  import { useBoardFeed } from '../model/use-board-feed'
  import { percent } from '@/shared/lib/helpers/numbers'
  import {
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
