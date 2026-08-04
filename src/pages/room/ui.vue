<template>
  <div class="room-page flex-1!">
    <Typography
      v-if="session.connection === 'reconnecting'"
      class="room-page__banner"
      size="s"
      color="error"
    >
      {{ t('servers.status.reconnecting') }}
    </Typography>

    <div
      v-if="session.phase === 'error'"
      class="flex h-full items-center flex-col w-full justify-center"
    >
      <Typography size="l" tag-name="h2" color="error" class="capitalize flex items-center gap-2">
        {{ t('room.error.title') }}
        <IconError class="size-10" />
      </Typography>

      <Typography color="sub">{{ session.matchError?.message }}</Typography>
      <Button color="gray" @click="session.leaveRoom()">{{ t('room.error.leave') }}</Button>
    </div>

    <RoomMatch
      v-else-if="
        session.phase === 'countdown' || session.phase === 'running' || session.phase === 'waiting'
      "
    />

    <!--
      Being eliminated shows the RESULTS, not a consolation panel: the player's
      own run is finished and worth reading, and the table below it keeps
      updating while everyone else races.
    -->
    <RoomResults
      v-else-if="showing"
      :standings="rows"
      :mode="mode"
      :self="selfRun"
      :live="live"
      :racing-count="racingCount"
      :outcome-reason="outcomeReason"
      :connection-lost="session.connection === 'reconnecting'"
      :reason="session.matchEndReason"
      @re-ready="session.reReady()"
      @lobby="session.backToLobby()"
      @leave="session.leaveRoom()"
    />

    <!--
      The left column is the ROOM: what it is called, who may walk in, the code
      that lets them, and who is already here — in that order, because that is
      the order someone reads them in when they are about to invite a friend.
      The run configuration is a different question and lives on the right.
    -->
    <div v-else class="room-page__lobby lobby">
      <div class="lobby__room">
        <RoomIdentity />
        <RoomPlayers class="lobby__players" />
      </div>
      <RoomConfig class="lobby__config" />
      <RoomControls class="lobby__controls" />
      <RoomChat class="lobby__chat" />
    </div>

  </div>
</template>

<script setup lang="ts">
  import { onUnmounted, provide, watch, watchEffect } from 'vue'
  import { onBeforeRouteLeave, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { LEAVE_SHAKE_KEY } from '@/shared/constants/inject-keys'
  import { useShake } from '@/shared/lib/hooks/useShake'
  import { toast } from '@/shared/ui/sonner'
  import { routeLocation } from '@/app/router/route-locations'
  import { useMatchSessionStore } from '@/entities/match'
  import { useScreenStore } from '@/entities/screen'
  import { RoomChat } from '@/features/room/chat'
  import { RoomConfig, RoomIdentity } from '@/features/room/config'
  import { RoomControls } from '@/features/room/controls'
  import { RoomMatch } from '@/features/room/match'
  import { RoomPlayers } from '@/features/room/players'
  import { RoomResults, useMatchResults } from '@/features/room/results'
  import { Button } from '@/shared/ui/button'
  import { Typography } from '@/shared/ui/typography'
  import IconError from '~icons/tabler/alert-circle'
  /**
   * The room, phase-routed off the session store: lobby grid → countdown /
   * running match surface → results → blocking error panel. Losing the seat
   * (leave or kick) drops back to /servers; the middleware guards direct entry
   * without a room.
   *
   * `eliminated` routes to the results too, not to the match surface: this seat's
   * run is over and the results screen is where a finished run belongs — it just
   * shows a live table instead of a final one until `match_end` lands.
   */
  const { t } = useI18n()
  const router = useRouter()
  const session = useMatchSessionStore()
  const { showing, live, mode, rows, selfRun, racingCount, outcomeReason } = useMatchResults()

  watch(
    () => session.room,
    (room) => {
      if (!room) void router.replace(routeLocation.servers())
    }
  )

  /**
   * The seat is a SERVER fact: walking away from this route without the leave
   * button would leave a seat behind, holding a slot in a five-seat room and a
   * countdown other people are waiting on. So the route change is refused while
   * the seat is still held, and the refusal points at the control that does it
   * properly — the leave button shakes, and the toast says the same thing in
   * words for anyone who cannot see motion.
   *
   * Only while a seat is HELD: once the room is gone the redirect above is the
   * one navigating, and it must not be blocked by its own guard.
   */
  const { shaking, shake } = useShake()
  provide(LEAVE_SHAKE_KEY, shaking)

  onBeforeRouteLeave(() => {
    if (session.room === null) return true
    shake()
    toast.warning(t('room.leaveHint'))
    return false
  })

  /**
   * The same signal the solo screen raises, and the reason it lives in a store
   * rather than on the page: a match IS a run, so the shell's chrome fades and
   * the pointer goes, and neither the header nor the footer can see a session
   * store from outside the router view.
   *
   * `running` only. The lobby before it and the results after it are both
   * screens you navigate FROM — taking the header away there would take away
   * the way out.
   */
  const screen = useScreenStore()
  watchEffect(() => screen.setTyping(session.phase === 'running'))
  onUnmounted(() => screen.setTyping(false))
</script>

<style lang="scss" scoped>
  .room-page {
    width: 100%;
    height: 100%;

    &__banner {
      display: block;
      margin-bottom: 1rem;
      text-align: center;
    }
  }

  .lobby {
    display: grid;
    width: 100%;
    height: 100%;
    gap: 2rem;
    grid-template:
      'player config' auto
      'player chat' 1fr
      'controls chat' auto / 1fr 3fr;

    /*
     * Every area carries `min-width: 0`. A grid item defaults to
     * `min-width: auto` — it may not shrink below its own min-content — so one
     * long chat message or one long room name would widen its whole column and
     * squeeze the other one, instead of wrapping inside the box it was given.
     */
    &__room {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      grid-area: player;
      min-width: 0;
      min-height: 0;
    }

    &__config {
      grid-area: config;
      min-width: 0;
    }

    &__chat {
      grid-area: chat;
      min-width: 0;
    }

    &__players {
      min-height: 0;
    }

    &__controls {
      grid-area: controls;
    }
  }

  @media (width <=768px) {
    .lobby {
      grid-template:
        'player' auto
        'config' auto
        'controls' auto
        'chat' 1fr / 1fr;
    }
  }
</style>
