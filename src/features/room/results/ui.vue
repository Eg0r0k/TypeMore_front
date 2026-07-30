<template>
  <div class="flex w-full flex-col gap-10">
    <!--
      The local player's own run, drawn by the SOLO results view — the same
      grade, score, chart and stats row they get outside a room. A match cannot
      offer what that view's other props describe (there is no run to submit, no
      quote board, no next test and no replay screen here), so those are simply
      absent rather than invented.
    -->
    <!-- Wrapped, not labelled directly: the solo view renders a fragment, so an
         attribute put on it has no single root to land on. -->
    <div v-if="self" data-testid="results-self-run">
      <TestResults
        :metrics="self.metrics"
        :timeline="self.timeline"
        :fail-reason="self.failReason"
        :summary="self.summary"
        :score="self.score"
        :active-mods="self.activeMods"
        :afk-ms="self.afkMs"
        :actions="MATCH_ACTIONS"
      />
    </div>

    <section class="flex w-full flex-col gap-4">
      <Typography size="l" tag-name="h2" color="primary">
        {{ live ? t('room.match.eliminated.title') : t('room.results.title') }}
      </Typography>

      <!--
        Live: this seat is out but the match is not over, so the table below is a
        snapshot, not a result. The line says why the run ended and what is still
        being waited on — the two things the old elimination panel carried.
      -->
      <p v-if="live" class="text-sm text-sub" data-testid="results-live">{{ liveNote }}</p>

      <Typography
        v-if="connectionLost"
        data-testid="results-connection-lost"
        class="block"
        size="s"
        color="error"
      >
        {{ t('room.results.connectionLost') }}
      </Typography>
      <Typography
        v-if="reason === 'deadline' || reason === 'finish_window'"
        data-testid="results-reason"
        class="block"
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

      <!-- Eight narrow columns outgrow a phone long before they outgrow the
           layout, so the table scrolls inside its own box instead of the page.
           The paint is the app's shared table recipe (shared/ui/table). -->
      <div :class="TABLE_SCROLL">
        <table class="standings__table" :class="TABLE">
          <thead :class="TABLE_HEAD">
            <tr>
              <th class="standings__rank">#</th>
              <th>{{ t('room.results.player') }}</th>
              <th>{{ t('room.results.mods') }}</th>
              <th>{{ t('room.results.wpmRaw') }}</th>
              <th>{{ t('room.results.acc') }}</th>
              <th>{{ t('room.results.chars') }}</th>
              <th>{{ isCounted ? t('room.results.time') : t('room.results.score') }}</th>
              <th>{{ t('room.results.statusLabel') }}</th>
            </tr>
          </thead>
          <tbody :class="[TABLE_BODY, 'tabular-nums']">
            <tr
              v-for="row in standings"
              :key="row.playerId"
              :class="rowClass(row)"
              :data-testid="row.isSelf ? 'standings-self' : undefined"
            >
              <td class="standings__rank">{{ row.rank }}</td>
              <td class="whitespace-nowrap">
                {{ row.nick }}
                <span v-if="row.isSelf" class="ml-1.5 text-xs text-main">
                  {{ t('room.results.you') }}
                </span>
              </td>
              <td><FreemodChips :freemods="row.freemods" /></td>
              <!-- wpm carries the accent, raw hangs off it in sub — the same
                   pairing the solo stats row uses. -->
              <td data-testid="standings-wpm">
                <template v-if="row.wpm !== undefined">
                  {{ Math.round(row.wpm) }}
                  <span v-if="row.raw !== undefined" class="text-sub">
                    /
                    {{ Math.round(row.raw) }}
                  </span>
                </template>
                <template v-else>—</template>
              </td>
              <td>{{ formatAcc(row.acc) }}</td>
              <td data-testid="standings-chars">{{ formatChars(row.chars) }}</td>
              <td data-testid="standings-amount">{{ formatAmount(row) }}</td>
              <!-- The status is a LABEL, and a label stays label-coloured even
                   on the accented self row — hence the deliberate `!`. -->
              <td class="standings__status text-sub!" data-testid="standings-status">
                {{ statusLabel(row) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex flex-wrap gap-3">
        <!-- A rematch is only on offer once the match has actually ended. -->
        <Button
          v-if="!live"
          data-testid="re-ready-button"
          :disabled="connectionLost"
          @click="emit('reReady')"
        >
          {{ t('room.results.reReady') }}
        </Button>
        <!--
          Back to the lobby WITHOUT giving the seat up: `re-ready` says "again,
          now", this says "I am staying, just not yet" — the room's settings and
          everyone in it are still there.
        -->
        <Button v-if="!live" color="gray" data-testid="back-to-lobby-button" @click="emit('lobby')">
          {{ t('room.results.backToLobby') }}
        </Button>
        <Button color="shadow" data-testid="leave-button" @click="emit('leave')">
          {{ t('room.leave') }}
        </Button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import clsx from 'clsx'
  import type { CharCounts } from '@typemore/core'
  import { FreemodChips } from '@/entities/lobby'
  import type { StandingRow } from '@/entities/lobby'
  import type { OutcomeReason } from '@/entities/match'
  import { type ResultsAction, TestResults } from '@/features/test/results'
  import { Button } from '@/shared/ui/button'
  import {
    TABLE,
    TABLE_BODY,
    TABLE_HEAD,
    TABLE_ROW_MUTED,
    TABLE_ROW_SELF,
    TABLE_SCROLL
  } from '@/shared/ui/table'
  import { Typography } from '@/shared/ui/typography'

  import type { MatchSelfRun } from './model/match-results'

  /**
   * The room's result screen: the local player's own run on top, drawn exactly as
   * the solo one is, and one row per participant underneath.
   *
   * It serves two moments. After `match_end` the rows are the folded standings —
   * a COUNTED mode (`words`, `quote`) ranks by finish time, since everyone typed
   * the same text and the clock is the whole comparison, while `time` mode ranks
   * by score, and the amount column follows that. Before it (an eliminated seat)
   * the rows are a LIVE snapshot of the peers still racing, and `live` says so.
   *
   * Presentational: the page feeds rows + mode + the local run and receives
   * reReady/leave.
   */
  const props = defineProps<{
    standings: StandingRow[]
    mode: 'time' | 'words' | 'quote'
    connectionLost?: boolean
    /** Δ3: why the server ended the match; only forced endings render a line. */
    reason?: 'all_finished' | 'deadline' | 'finish_window' | null
    /** The local seat's run. `null` when there is none to show (a reload forfeit). */
    self?: MatchSelfRun | null
    /** The match is still running and this seat is out: rows move, ranks are provisional. */
    live?: boolean
    /** How many opponents the live screen is still waiting on. */
    racingCount?: number
    /** Why this seat is out, named on the live screen. */
    outcomeReason?: OutcomeReason | null
  }>()

  const emit = defineEmits<{
    (e: 'reReady'): void
    /** Back to this room's lobby — the seat is kept. */
    (e: 'lobby'): void
    (e: 'leave'): void
  }>()

  const { t } = useI18n()

  /** A match has no next test to load and no replay screen to open. */
  const MATCH_ACTIONS: readonly ResultsAction[] = ['screenshot']

  /**
   * The BEM names stay as state markers (the row states are what the specs
   * assert on); the paint comes from the shared table recipe — the accent for
   * the row the reader is looking for, quiet for a row that did not finish.
   */
  const rowClass = (row: StandingRow) => {
    const isOut =
      row.status === 'dnf' ||
      row.status === 'left' ||
      row.status === 'desynced' ||
      (row.failReason ?? null) !== null
    return clsx('standings__row', {
      [`standings__row--self ${TABLE_ROW_SELF}`]: row.isSelf,
      [`standings__row--out ${TABLE_ROW_MUTED}`]: isOut
    })
  }

  /** The live screen's one line: why this seat is out, and what is left to wait for. */
  const liveNote = computed(() => {
    const parts = []
    if (props.outcomeReason !== null && props.outcomeReason !== undefined) {
      parts.push(t(`room.match.eliminated.reason.${props.outcomeReason}`))
    }
    parts.push(t('room.match.eliminated.waiting'))
    parts.push(t('room.match.waiting.racing', { count: props.racingCount ?? 0 }))
    return parts.join(' · ')
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
   * For a final row `status` is the WIRE status: an eliminated player finished on
   * the wire, so a bare "finished" would hide the freemod rule that actually ended
   * their run. A live row already names the elimination itself, but still needs
   * the rule spelled out beside it.
   */
  const statusLabel = (row: StandingRow): string => {
    const failReason = row.failReason ?? null
    const base =
      failReason === null
        ? t(`room.results.status.${row.status}`)
        : `${t('room.results.status.eliminated')} · ${t(`room.results.failReason.${failReason}`)}`
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

  /**
   * correct/incorrect/extra/missed, the same four in the same order as the solo
   * screen. Blank for an opponent: the counts are folded per seat by the session
   * store but not published on a standing, and a peer's raw log is not ours to
   * fold from the view layer.
   */
  const formatChars = (chars: CharCounts | undefined): string =>
    chars === undefined ? '—' : `${chars.correct}/${chars.incorrect}/${chars.extra}/${chars.missed}`

  /** Counted modes race to the end of the text; a timed one races the score. */
  const isCounted = computed(() => props.mode === 'words' || props.mode === 'quote')

  // The amount column follows the room mode: finish time ranks a counted
  // match, score ranks a timed one (contract: finishTimeMs is only set for
  // counted finishers). An eliminated row has a wire `finished` status but no
  // legitimate amount — it never completed the text.
  const formatAmount = (row: StandingRow): string => {
    if (row.status !== 'finished' || (row.failReason ?? null) !== null) return '—'
    if (isCounted.value) {
      return row.finishTimeMs !== undefined ? `${(row.finishTimeMs / 1000).toFixed(1)}s` : '—'
    }
    return row.score !== undefined ? String(Math.round(row.score)) : '—'
  }
</script>
