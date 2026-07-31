<template>
  <div class="server-page">
    <div class="server-page__head head">
      <Typography class="server-page__title" color="primary" size="xxl" tag-name="h1">
        {{ t('servers.title.lead') }}
        <Typography tag-name="span" size="xxl" color="main">
          {{ t('servers.title.name') }}
        </Typography>
      </Typography>
      <ServerStatus />
    </div>
    <Typography v-if="session.connectionError" class="server-page__error" size="s" color="error">
      {{ session.connectionError.message }}
    </Typography>
    <!-- DOM order is panel → list so the page's entry actions lead on mobile
         and for assistive tech; the grid areas put the list on the leading
         side on wide screens, where it is the page's decision. -->
    <div class="server-page__body">
      <ServersControls class="server-page__panel" />
      <ServersLobby class="server-page__lobby" />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { Typography } from '@/shared/ui/typography'
  import { ServersControls } from '@/features/servers/contols'
  import { ServersLobby } from '@/features/servers/lobby'
  import { ServerStatus } from '@/features/servers/ping'
  import { routeLocation } from '@/shared/router'
  import { useMatchSessionStore } from '@/entities/match'

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
    margin-inline: auto;

    &__head {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 24px;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
    }

    &__title {
      margin-bottom: 0;
    }

    &__error {
      display: block;
      margin-bottom: 16px;
    }

    &__body {
      display: grid;
      grid-template-areas: 'lobby panel';
      grid-template-columns: minmax(0, 1fr) 280px;
      gap: 24px;
      align-items: start;
    }

    &__panel {
      grid-area: panel;
    }

    &__lobby {
      grid-area: lobby;
    }

    // One column once the list would be squeezed below a readable row
    // (~380px list + 280px panel + gap); the actions move above the list.
    @media screen and (width <= 720px) {
      &__body {
        grid-template-areas: 'panel' 'lobby';
        grid-template-columns: minmax(0, 1fr);
      }
    }
  }
</style>
