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
        @click="session.createRoom()"
      >
        {{ t('servers.create') }}
      </Button>
    </div>

    <ul v-else class="lobby__rows">
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
          <span class="lobby__cell lobby__cell--name" data-testid="lobby-name">
            {{ room.name }}
          </span>
          <span class="lobby__cell lobby__cell--players" data-testid="lobby-players">
            {{ t('servers.lobby.players', { count: room.playerCount, max: room.maxPlayers }) }}
          </span>
          <span class="lobby__cell">
            <span class="lobby__chip" data-testid="lobby-mode">{{ dimensionLabel(room) }}</span>
          </span>
          <span class="lobby__cell lobby__cell--lang" data-testid="lobby-lang">
            {{ languageName(room.settings.lang) }}
          </span>
          <span class="lobby__cell lobby__cell--state">
            <span v-if="room.inMatch" class="lobby__badge" data-testid="lobby-in-match">
              {{ t('servers.lobby.inMatch') }}
            </span>
            <!--
              A disabled row must SAY why. An unexplained dead row reads as a
              broken list, and the reader has no way to tell the two apart.
            -->
            <span v-if="reasonFor(room) !== null" class="lobby__reason" data-testid="lobby-reason">
              {{ reasonFor(room) }}
            </span>
          </span>
        </button>
      </li>
    </ul>
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
  const openRooms = computed<readonly RoomListEntry[]>(() => rooms.data.value ?? [])

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
      gap: 0.75rem;
      grid-template-columns: minmax(6rem, 1fr) 7rem auto minmax(4rem, auto) minmax(0, 1fr);
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
    }

    &__cell--players,
    &__cell--lang {
      color: var(--sub-color);
    }

    &__cell--state {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.375rem;
      text-align: end;
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

  @media screen and (width <= 640px) {
    .lobby__join {
      gap: 0.25rem 0.5rem;
      grid-template-columns: minmax(0, 1fr) auto;
    }
  }
</style>
