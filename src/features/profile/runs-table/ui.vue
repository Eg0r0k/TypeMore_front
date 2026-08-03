<template>
  <div class="flex flex-col gap-3" data-testid="profile-runs">
    <div
      v-if="state === 'error' && rows.length === 0"
      role="status"
      class="flex items-center gap-4 rounded bg-sub-alt p-4"
    >
      <Typography size="s" color="error">{{ t('profile.sectionError') }}</Typography>
      <Button color="main-outline" size="s" data-testid="profile-runs-retry" @click="reload">
        {{ t('profile.retry') }}
      </Button>
    </div>

    <div
      v-else-if="state === 'ready' && rows.length === 0"
      class="flex items-center gap-4 rounded bg-sub-alt p-4"
      data-testid="profile-runs-empty"
    >
      <Typography size="s" color="sub">{{ t('profile.runs.empty') }}</Typography>
    </div>

    <div v-else :class="TABLE_SCROLL">
      <!-- Slightly denser rows than the shared default: this table is the
           page's longest block and a laptop should fit a dozen runs. -->
      <table :class="[TABLE, '[&_td]:py-1.5']">
        <thead :class="TABLE_HEAD">
          <tr>
            <td />
            <th scope="col">{{ t('profile.runs.grade') }}</th>
            <th scope="col" data-num>wpm / raw</th>
            <th scope="col" data-num>acc</th>
            <th scope="col" data-num :title="t('profile.metric.consistency')">
              {{ t('profile.runs.consistency') }}
            </th>
            <th scope="col" data-num :title="t('profile.runs.charsTitle')">
              {{ t('profile.runs.chars') }}
            </th>
            <th scope="col">{{ t('profile.runs.mods') }}</th>
            <th scope="col">{{ t('profile.runs.lang') }}</th>
            <th scope="col">{{ t('profile.runs.when') }}</th>
            <th scope="col">
              <span class="sr-only">{{ t('profile.runs.actions') }}</span>
            </th>
          </tr>
        </thead>
        <tbody :class="TABLE_BODY">
          <tr v-for="run in rows" :key="run.id" data-testid="profile-run-row">
            <td />
            <td data-testid="profile-run-grade">
              <span v-if="run.grade" class="block text-xl leading-tight">{{ run.grade }}</span>
              <span v-else class="block text-xs text-sub">
                {{ t(`profile.runs.status.${run.status}`) }}
              </span>
              <span v-if="points(run)" class="block text-xs text-sub tabular-nums">
                {{ points(run) }}
              </span>
            </td>
            <td class="whitespace-nowrap" data-num>
              {{ serverWpm(run) }}
              <span class="text-sub">/ {{ serverRaw(run) }}</span>
            </td>
            <td data-num>{{ serverAcc(run) }}</td>
            <td data-num data-testid="profile-run-consistency">
              {{
                run.consistency !== null && run.consistency !== undefined
                  ? percent(run.consistency)
                  : '—'
              }}
            </td>
            <td class="whitespace-nowrap" data-num data-testid="profile-run-chars">
              <template v-if="run.chars">
                {{ run.chars.correct }}/{{ run.chars.incorrect }}/{{ run.chars.extra }}/{{
                  run.chars.missed
                }}
              </template>
              <template v-else>—</template>
            </td>
            <td>
              <!-- Mode detail. A quote run shows the TEXT (truncated) and its
                   length band instead of a duration or a word count, because it
                   carries neither: its length is the quote's. The link still
                   goes to the quote's board — the one page that owns that
                   text. -->
              <QuoteCell
                v-if="run.quoteId"
                :quote-id="run.quoteId"
                :fallback="t('profile.runs.quote')"
              />
              <span v-else class="block whitespace-nowrap">{{ modeDetail(run) }}</span>
              <GameModIcons v-if="modsOf(run)" class="mt-0.5 max-w-48" :mods="modsOf(run)!" />
              <!-- Saved, not counted: this run's text was taken from another run
                   (a race), so it is stored and shown and ranked nowhere. The
                   row is the only place that fact is visible after the results
                   screen. -->
              <span
                v-if="run.adoptedFromRunId"
                class="block text-xs text-sub"
                :title="t('profile.runs.notCountedTitle')"
                data-testid="profile-run-not-counted"
              >
                {{ t('profile.runs.notCounted') }}
              </span>
            </td>
            <td>{{ run.lang }}</td>
            <td class="whitespace-nowrap" :title="formatExactInstant(run.createdAt, locale)">
              <span class="block">{{ runDate(run.createdAt) }}</span>
              <span class="block text-xs text-sub tabular-nums">{{ runTime(run.createdAt) }}</span>
            </td>
            <td>
              <!-- Icon actions, the app's one pair: play = watch the replay,
                   swords = race this run's ghost. The words live in the title
                   and in aria-label, so the column stays a column. -->
              <!-- The replay button follows the SERVER's answer, not a client
                   guess: an own-feed row is watchable when accepted; a public
                   row exists only because the server already serves it. The
                   race action is the owner's own — a read-only (public) table
                   renders none. -->
              <div v-if="run.status === 'accepted'" class="flex gap-1">
                <Button
                  color="shadow"
                  size="icon-sm"
                  :title="t('profile.runs.replay')"
                  :aria-label="t('profile.runs.replay')"
                  data-testid="profile-run-replay"
                  @click="$emit('watch', run.id)"
                >
                  <IconWatch />
                </Button>
                <Button
                  v-if="!readonly"
                  color="shadow"
                  size="icon-sm"
                  :title="t('profile.runs.race')"
                  :aria-label="t('profile.runs.race')"
                  data-testid="profile-run-race"
                  @click="$emit('race', run.id)"
                >
                  <IconRace />
                </Button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <Button
      v-if="nextCursor"
      color="main-outline"
      size="s"
      class="self-center"
      :disabled="state === 'loading'"
      data-testid="profile-runs-more"
      @click="loadMore"
    >
      {{ state === 'loading' ? t('profile.runs.loading') : t('profile.runs.more') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, ref } from 'vue'
  import { useI18n } from 'vue-i18n'

  import {
    publicProfileRunsQueryOptions,
    queryClient,
    runsQueryOptions,
    type PublicRun,
    type RunSummary
  } from '@shared/api'
  import { GameModIcons, type GameModsLike } from '@/entities/game'
  import { formatExactInstant, formatLongDate, formatTimeOfDay } from '@/shared/lib/helpers/datetime'
  import { groupThousands } from '@/shared/lib/helpers/numbers'
  import { Button } from '@/shared/ui/button'
  import { TABLE, TABLE_BODY, TABLE_HEAD, TABLE_SCROLL } from '@/shared/ui/table'
  import { Typography } from '@/shared/ui/typography'
  import IconRace from '~icons/tabler/swords'
  import IconWatch from '~icons/tabler/eye'
  import { speed } from '../model/format'
  import { percent } from '@/shared/lib/helpers/numbers'
  import QuoteCell from './quote-cell.vue'

  /**
   * The profile's runs table: keyset load-more (the backend page stays keyset
   * by contract), cells fed by the summaries' derived cells —
   * grade/consistency/chars/mods/quoteId arrive lifted from the documents, so
   * the table never parses a setup snapshot.
   *
   * Two feeds, one table. Without `user` it renders the OWN runs feed
   * (/runs); with `user` it renders that player's PUBLIC history
   * (/users/{name}/runs) — the server-side allowlist rows, which carry every
   * cell this table shows and none of the private half. `readonly` drops the
   * race action (a public page offers no race).
   */
  const props = defineProps<{
    /** Render another player's public history instead of the own feed. */
    user?: string
    /** Hide the race action — the read-only (public) presentation. */
    readonly?: boolean
  }>()
  defineEmits<{ race: [runId: string]; watch: [runId: string] }>()
  const { t, locale } = useI18n()

  /** A row of either feed — the public row is a strict subset in cells used here. */
  type RunRow = RunSummary | PublicRun

  const rows = ref<RunRow[]>([])
  const nextCursor = ref<string | undefined>(undefined)
  const state = ref<'loading' | 'ready' | 'error'>('loading')

  async function fetchPage(cursor?: string): Promise<void> {
    state.value = 'loading'
    try {
      const page =
        props.user === undefined
          ? await queryClient.fetchQuery(runsQueryOptions(cursor))
          : await queryClient.fetchQuery(publicProfileRunsQueryOptions(props.user, cursor))
      rows.value = cursor === undefined ? [...page.runs] : [...rows.value, ...page.runs]
      nextCursor.value = page.nextCursor
      state.value = 'ready'
    } catch {
      state.value = 'error'
    }
  }

  const reload = (): void => void fetchPage()
  const loadMore = (): void => void fetchPage(nextCursor.value)
  onMounted(reload)

  const modeDetail = (run: RunRow): string => {
    if (run.durationMs !== null && run.durationMs !== undefined)
      return `time ${run.durationMs / 1000}s`
    if (run.wordCount !== null && run.wordCount !== undefined) return `${run.wordCount} words`
    return run.mode
  }

  /** Server numbers only — the table shows what the verdict verified. */
  const metricsOf = (run: RunRow): { wpm?: number; raw?: number; accuracy?: number } => {
    const metrics = run.serverMetrics
    return metrics !== null && metrics !== undefined
      ? (metrics as { wpm?: number; raw?: number; accuracy?: number })
      : {}
  }
  const serverWpm = (run: RunRow): string => {
    const wpm = metricsOf(run).wpm
    return typeof wpm === 'number' ? speed(wpm) : '—'
  }
  const serverRaw = (run: RunRow): string => {
    const raw = metricsOf(run).raw
    return typeof raw === 'number' ? speed(raw) : '—'
  }
  const serverAcc = (run: RunRow): string => {
    const acc = metricsOf(run).accuracy
    return typeof acc === 'number' ? percent(acc) : '—'
  }

  /**
   * The verified score under the grade. serverScore is `unknown` at the
   * summary boundary, so the shape is probed rather than assumed; an empty
   * string means "no verdict yet" and the line is not rendered at all.
   */
  const SCORE_KEYS = ['points', 'score', 'finalScore', 'total'] as const
  const scoreOf = (raw: unknown): number | undefined => {
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined
    if (raw !== null && typeof raw === 'object') {
      const record = raw as Record<string, unknown>
      for (const key of SCORE_KEYS) {
        const nested = scoreOf(record[key])
        if (nested !== undefined) return nested
      }
    }
    return undefined
  }
  const points = (run: RunRow): string => {
    const value = scoreOf(run.serverScore)
    return value === undefined ? '' : groupThousands(value)
  }

  /** The mods slice, narrowed for the shared icon chips; null when absent. */
  const modsOf = (run: RunRow): GameModsLike | null =>
    (run.mods ?? null) as GameModsLike | null

  /** Date and clock as two lines ("29 июля 2026" / "00:11"); the cell keeps the exact instant as a title. */
  const runDate = (iso: string): string => formatLongDate(iso, locale.value)
  const runTime = formatTimeOfDay
</script>
