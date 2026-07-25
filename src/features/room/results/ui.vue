<template>
  <div class="standings">
    <Typography class="standings__title" size="l" tag-name="h2" color="primary">
      {{ t('room.results.title') }}
    </Typography>
    <Typography
      v-if="connectionLost"
      data-testid="results-connection-lost"
      class="standings__banner"
      size="s"
      color="error"
    >
      {{ t('room.results.connectionLost') }}
    </Typography>
    <Typography
      v-if="reason === 'deadline' || reason === 'finish_window'"
      data-testid="results-reason"
      class="standings__banner"
      size="s"
      color="sub"
    >
      {{
        t(
          reason === 'deadline'
            ? 'room.results.reason.deadline'
            : 'room.results.reason.finishWindow'
        )
      }}
    </Typography>
    <table class="standings__table">
      <thead>
        <tr>
          <th class="standings__rank">#</th>
          <th>{{ t('room.results.player') }}</th>
          <th>{{ t('room.results.mods') }}</th>
          <th>{{ t('room.results.wpm') }}</th>
          <th>{{ t('room.results.acc') }}</th>
          <th>{{ mode === 'words' ? t('room.results.time') : t('room.results.score') }}</th>
          <th>{{ t('room.results.statusLabel') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in standings"
          :key="row.playerId"
          :class="rowClass(row)"
          :data-testid="row.isSelf ? 'standings-self' : undefined"
        >
          <td class="standings__rank">{{ row.rank }}</td>
          <td class="standings__nick">
            {{ row.nick }}
            <span v-if="row.isSelf" class="standings__you">{{ t('room.results.you') }}</span>
          </td>
          <td><FreemodChips :freemods="row.freemods" /></td>
          <td>{{ row.wpm !== undefined ? Math.round(row.wpm) : '—' }}</td>
          <td>{{ formatAcc(row.acc) }}</td>
          <td data-testid="standings-amount">{{ formatAmount(row) }}</td>
          <td class="standings__status" data-testid="standings-status">{{ statusLabel(row) }}</td>
        </tr>
      </tbody>
    </table>
    <div class="standings__actions">
      <Button data-testid="re-ready-button" :disabled="connectionLost" @click="emit('reReady')">
        {{ t('room.results.reReady') }}
      </Button>
      <Button color="gray" @click="emit('leave')">{{ t('room.leave') }}</Button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import clsx from 'clsx'
  import { FreemodChips } from '@/entities/lobby'
  import type { StandingRow } from '@/entities/lobby'
  import { Button } from '@/shared/ui/button'
  import { Typography } from '@/shared/ui/typography'

  /**
   * Final standings. `words` mode ranks by finish time (finishTimeMs), `time`
   * mode by score — the amount column follows the mode. Presentational: the
   * room page feeds standings + mode and receives reReady/leave.
   */
  const props = defineProps<{
    standings: StandingRow[]
    mode: 'time' | 'words'
    connectionLost?: boolean
    /** Δ3: why the server ended the match; only forced endings render a line. */
    reason?: 'all_finished' | 'deadline' | 'finish_window' | null
  }>()

  const emit = defineEmits<{
    (e: 'reReady'): void
    (e: 'leave'): void
  }>()

  const { t } = useI18n()

  const rowClass = (row: StandingRow) =>
    clsx('standings__row', {
      'standings__row--self': row.isSelf,
      'standings__row--out': row.status !== 'finished' || row.failReason !== undefined
    })

  /**
   * Below this the idle share is measurement noise (a bucket lost to a slow
   * batch), not a story worth putting next to someone's result.
   */
  const AFK_SHARE_FLOOR = 0.05

  /**
   * The server's own idle measurement (batch ARRIVAL buckets), relayed on
   * `match_end`. Without it an AFK dnf reads as a mysterious "dnf" — the
   * percentage is the whole explanation.
   */
  const afkLabel = (row: StandingRow): string => {
    const share = row.afkShare
    if (share === undefined || !Number.isFinite(share) || share < AFK_SHARE_FLOOR) return ''
    return t('room.results.afkShare', { percent: Math.round(Math.min(share, 1) * 100) })
  }

  /**
   * `status` is the WIRE status: an eliminated player finished on the wire, so a
   * bare "finished" would hide the freemod rule that actually ended their run.
   */
  const statusLabel = (row: StandingRow): string => {
    const base =
      row.failReason === undefined
        ? t(`room.results.status.${row.status}`)
        : `${t('room.results.status.eliminated')} · ${t(`room.results.failReason.${row.failReason}`)}`
    const afk = afkLabel(row)
    return afk === '' ? base : `${base} · ${afk}`
  }

  const formatAcc = (acc: number | undefined): string => {
    if (acc === undefined) return '—'
    // acc is a 0..1 fraction (core Metrics.accuracy); guard against a
    // pre-scaled percentage anyway.
    const pct = acc <= 1 ? acc * 100 : acc
    return `${Math.round(pct)}%`
  }

  // The amount column follows the room mode: finish time ranks `words`
  // matches, score ranks `time` matches (contract: finishTimeMs is only set
  // for words-mode finishers). An eliminated row has a wire `finished` status
  // but no legitimate amount — it never completed the text.
  const formatAmount = (row: StandingRow): string => {
    if (row.status !== 'finished' || row.failReason !== undefined) return '—'
    if (props.mode === 'words') {
      return row.finishTimeMs !== undefined ? `${(row.finishTimeMs / 1000).toFixed(1)}s` : '—'
    }
    return row.score !== undefined ? String(Math.round(row.score)) : '—'
  }
</script>

<style lang="scss" scoped>
  .standings {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 100%;

    &__banner {
      display: block;
    }

    &__table {
      width: 100%;
      border-collapse: collapse;

      th {
        padding: 0.5rem;
        font-size: 0.75rem;
        font-weight: normal;
        color: var(--sub-color);
        text-align: start;
        text-transform: uppercase;
      }

      td {
        padding: 0.5rem;
        border-top: 1px solid var(--sub-alt-color);
        color: var(--text-color);
      }
    }

    &__rank {
      width: 2.5rem;
    }

    &__you {
      margin-left: 0.375rem;
      font-size: 0.7rem;
      color: var(--main-color);
    }

    &__status {
      color: var(--sub-color);
    }

    &__row--self td {
      color: var(--main-color);
    }

    &__row--out td {
      color: var(--sub-color);
    }

    &__actions {
      display: flex;
      gap: 0.75rem;
    }
  }
</style>
