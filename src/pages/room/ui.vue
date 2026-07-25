<template>
  <div class="room-page">
    <Typography
      v-if="session.connection === 'reconnecting'"
      class="room-page__banner"
      size="s"
      color="error"
    >
      {{ t('servers.status.reconnecting') }}
    </Typography>

    <!-- Blocking match error (e.g. dict-hash-mismatch): never a silent fallback. -->
    <div v-if="session.phase === 'error'" class="room-page__error error-panel">
      <Typography size="l" tag-name="h2" color="error">{{ t('room.error.title') }}</Typography>
      <Typography color="sub">{{ session.matchError?.message }}</Typography>
      <Button color="gray" @click="session.leaveRoom()">{{ t('room.error.leave') }}</Button>
    </div>

    <!-- `eliminated` still renders the match surface: being out is spectating, not a dead screen. -->
    <RoomMatch
      v-else-if="
        session.phase === 'countdown' ||
        session.phase === 'running' ||
        session.phase === 'waiting' ||
        session.phase === 'eliminated'
      "
    />

    <RoomResults
      v-else-if="session.phase === 'results'"
      :standings="session.standings ?? []"
      :mode="session.room?.settings.mode ?? 'time'"
      :connection-lost="session.connection === 'reconnecting'"
      :reason="session.matchEndReason"
      @re-ready="session.reReady()"
      @leave="session.leaveRoom()"
    />

    <div v-else class="room-page__lobby lobby">
      <RoomConfig class="lobby__config" />
      <RoomPlayers class="lobby__players" />
      <RoomControls class="lobby__controls" />
      <RoomChat class="lobby__chat" />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { watch } from 'vue'
  import { useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { routeLocation } from '@/app/router/route-locations'
  import { useMatchSessionStore } from '@/entities/match'
  import { RoomChat } from '@/features/room/chat'
  import { RoomConfig } from '@/features/room/config'
  import { RoomControls } from '@/features/room/controls'
  import { RoomMatch } from '@/features/room/match'
  import { RoomPlayers } from '@/features/room/players'
  import { RoomResults } from '@/features/room/results'
  import { Button } from '@/shared/ui/button'
  import { Typography } from '@/shared/ui/typography'

  /**
   * The room, phase-routed off the session store: lobby grid → countdown /
   * running match surface → results standings → blocking error panel. Losing
   * the seat (leave or kick) drops back to /servers; the middleware guards
   * direct entry without a room.
   */
  const { t } = useI18n()
  const router = useRouter()
  const session = useMatchSessionStore()

  watch(
    () => session.room,
    (room) => {
      if (!room) void router.replace(routeLocation.servers())
    }
  )
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

  .error-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 3rem 1rem;
    text-align: center;
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

    &__config {
      grid-area: config;
    }

    &__chat {
      grid-area: chat;
    }

    &__players {
      grid-area: player;
    }

    &__controls {
      grid-area: controls;
    }
  }

  @media (width <=768px) {
    .lobby {
      grid-template:
        'config' auto
        'controls' auto
        'player' 1fr
        'chat' 1fr / 1fr;
    }
  }
</style>
