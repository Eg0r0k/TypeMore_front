<template>
  <div class="room-managment">
    <RoomConfig class="room-managment__config" />
    <RoomPlayers class="room-managment__players" />
    <RoomControls class="room-managment__controls" />
    <RoomChat class="room-managment__chat" />
  </div>
</template>

<script setup lang="ts">
  import { RoomChat } from '@/features/room/chat'
  import { RoomConfig } from '@/features/room/config'
  import { RoomControls } from '@/features/room/controls'
  import { RoomPlayers } from '@/features/room/players'
</script>

<style lang="scss" scoped>
  .room-managment {
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
    .room-managment {
      grid-template:
        'config' auto
        'controls' auto
        'player' 1fr
        'chat' 1fr / 1fr;
    }
  }
</style>
