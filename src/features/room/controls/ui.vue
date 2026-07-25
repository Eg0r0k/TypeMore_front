<template>
  <div class="controls">
    <template v-if="session.isHost">
      <Button data-testid="start-button" :disabled="!canStart" @click="session.startMatch()">
        <IconPlayerPlay />
        {{ t('room.start') }}
      </Button>
      <Typography
        v-if="gateHint"
        data-testid="start-hint"
        class="controls__hint"
        size="xs"
        color="sub"
      >
        {{ gateHint }}
      </Typography>
    </template>
    <Button
      v-else
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
  import { Typography } from '@/shared/ui/typography'
  import IconCheck from '~icons/tabler/check'
  import IconX from '~icons/tabler/x'
  import IconLogout from '~icons/tabler/logout'
  import IconPlayerPlay from '~icons/tabler/player-play'

  /**
   * Lobby actions. `start_match` gating mirrors §3: at least two seats and
   * every NON-host seat ready (the host itself never needs to ready up). A
   * server-side `not_ready` rejection surfaces through the same hint line.
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
  const gateHint = computed(() => {
    if (session.lastError?.code === 'not_ready') return t('room.gate.notReady')
    if (canStart.value) return null
    if (players.value.length < 2) return t('room.gate.needPlayers')
    return t('room.gate.notReady')
  })

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

    &__hint {
      text-align: center;
    }
  }
</style>
