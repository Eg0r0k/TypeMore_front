<template>
  <Typography v-if="connected" size="s" color="sub" data-testid="server-ping">
    {{ t('servers.ping.label') }}
    <Typography tag-name="span" size="m" :color="color">
      {{ text }}
    </Typography>
  </Typography>
</template>

<script setup lang="ts">
  import { computed, onUnmounted, watch } from 'vue'
  import { useDocumentVisibility } from '@vueuse/core'
  import { useI18n } from 'vue-i18n'
  import { useMatchSessionStore } from '@/entities/match'
  import { Typography } from '@/shared/ui/typography'

  /**
   * Your round trip to the game server.
   *
   * It is OUR ping and it says so — `servers.ping.label` is "your ping". The
   * protocol carries no per-seat latency (§4 has `ntp_ping`/`ntp_pong` and
   * nothing else), so the number for another player is not something this
   * client can know; showing an opponent's ping would need a new frame, and
   * inventing one from their event timestamps would be a guess dressed as a
   * measurement.
   *
   * Re-measured while the tab is on screen, on the same reasoning the lobby
   * list uses for its poll: a hidden tab pinging forever is a background
   * heartbeat per open tab. The measurement itself never touches the NTP clock
   * offset — see `measureRtt`.
   */
  const REFRESH_MS = 10_000

  /** Above this the connection is worth a warning colour rather than a number. */
  const GOOD_MS = 80
  const POOR_MS = 200

  const { t } = useI18n()
  const session = useMatchSessionStore()
  const visibility = useDocumentVisibility()

  const connected = computed(
    () =>
      session.connection === 'idle' ||
      session.connection === 'in_room' ||
      session.connection === 'in_match'
  )

  let timer: number | null = null

  const stop = (): void => {
    if (timer !== null) {
      window.clearInterval(timer)
      timer = null
    }
  }

  watch(
    [connected, visibility],
    ([isConnected, isVisible]) => {
      stop()
      if (!isConnected || isVisible !== 'visible') return
      void session.measurePing()
      timer = window.setInterval(() => void session.measurePing(), REFRESH_MS)
    },
    { immediate: true }
  )

  onUnmounted(stop)

  /** `—` while nothing has been measured: an absent number, not a zero. */
  const text = computed(() =>
    session.pingMs === null ? '—' : t('servers.ping.value', { ms: session.pingMs })
  )

  const color = computed(() => {
    const ping = session.pingMs
    if (ping === null) return 'sub'
    if (ping <= GOOD_MS) return 'main'
    if (ping <= POOR_MS) return 'primary'
    return 'error'
  })
</script>
