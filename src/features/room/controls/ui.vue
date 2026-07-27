<template>
  <div class="controls">
    <!--
      The button stays live when the gate is closed. A disabled control with a
      line of small print under it makes the player read to find out why; a
      press that answers is one gesture, and the answer lands where every other
      answer in this app lands.
    -->
    <Button v-if="session.isHost" data-testid="start-button" @click="onStart">
      <IconPlayerPlay />
      {{ t('room.start') }}
    </Button>
    <Button
      v-if="!session.isHost"
      data-testid="ready-button"
      :color="isReady ? 'gray' : undefined"
      @click="session.setReady(!isReady)"
    >
      <IconCheck v-if="!isReady" />
      <IconX v-else />
      {{ isReady ? t('room.unready') : t('room.ready') }}
    </Button>
    <Button color="gray" data-testid="leave-button" @click="session.leaveRoom()">
      <IconLogout />
      {{ t('room.leave') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import type { RoomPlayer } from '@/entities/lobby'
  import { useMatchSessionStore } from '@/entities/match'
  import { Button } from '@/shared/ui/button'
  import { toast } from '@/shared/ui/sonner'
  import IconCheck from '~icons/tabler/check'
  import IconX from '~icons/tabler/x'
  import IconLogout from '~icons/tabler/logout'
  import IconPlayerPlay from '~icons/tabler/player-play'

  /**
   * Lobby actions. `start_match` gating mirrors §3: at least two seats and
   * every NON-host seat ready (the host itself never needs to ready up). The
   * gate is explained on the attempt, as a toast, rather than as standing small
   * print under a dead button.
   */
  const { t } = useI18n()
  const session = useMatchSessionStore()

  const players = computed<RoomPlayer[]>(() => session.room?.players ?? [])
  const nonHostSeats = computed(() =>
    players.value.filter((player: RoomPlayer) => player.playerId !== session.room?.hostPlayerId)
  )
  const canStart = computed(
    () =>
      players.value.length >= 2 && nonHostSeats.value.every((player: RoomPlayer) => player.ready)
  )
  /**
   * Why the match cannot start, said only when someone tries. The gate itself is
   * still §3's — two seats, every non-host seat ready — and the server enforces
   * it regardless of what this button does.
   */
  const onStart = (): void => {
    if (canStart.value) {
      session.startMatch()
      return
    }
    toast.warning(players.value.length < 2 ? t('room.gate.needPlayers') : t('room.gate.notReady'))
  }

  const isReady = computed(
    () =>
      players.value.find((player: RoomPlayer) => player.playerId === session.selfId)?.ready === true
  )
</script>

<style lang="scss" scoped>
  .controls {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
</style>
