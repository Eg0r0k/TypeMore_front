<template>
  <section class="lobby" data-testid="lobby">
    <Typography class="lobby__title" tag-name="h2" size="m" color="primary">
      {{ t('servers.lobby.title') }}
    </Typography>

    <Typography
      v-if="rooms.isPending.value"
      class="lobby__state"
      data-testid="lobby-loading"
      size="s"
      color="sub"
    >
      {{ t('servers.lobby.loading') }}
    </Typography>

    <div v-else-if="rooms.isError.value" class="lobby__error">
      <Typography data-testid="lobby-error" size="s" color="error">
        {{ t('servers.lobby.error') }}
      </Typography>
      <Button data-testid="lobby-retry" color="gray" size="s" @click="retry">
        {{ t('servers.lobby.retry') }}
      </Button>
    </div>

    <!--
      An empty list is a real 200: nobody has an open room right now. The only
      useful thing to offer is the one action that changes that.
    -->
    <div v-else-if="openRooms.length === 0" class="lobby__empty">
      <Typography data-testid="lobby-empty" size="s" color="sub">
        {{ t('servers.lobby.empty') }}
      </Typography>
      <Button
        data-testid="lobby-create"
        color="gray"
        size="s"
        :disabled="!canAct"
        :title="canAct ? undefined : t('servers.lobby.reason.offline')"
        @click="session.createRoom()"
      >
        {{ t('servers.create') }}
      </Button>
    </div>

    <!-- The poll adds and removes rooms under the reader; a soft fade (the
         popup's own durations) keeps the list from popping. First render is
         not animated — TransitionGroup has no appear here on purpose. -->
    <TransitionGroup v-else tag="ul" name="lobby-rows" class="lobby__rows">
      <li v-for="room in openRooms" :key="room.code" class="lobby__row" data-testid="lobby-row">
        <!--
          The whole row is the affordance, so the whole row is one real button:
          keyboard reachable, and named after the room it walks into.
        -->
        <button
          type="button"
          class="lobby__join"
          data-testid="lobby-join"
          :disabled="reasonFor(room) !== null"
          :aria-label="t('servers.lobby.joinRoom', { name: room.name })"
          @click="join(room)"
        >
          <span
            class="lobby__cell lobby__cell--name"
            data-testid="lobby-name"
            :title="room.name"
          >
            {{ room.name }}
          </span>
          <!-- The scan line: seats, dimension, language — one tight group next
               to the name instead of columns strewn across the page width. -->
          <span class="lobby__meta">
            <span class="lobby__cell lobby__cell--players" data-testid="lobby-players">
              {{ t('servers.lobby.players', { count: room.playerCount, max: room.maxPlayers }) }}
            </span>
            <span class="lobby__chip" data-testid="lobby-mode">{{ dimensionLabel(room) }}</span>
            <span
              class="lobby__cell lobby__cell--lang"
              data-testid="lobby-lang"
              :title="languageName(room.settings.lang)"
            >
              {{ languageName(room.settings.lang) }}
            </span>
          </span>
          <span class="lobby__cell lobby__cell--state">
            <span v-if="room.inMatch" class="lobby__badge" data-testid="lobby-in-match">
              {{ t('servers.lobby.inMatch') }}
            </span>
            <!--
              A disabled row must SAY why. An unexplained dead row reads as a
              broken list, and the reader has no way to tell the two apart.
              A joinable row says what a press does instead — the row's one
              action, always visible, never only on hover.
            -->
            <span v-if="reasonFor(room) !== null" class="lobby__reason" data-testid="lobby-reason">
              {{ reasonFor(room) }}
            </span>
            <span v-else class="lobby__go" aria-hidden="true">
              {{ t('servers.join.submit') }}
            </span>
          </span>
        </button>
      </li>
    </TransitionGroup>
  </section>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useQuery } from '@tanstack/vue-query'
  import { useDocumentVisibility } from '@vueuse/core'
  import { useI18n } from 'vue-i18n'
  import {
    ROOM_LIST_POLL_MS,
    roomDimension,
    roomListQueryOptions,
    type RoomListEntry
  } from '@shared/api'
  import { useMatchSessionStore } from '@/entities/match'
  import { useLanguageNames } from '@/shared/lib/hooks/useLanguageNames'
  import { Button } from '@/shared/ui/button'
  import { Typography } from '@/shared/ui/typography'

  /**
   * The public room list — discovery, beside create and join-by-code rather
   * than instead of them. A room found here is entered through the SAME
   * `joinRoom(code)` the join-by-code modal uses; the code is simply already
   * known, so nothing about the join path is duplicated. Navigation to `/room`
   * stays where it already is: the page's watch on `session.room`.
   */
  const { t } = useI18n()
  const session = useMatchSessionStore()

  // A room carries the language KEY it will be played in; the dictionary
  // catalogue is the only thing that knows what that key is called.
  const { languageName } = useLanguageNames()

  /**
   * Polling, paused while nobody is looking.
   *
   * A lobby list is only worth re-reading while it is on screen: a hidden tab
   * that keeps asking every four seconds is a background heartbeat per open
   * tab, forever. `useDocumentVisibility` is the reactive read of that, and
   * dropping `refetchInterval` to `false` stops the timer outright rather than
   * letting it fire into a cache nobody reads. Becoming visible flips it back,
   * and TanStack's own focus refetch means the first frame after the tab
   * returns is already fresh rather than four seconds stale.
   */
  const visibility = useDocumentVisibility()
  const pollInterval = computed<number | false>(() =>
    visibility.value === 'visible' ? ROOM_LIST_POLL_MS : false
  )

  const rooms = useQuery({ ...roomListQueryOptions(), refetchInterval: pollInterval })

  /**
   * Joinable rooms first, then full, then in-match — the reader's question is
   * "where can I go", so the rooms that answer it lead. The sort key is the
   * room's PHASE only (never the live player count), and Array#sort is stable,
   * so within a group the server's order is preserved and a poll tick cannot
   * shuffle rows under the cursor unless a room actually changed phase.
   */
  const phaseRank = (room: RoomListEntry): number =>
    room.inMatch ? 2 : room.playerCount >= room.maxPlayers ? 1 : 0
  const openRooms = computed<readonly RoomListEntry[]>(() =>
    [...(rooms.data.value ?? [])].sort((a, b) => phaseRank(a) - phaseRank(b))
  )

  // Room commands are only sendable from a connected, not-yet-seated socket —
  // the same gate the create/join-by-code buttons use.
  const canAct = computed(() => session.connection === 'idle' && !session.room)

  /**
   * Why this row cannot be walked into, or `null` when it can. Ordered by what
   * the reader can do about it: a running match and a full room are facts about
   * the room, a dead socket is a fact about us.
   */
  const reasonFor = (room: RoomListEntry): string | null => {
    if (room.inMatch) return t('servers.lobby.reason.inMatch')
    if (room.playerCount >= room.maxPlayers) return t('servers.lobby.reason.full')
    if (!canAct.value) return t('servers.lobby.reason.offline')
    return null
  }

  const MS_PER_SECOND = 1000

  /**
   * The mode, rendered as the dimension it names — seconds for `time`, words
   * for `words` — so a reader never has to know that "the number" means
   * milliseconds here and words there. Same rule as the leaderboard buckets.
   * A quote room names itself: its length is the text's, not a target anyone
   * chose.
   */
  const dimensionLabel = (room: RoomListEntry): string => {
    const dimension = roomDimension(room.settings)
    if (dimension === null) return room.settings.mode
    if (dimension.kind === 'quote') return t('game.mode.quote')
    return dimension.kind === 'time'
      ? t('servers.lobby.time', { seconds: Math.round(dimension.durationMs / MS_PER_SECOND) })
      : t('servers.lobby.words', { count: dimension.wordCount })
  }

  const join = (room: RoomListEntry): void => {
    if (reasonFor(room) !== null) return
    session.joinRoom(room.code)
  }

  const retry = (): void => {
    void rooms.refetch()
  }
</script>

<style lang="scss" scoped>
  .lobby {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;

    &__title {
      margin-bottom: 0;
    }

    &__state {
      display: block;
      padding: 1.5rem 0.5rem;
    }

    &__error,
    &__empty {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem;
    }

    &__rows {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    &__row {
      border-top: 1px solid var(--sub-alt-color);
    }

    &__join {
      display: grid;
      align-items: center;
      width: 100%;
      gap: 0.25rem 1.5rem;
      grid-template-columns: minmax(0, 1fr) auto auto;
      padding: 0.5rem;
      font-family: inherit;
      font-size: 0.875rem;
      color: var(--text-color);
      text-align: start;
      background: none;
      border: none;
      cursor: pointer;

      &:disabled {
        color: var(--sub-color);
        cursor: not-allowed;
      }

      &:hover:not(:disabled),
      &:focus-visible:not(:disabled) {
        background-color: var(--sub-alt-color);
      }

      // The design system's focus-visible double ring (see `focus-ring` in
      // tailwind.css): a background-only focus cue disappears on a row whose
      // hover state is that same background.
      &:focus-visible {
        outline: none;
        box-shadow:
          0 0 0 1.5px var(--bg-color),
          0 0 0 3px var(--text-color);
      }
    }

    // Grid/flex items default to min-width auto; without this a long room name
    // or language name widens its column past the row instead of truncating.
    &__cell {
      min-width: 0;
    }

    &__cell--name,
    &__cell--lang {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__cell--players,
    &__cell--lang {
      color: var(--sub-color);
    }

    &__cell--players {
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    // Seats · dimension · language: one glance, one group.
    &__meta {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      min-width: 0;
    }

    &__cell--state {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.375rem;
      text-align: end;
      white-space: nowrap;
    }

    // The row's one action, spelled out for joinable rooms. Inherits the sub
    // colour swap on a disabled row, but a disabled row never renders it.
    &__go {
      font-size: 0.75rem;
      color: var(--main-color);
    }

    &__chip {
      display: inline-block;
      padding: 0.1rem 0.5rem;
      font-size: 0.7rem;
      color: var(--sub-color);
      background-color: var(--sub-alt-color);
      border-radius: var(--border-radius);
    }

    &__badge {
      padding: 0.1rem 0.5rem;
      font-size: 0.7rem;
      color: var(--bg-color);
      background-color: var(--main-color);
      border-radius: var(--border-radius);
    }

    &__reason {
      font-size: 0.7rem;
      color: var(--sub-color);
    }
  }

  // Poll churn: enters ride the popup entrance duration, exits go softer and
  // quicker (the popup exit), reorders slide on the shared easing token.
  .lobby-rows-enter-active {
    transition: opacity 0.16s var(--ease-standard);
  }

  .lobby-rows-leave-active {
    transition: opacity 0.12s var(--ease-out);
  }

  .lobby-rows-enter-from,
  .lobby-rows-leave-to {
    opacity: 0;
  }

  .lobby-rows-move {
    transition: transform 0.16s var(--ease-standard);
  }

  @media (prefers-reduced-motion: reduce) {
    .lobby-rows-enter-active,
    .lobby-rows-leave-active,
    .lobby-rows-move {
      transition: none;
    }
  }

  // Two-line card: name + action on the first line, the meta group on its
  // own full-width second line — nothing clips, nothing leaves the viewport.
  // Rows are pinned explicitly: auto-placement would push the action cell
  // onto a third line once the meta group claims the full second row.
  @media screen and (width <= 640px) {
    .lobby__join {
      gap: 0.25rem 0.75rem;
      grid-template-columns: minmax(0, 1fr) auto;
    }

    .lobby__cell--name {
      grid-row: 1;
      grid-column: 1;
    }

    .lobby__cell--state {
      grid-row: 1;
      grid-column: 2;
      white-space: normal;
    }

    .lobby__meta {
      grid-row: 2;
      grid-column: 1 / -1;
    }
  }
</style>
