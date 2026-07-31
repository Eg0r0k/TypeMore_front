<template>
  <Tooltip>
    <TooltipTrigger class="status focus-ring" data-testid="server-status" :aria-label="ariaLabel">
      <MotionConfig reduced-motion="user">
        <AnimatePresence mode="wait" :initial="false">
          <motion.span
            :key="visual.key"
            class="status__icon"
            :class="`status__icon--${visual.tone}`"
            :initial="{ opacity: 0, scale: 0.25, filter: 'blur(4px)' }"
            :animate="{ opacity: 1, scale: 1, filter: 'blur(0px)' }"
            :exit="{ opacity: 0, scale: 0.25, filter: 'blur(4px)' }"
            :transition="{ type: 'spring', duration: 0.3, bounce: 0 }"
          >
            <component
              :is="visual.icon"
              class="status__glyph"
              :class="{ 'status__glyph--spin': visual.spin }"
            />
          </motion.span>
        </AnimatePresence>
      </MotionConfig>
    </TooltipTrigger>
    <TooltipContent side="bottom">
      <span class="tabular-nums" data-testid="server-status-tooltip">{{ tooltipText }}</span>
    </TooltipContent>
  </Tooltip>
</template>

<script setup lang="ts">
  import { computed, onUnmounted, watch, type Component } from 'vue'
  import { useDocumentVisibility } from '@vueuse/core'
  import { useI18n } from 'vue-i18n'
  import { AnimatePresence, MotionConfig, motion } from 'motion-v'
  import IconLoader from '~icons/tabler/loader-2'
  import IconAlert from '~icons/tabler/alert-triangle'
  import IconBars1 from '~icons/tabler/antenna-bars-1'
  import IconBars2 from '~icons/tabler/antenna-bars-2'
  import IconBars3 from '~icons/tabler/antenna-bars-3'
  import IconBars4 from '~icons/tabler/antenna-bars-4'
  import { useMatchSessionStore } from '@/entities/match'
  import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'
  import logger from '@/shared/lib/helpers/logger'

  /**
   * The connection, as one glyph: a spinner while the socket settles, an alert
   * when it is dead, and antenna bars graded by OUR round trip once it is up —
   * three bars green, two amber, one red. The number itself moved into the
   * tooltip; the glyph is the glance, the hover is the measurement.
   *
   * It is OUR ping and the tooltip says so — `servers.ping.label` is "your
   * ping". The protocol carries no per-seat latency (§4 has `ntp_ping`/
   * `ntp_pong` and nothing else), so the number for another player is not
   * something this client can know.
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

  interface StatusVisual {
    /** AnimatePresence key: a change is what triggers the glyph swap. */
    key: string
    icon: Component
    tone: 'sub' | 'success' | 'warning' | 'error'
    spin?: boolean
  }

  const visual = computed<StatusVisual>(() => {
    if (session.connection === 'connecting' || session.connection === 'reconnecting') {
      return { key: 'loading', icon: IconLoader, tone: 'sub', spin: true }
    }
    if (!connected.value) {
      return { key: 'down', icon: IconAlert, tone: 'error' }
    }
    const ping = session.pingMs
    // Connected but not yet measured: bars present, none lit.
    if (ping === null) return { key: 'measuring', icon: IconBars1, tone: 'sub' }
    if (ping <= GOOD_MS) return { key: 'good', icon: IconBars4, tone: 'success' }
    if (ping <= POOR_MS) return { key: 'fair', icon: IconBars3, tone: 'warning' }
    return { key: 'poor', icon: IconBars2, tone: 'error' }
  })

  /** `—` while nothing has been measured: an absent number, not a zero. */
  const pingText = computed(() =>
    session.pingMs === null ? '—' : t('servers.ping.value', { ms: session.pingMs })
  )

  const tooltipText = computed(() =>
    connected.value ? `${t('servers.ping.label')} ${pingText.value}` : statusText.value
  )

  const ariaLabel = computed(() =>
    connected.value && session.pingMs !== null
      ? `${statusText.value}, ${t('servers.ping.label')} ${pingText.value}`
      : statusText.value
  )
</script>

<style scoped lang="scss">
  .status {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px;
    cursor: default;
    background: none;
    border: none;
    border-radius: var(--border-radius);

    &__icon {
      display: inline-flex;
    }

    &__icon--sub {
      color: var(--sub-color);
    }

    &__icon--success {
      color: var(--success-color);
    }

    &__icon--warning {
      color: var(--warning-color);
    }

    &__icon--error {
      color: var(--error-color);
    }

    &__glyph {
      width: 22px;
      height: 22px;
    }

    &__glyph--spin {
      animation: status-spin 1s linear infinite;
    }
  }

  @keyframes status-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .status__glyph--spin {
      animation: none;
    }
  }
</style>
