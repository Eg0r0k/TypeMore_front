<template>
  <div class="server-page">
    <div class="server-page__head head">
      <Typography class="server-page__title" color="primary" size="xxl" tag-name="h1">
        {{ t('servers.title.lead') }}
        <Typography tag-name="span" size="xxl" color="main">
          {{ t('servers.title.name') }}
        </Typography>
      </Typography>
      <div class="server-page__info">
        <Typography size="s" color="sub">
          {{ t('servers.status.label') }}
          <Typography tag-name="span" size="m" :color="statusColor">{{ statusText }}</Typography>
        </Typography>
        <ServerPing />
      </div>
    </div>
    <Typography v-if="session.connectionError" class="server-page__error" size="s" color="error">
      {{ session.connectionError.message }}
    </Typography>
    <ServersControls />
    <ServersLobby class="server-page__lobby" />
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { Typography } from '@/shared/ui/typography'
  import { ServersControls } from '@/features/servers/contols'
  import { ServersLobby } from '@/features/servers/lobby'
  import { ServerPing } from '@/features/servers/ping'
  import { routeLocation } from '@/shared/router'
  import { useMatchSessionStore } from '@/entities/match'
  import logger from '@/shared/lib/helpers/logger'

  /**
   * Multiplayer entry point. PROTOCOL v1 has no online-count message, so the
   * old hardcoded counter is gone — the header shows the live connection state
   * instead. Create, join-by-code and the public room list all end the same
   * way: a `room_state` lands on the session store and this page leaves for
   * /room.
   */
  const { t } = useI18n()
  const router = useRouter()
  const session = useMatchSessionStore()

  onMounted(() => {
    void session.init()
  })

  const statusText = computed(() => {
    switch (session.connection) {
      case 'connecting':
        return t('servers.status.connecting')
      case 'reconnecting':
        return t('servers.status.reconnecting')
      case 'failed':
        return t('servers.status.failed')
      case 'idle':
      case 'in_room':
      case 'in_match':
        return t('servers.status.connected')
      case 'disconnected':
        return t('servers.status.offline')
      default: {
        // Exhaustiveness: a new TransportState fails to compile here; at runtime
        // the fallback stays what it always was.
        const unhandled: never = session.connection
        logger.warn('unhandled transport state', unhandled)
        return t('servers.status.offline')
      }
    }
  })

  const statusColor = computed(() => {
    if (session.connection === 'failed') return 'error'
    if (session.connection === 'connecting' || session.connection === 'reconnecting') return 'sub'
    return 'main'
  })

  // Already in a room (fresh room_state, or a back-navigation while seated):
  // the room page is the only place to be.
  watch(
    () => session.room,
    (room) => {
      if (room) void router.push(routeLocation.room())
    },
    { immediate: true }
  )
</script>

<style scoped lang="scss">
  .server-page {
    // The shell's #main is a grid; as its item this page must be allowed to
    // shrink (min-width: auto would size it to the row grid's min-content and
    // clip at phone widths — same trap /profile documents). The cap keeps a
    // scanning list at a readable width instead of strewing its columns
    // across the full 1440.
    width: 100%;
    min-width: 0;
    max-width: 64rem;
    margin-inline: auto;

    &__head {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 24px;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
    }

    &__info {
      text-align: end;
    }

    &__title {
      margin-bottom: 0;
    }

    &__error {
      display: block;
      margin-bottom: 16px;
    }

    &__lobby {
      margin-top: 32px;
    }
  }
</style>
