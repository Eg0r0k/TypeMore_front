<template>
  <aside class="opponents">
    <Typography color="sub" size="xs" class="opponents__label">
      {{ t('room.match.opponents') }}
    </Typography>
    <div
      v-for="peer in peers"
      :key="peer.playerId"
      :class="peerClass(peer)"
      :data-peer-status="peer.status"
    >
      <div class="opponent__head">
        <span class="opponent__nick">{{ peer.nick }}</span>
        <span class="opponent__wpm">{{ Math.round(peer.metrics.wpm) }} wpm</span>
        <span v-if="peer.status !== 'racing'" :class="badgeClass(peer)" data-testid="peer-badge">
          {{ badgeLabel(peer) }}
        </span>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import clsx from 'clsx'
  import type { PeerRailEntry } from '@/entities/lobby'
  import { Typography } from '@/shared/ui/typography'

  /**
   * Compact per-peer race rail: nick, live wpm, and a status badge once the
   * peer leaves `racing` — live positions race as ghost carets inside the
   * local field, so the rail carries no progress bar or ghost field. A
   * desynced peer is a frozen ghost: greyed out with a distinct "out of sync"
   * badge — never silently hidden. An eliminated peer carries its reason in the
   * badge (`out · master`): the wire says it finished, so without the reason the
   * rail would read as a clean finish.
   */
  defineProps<{ peers: PeerRailEntry[] }>()
  const { t } = useI18n()

  const peerClass = (peer: PeerRailEntry) =>
    clsx('opponent', {
      'opponent--desynced': peer.status === 'desynced',
      'opponent--finished': peer.status === 'finished',
      'opponent--eliminated': peer.status === 'eliminated',
      'opponent--out':
        peer.status === 'dnf' ||
        peer.status === 'left' ||
        peer.status === 'disconnected' ||
        peer.status === 'eliminated'
    })

  const badgeClass = (peer: PeerRailEntry) =>
    clsx('opponent__badge', `opponent__badge--${peer.status}`)

  /** The short reason vocabulary is shared with the standings table (`room.results.failReason`). */
  const badgeLabel = (peer: PeerRailEntry) => {
    const label = t(`room.match.status.${peer.status}`)
    if (peer.status !== 'eliminated' || !peer.failReason) return label
    return `${label} · ${t(`room.results.failReason.${peer.failReason}`)}`
  }
</script>

<style lang="scss" scoped>
  .opponents {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;

    &__label {
      text-transform: uppercase;
    }
  }

  .opponent {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;

    &__head {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
    }

    &__nick {
      color: var(--text-color);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__wpm {
      margin-left: auto;
      font-size: 0.8rem;
      color: var(--sub-color);
    }

    &__badge {
      padding: 0 0.375rem;
      font-size: 0.7rem;
      border-radius: var(--border-radius);
      background-color: var(--sub-alt-color);
      color: var(--sub-color);

      &--finished {
        color: var(--main-color);
      }

      &--desynced {
        color: var(--bg-color);
        background-color: var(--error-color);
      }

      &--disconnected,
      &--dnf,
      &--left {
        color: var(--sub-color);
      }

      &--eliminated {
        color: var(--error-color);
      }
    }

    &--out {
      opacity: 0.55;
    }

    &--desynced {
      opacity: 0.55;
      filter: grayscale(1);
    }
  }
</style>
