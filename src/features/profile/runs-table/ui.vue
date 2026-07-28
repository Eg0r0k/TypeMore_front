<template>
  <div class="pf-runs" data-testid="profile-runs">
    <div v-if="state === 'error' && rows.length === 0" class="pf-runs__note">
      <Typography size="s" color="error">{{ t('profile.sectionError') }}</Typography>
      <Button color="main-outline" size="s" data-testid="profile-runs-retry" @click="reload">
        {{ t('profile.retry') }}
      </Button>
    </div>

    <div
      v-else-if="state === 'ready' && rows.length === 0"
      class="pf-runs__note"
      data-testid="profile-runs-empty"
    >
      <Typography size="s" color="sub">{{ t('profile.runs.empty') }}</Typography>
    </div>

    <div v-else class="pf-runs__scroll">
      <table class="pf-runs__table">
        <thead>
          <tr>
            <th>{{ t('profile.runs.when') }}</th>
            <th>{{ t('profile.runs.mode') }}</th>
            <th>{{ t('profile.runs.lang') }}</th>
            <th>wpm</th>
            <th>acc</th>
            <th>{{ t('profile.runs.consistency') }}</th>
            <th :title="t('profile.runs.charsTitle')">{{ t('profile.runs.chars') }}</th>
            <th>{{ t('profile.runs.grade') }}</th>
            <th>{{ t('profile.runs.mods') }}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="run in rows" :key="run.id" class="pf-runs__row" data-testid="profile-run-row">
            <td>{{ new Date(run.createdAt).toLocaleString() }}</td>
            <td>
              <!-- Mode detail incl. the quote link: the run's quote board is
                   the one page that owns that text. -->
              <RouterLink
                v-if="run.quoteId"
                class="pf-runs__quote"
                :to="quoteBoard(run.quoteId)"
                data-testid="profile-run-quote-link"
              >
                {{ t('profile.runs.quote') }}
              </RouterLink>
              <span v-else>{{ modeDetail(run) }}</span>
            </td>
            <td>{{ run.lang }}</td>
            <td class="pf-runs__num">{{ serverWpm(run) }}</td>
            <td class="pf-runs__num">{{ serverAcc(run) }}</td>
            <td class="pf-runs__num" data-testid="profile-run-consistency">
              {{
                run.consistency !== null && run.consistency !== undefined
                  ? percent(run.consistency)
                  : '—'
              }}
            </td>
            <td class="pf-runs__num" data-testid="profile-run-chars">
              <template v-if="run.chars">
                {{ run.chars.correct }}/{{ run.chars.incorrect }}/{{ run.chars.extra }}/{{
                  run.chars.missed
                }}
              </template>
              <template v-else>—</template>
            </td>
            <td>
              <span v-if="run.grade" class="pf-runs__grade">{{ run.grade }}</span>
              <span v-else class="pf-runs__pending">
                {{ t(`profile.runs.status.${run.status}`) }}
              </span>
            </td>
            <td class="pf-runs__mods">{{ modChips(run) }}</td>
            <td class="pf-runs__actions">
              <template v-if="run.status === 'accepted'">
                <Button
                  color="shadow"
                  size="s"
                  data-testid="profile-run-replay"
                  @click="$emit('watch', run.id)"
                >
                  {{ t('profile.runs.replay') }}
                </Button>
                <Button
                  color="shadow"
                  size="s"
                  data-testid="profile-run-race"
                  @click="$emit('race', run.id)"
                >
                  {{ t('profile.runs.race') }}
                </Button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <Button
      v-if="nextCursor"
      color="main-outline"
      size="s"
      class="pf-runs__more"
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
  import { RouterLink } from 'vue-router'
  import { useI18n } from 'vue-i18n'

  import { queryClient, runsQueryOptions, type RunSummary } from '@shared/api'
  import { routeLocation } from '@/shared/router'
  import { Button } from '@/shared/ui/button'
  import { Typography } from '@/shared/ui/typography'
  import { percent, speed } from '../model/format'

  /**
   * The profile's runs table over the OWN runs feed: keyset load-more (the
   * backend page stays keyset by contract), cells fed by the summaries'
   * derived cells — grade/consistency/chars/mods/quoteId arrive lifted from
   * the documents, so the table never parses a setup snapshot.
   */
  defineEmits<{ race: [runId: string]; watch: [runId: string] }>()
  const { t } = useI18n()

  const rows = ref<RunSummary[]>([])
  const nextCursor = ref<string | undefined>(undefined)
  const state = ref<'loading' | 'ready' | 'error'>('loading')

  async function fetchPage(cursor?: string): Promise<void> {
    state.value = 'loading'
    try {
      const page = await queryClient.fetchQuery(runsQueryOptions(cursor))
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

  const quoteBoard = (quoteId: string) => routeLocation.boards(`quote:${quoteId}`)

  const modeDetail = (run: RunSummary): string => {
    if (run.durationMs !== null && run.durationMs !== undefined)
      return `time ${run.durationMs / 1000}s`
    if (run.wordCount !== null && run.wordCount !== undefined) return `${run.wordCount} words`
    return run.mode
  }

  /** Server numbers only — the table shows what the verdict verified. */
  const metricsOf = (run: RunSummary): { wpm?: number; accuracy?: number } => {
    const metrics = run.serverMetrics
    return metrics !== null && metrics !== undefined
      ? (metrics as { wpm?: number; accuracy?: number })
      : {}
  }
  const serverWpm = (run: RunSummary): string => {
    const wpm = metricsOf(run).wpm
    return typeof wpm === 'number' ? speed(wpm) : '—'
  }
  const serverAcc = (run: RunSummary): string => {
    const acc = metricsOf(run).accuracy
    return typeof acc === 'number' ? percent(acc) : '—'
  }

  /** The mods slice as a compact chips string ("punctuation · expert"). */
  const modChips = (run: RunSummary): string => {
    const mods = run.mods as Record<string, unknown> | null | undefined
    if (!mods) return '—'
    const chips: string[] = []
    for (const key of [
      'punctuation',
      'numbers',
      'randomCase',
      'reverse',
      'nospace',
      'blind',
      'fading',
      'flashlight'
    ]) {
      if (mods[key] === true) chips.push(key)
    }
    if (typeof mods.difficulty === 'string' && mods.difficulty !== 'normal') {
      chips.push(mods.difficulty)
    }
    if (typeof mods.minWpm === 'number' && mods.minWpm > 0) chips.push(`min ${mods.minWpm}`)
    return chips.length > 0 ? chips.join(' · ') : '—'
  }
</script>

<style lang="scss" scoped>
  .pf-runs {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;

    &__scroll {
      overflow-x: auto;
    }

    &__table {
      width: 100%;
      font-size: 0.8125rem;
      border-collapse: collapse;

      th {
        padding: 0.375rem 0.625rem;
        font-weight: 400;
        color: var(--sub-color);
        text-align: left;
        white-space: nowrap;
      }

      td {
        padding: 0.375rem 0.625rem;
        color: var(--text-color);
        white-space: nowrap;
      }
    }

    &__row {
      border-top: 1px solid var(--sub-alt-color);
    }

    &__num {
      font-variant-numeric: tabular-nums;
    }

    &__grade {
      color: var(--main-color);
    }

    &__pending {
      font-size: 0.75rem;
      color: var(--sub-color);
    }

    &__quote {
      color: var(--main-color);
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }

    &__mods {
      max-width: 12rem;
      overflow: hidden;
      font-size: 0.75rem;
      color: var(--sub-color);
      text-overflow: ellipsis;
    }

    &__actions {
      display: flex;
      gap: 0.375rem;
    }

    &__more {
      align-self: center;
    }

    &__note {
      display: flex;
      gap: 1rem;
      align-items: center;
      padding: 1rem;
      background-color: var(--sub-alt-color);
      border-radius: var(--border-radius);
    }
  }
</style>
