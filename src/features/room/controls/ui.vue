<template>
  <div class="controls">
    <Button v-if="lobbyStore.hasLobbyPermission(LobbyPermission.StartGame)" color="gray">
      <template #left-icon>
        <Icon width="20" icon="tdesign:play-circle-stroke-filled" />
      </template>
      Start game
    </Button>
    <Button>
      <template #left-icon>
        <Icon width="20" icon="mingcute:check-fill" />
      </template>
      Ready
    </Button>
    <Button color="gray">
      <template #left-icon>
        <Icon width="20" icon="fa-solid:coffee" />
      </template>
      Take a break
    </Button>
    <Button @click="lobbyStore.leftLobby" color="gray">
      <template #left-icon>
        <Icon width="20" icon="pepicons-pop:leave" />
      </template>
      Leave room
    </Button>
  </div>
</template>

<script setup lang="ts">
  import { useLobbyStore } from '@/entities/lobby'
  import { LobbyPermission } from '@/entities/lobby/types/lobby'
  import { Button } from '@/shared/ui/button'
  import { Icon } from '@iconify/vue'
  const lobbyStore = useLobbyStore()
</script>

<style lang="scss" scoped>
  .controls {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
</style>
