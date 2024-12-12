<template>
  <div class="server-page">
    <Transition name="fade" mode="out-in">
      <RoomManagement v-if="lobbyStore.isRoomManagementOpen" />
      <div v-else>
        <div class="server-page__head head">
          <Typography class="server-page__title" color="primary" size="xxl" tag-name="h1">
            Welcome to
            <Typography tag-name="span" size="xxl" color="main">Servers</Typography>
          </Typography>
          <div class="server-page__info">
            <Typography size="s" color="sub">
              Online
              <Typography tag-name="span" size="m" color="primary">{{ online }}</Typography>
            </Typography>
          </div>
        </div>
        <ServersControls @open-room="lobbyStore.createLobby" />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { Typography } from '@/shared/ui/typography'
  import { ServersControls } from '@/features/servers/contols'
  import { RoomManagement } from '@/pages/room'
  import { useLobbyStore } from '@/entities/lobby'
  const online = ref(3)
  const lobbyStore = useLobbyStore()
</script>

<style scoped lang="scss">
  .fade-enter-active,
  .fade-leave-active {
    transition: all 0.125s;
  }

  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
  }

  .server-page {
    &__head {
      display: flex;
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
  }
</style>
