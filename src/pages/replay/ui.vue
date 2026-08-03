<template>
  <main class="replay-page">
    <ReplayPlayer
      v-if="state === 'ready' && replay && watching"
      :replay="replay"
      :is-right-to-left="isRightToLeft"
      @exit="watching = false"
    />

    <!-- The landing state of a run link: the run's RESULTS, exactly the solo
         end-of-run screen (chart, stats, input history), rendered from the
         reconstructed log. Playback is the screen's replay action. -->
    <div
      v-else-if="state === 'ready' && replay && results"
      class="replay-page__results"
      data-testid="replay-results"
    >
      <div class="replay-page__byline">
        <!-- An icon beside someone else's result: the words live in the
             tooltip and aria-label, so the byline stays a byline. -->
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              color="main-outline"
              size="icon-sm"
              :aria-label="t('replay.back')"
              data-testid="replay-back"
              @click="goBack"
            >
              <IconArrowLeft class="size-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{{ t('replay.back') }}</TooltipContent>
        </Tooltip>
        <Typography v-if="byLine" size="s" color="sub">
          {{ byLine }} · {{ achievedDate }}
        </Typography>
      </div>

      <TestResults
        :metrics="results.metrics"
        :timeline="results.timeline"
        :fail-reason="null"
        :summary="summary"
        :score="replay.score"
        :active-mods="activeMods"
        :afk-ms="results.afk.afkMs"
        :quote-id="quoteRef?.quoteId ?? null"
        :quote-source="quoteSourceText"
        :history="results.history"
        :actions="RESULTS_ACTIONS"
        @replay="watching = true"
      />
    </div>

    <div v-else-if="state === 'loading'" class="replay-page__notice" data-testid="replay-loading">
      <Typography size="m" color="sub">{{ t('replay.loading') }}</Typography>
    </div>

    <div
      v-else-if="state === 'not-found'"
      class="replay-page__notice"
      data-testid="replay-not-found"
    >
      <Typography size="m" color="error">{{ t('replay.notFound') }}</Typography>
      <Typography size="s" color="sub">{{ t('replay.notFoundHint') }}</Typography>
      <!-- No retry: the 404 is the server's final answer, not a hiccup. -->
      <Button color="main-outline" size="s" data-testid="replay-back" @click="goBack">
        {{ t('replay.back') }}
      </Button>
    </div>

    <div
      v-else-if="state === 'log-loading'"
      class="replay-page__notice"
      data-testid="replay-log-loading"
    >
      <Typography v-if="byLine" size="s" color="sub">{{ byLine }}</Typography>
      <Typography size="m" color="sub">{{ t('replay.logLoading') }}</Typography>
    </div>

    <div
      v-else-if="state === 'log-error'"
      class="replay-page__notice"
      data-testid="replay-log-error"
    >
      <!-- The run itself is on screen: keep its owner visible so the failure
           reads as "the keystrokes did not arrive", not "no such run". -->
      <Typography v-if="byLine" size="s" color="sub">{{ byLine }}</Typography>
      <Typography size="m" color="error">{{ t('replay.logError') }}</Typography>
      <Typography size="s" color="sub">{{ t('replay.logErrorHint') }}</Typography>
      <Button color="main-outline" size="s" data-testid="replay-log-retry" @click="retryLog">
        {{ t('replay.retry') }}
      </Button>
    </div>

    <div
      v-else-if="state === 'dict-error'"
      class="replay-page__notice"
      data-testid="replay-dict-error"
    >
      <Typography v-if="byLine" size="s" color="sub">{{ byLine }}</Typography>
      <Typography size="m" color="error">{{ textErrorText }}</Typography>
      <Button color="main-outline" size="s" data-testid="replay-dict-retry" @click="retryDict">
        {{ t('replay.retry') }}
      </Button>
    </div>

    <div
      v-else-if="state === 'dict-mismatch'"
      class="replay-page__notice"
      data-testid="replay-dict-mismatch"
    >
      <Typography size="m" color="error">{{ textMismatchText }}</Typography>
      <!-- No retry: the body is addressed by its own content hash, so fetching
           it again returns the same bytes and the same mismatch. -->
      <Button color="main-outline" size="s" data-testid="replay-back" @click="goBack">
        {{ t('replay.back') }}
      </Button>
    </div>

    <div v-else class="replay-page__notice" data-testid="replay-build-error">
      <Typography size="m" color="error">{{ t('replay.buildError') }}</Typography>
      <Button color="main-outline" size="s" data-testid="replay-back" @click="goBack">
        {{ t('replay.back') }}
      </Button>
    </div>
  </main>
</template>

<script lang="ts" setup>
  import { computed, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import { useQuery } from '@tanstack/vue-query'

  import { ReplayPlayer } from '@/features/test/replay'
  import {
    type ResultSummary,
    type ResultsAction,
    TestResults,
    summaryAmountOf
  } from '@/features/test/results'
  import {
    quoteRefOf,
    replayFromApi,
    replayResults,
    type ReplayTextSource
  } from '@/features/replay-view'
  import { activeModsV1 } from '@typemore/core'
  import {
    dictionaryBodyByHashQueryOptions,
    quoteByIdQueryOptions,
    runReplayLogQueryOptions,
    runReplayQueryOptions
  } from '@shared/api'
  import { ROUTE_NAMES } from '@app/router/route-names'
  import { Button } from '@shared/ui/button'
  import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'
  import { Typography } from '@shared/ui/typography'
  import IconArrowLeft from '~icons/tabler/arrow-left'
  import { formatShortDate } from '@/shared/lib/helpers/datetime'
  import { durationSeconds } from '@/shared/lib/helpers/numbers'

  /**
   * Public replay at `/replay/:runId` — anyone with the link, no session.
   *
   * THREE requests, and the whole design is that their failures stay apart.
   * (a) metadata names the run; (b) the event log and (c) THE TEXT both depend
   * only on (a), so they are two independent queries enabled by the same
   * condition and run CONCURRENTLY — chaining (c) behind (b) would serialize two
   * fetches that share no data. Only when all three have landed does
   * `replayFromApi` combine them, and the player receives a finished
   * `ReplayData`: it does zero fetching and has no loading or error state of its
   * own, so every one of those belongs here.
   *
   * (c) is TWO endpoints, because there are two kinds of run. A seeded run's
   * text is a word list addressed by content hash; a quote run's text is a quote
   * addressed by id, and its `dictHash` is `dictVersion([text])` — not a
   * dictionary address. Sending every run to the dictionary endpoint is what
   * made every quote replay fail with "could not load the word list this run was
   * played on". Exactly one of the two is ever enabled.
   */
  const props = defineProps<{ runId: string }>()

  const { t, locale } = useI18n()
  const route = useRoute()
  const router = useRouter()

  const meta = useQuery(computed(() => runReplayQueryOptions(props.runId)))

  /**
   * Gated on (a) SUCCEEDING, not merely settling: asking for the log of a run
   * the server just 404'd would burn a second rate-limit token (the two routes
   * share one bucket) to learn what we already know.
   */
  const runIsReal = computed(() => meta.isSuccess.value)

  /**
   * Attach `enabled` while keeping the options type INTACT. A literal spread
   * (`{ ...runReplayLogQueryOptions(id), enabled }`) collapses the intersection
   * `queryOptions()` returns and leaves its `queryKey` data tag inconsistent
   * with the rest, which vue-query's overloads then reject. A generic spread
   * yields `T & { enabled }` and preserves it.
   */
  const gatedBy = <T extends object>(options: T, enabled: boolean): T & { enabled: boolean } => ({
    ...options,
    enabled
  })

  const log = useQuery(
    computed(() => gatedBy(runReplayLogQueryOptions(props.runId), runIsReal.value))
  )

  /** The quote this run was played on, or `null` for a seeded run. */
  const quoteRef = computed(() => {
    const m = meta.data.value
    return m ? quoteRefOf(m) : null
  })
  const isQuoteRun = computed(() => quoteRef.value !== null)

  // By CONTENT HASH, never by language: `lang` says what the run was played in,
  // the hash says which exact word list it was played on.
  const dictHash = computed(() => meta.data.value?.dictHash ?? '')
  const dict = useQuery(
    computed(() =>
      gatedBy(
        dictionaryBodyByHashQueryOptions(dictHash.value),
        runIsReal.value && !isQuoteRun.value && dictHash.value !== ''
      )
    )
  )

  // By ID, and the bytes are verified against the run's `dictHash` in the
  // adapter — a published quote is immutable, so this is as stable a read as the
  // hash-addressed body it replaces.
  const quote = useQuery(
    computed(() =>
      gatedBy(
        quoteByIdQueryOptions(quoteRef.value?.quoteId ?? ''),
        runIsReal.value && isQuoteRun.value
      )
    )
  )

  /** Whichever of the two carries this run's text, once it has landed. */
  const textSource = computed<ReplayTextSource | null>(() => {
    if (isQuoteRun.value) {
      const q = quote.data.value
      return q ? { kind: 'quote', quote: q } : null
    }
    const d = dict.data.value
    return d ? { kind: 'dictionary', body: d } : null
  })

  /** The stage-3 query that is actually in play — the other one never runs. */
  const textQueryFailed = computed(() =>
    isQuoteRun.value ? quote.isError.value : dict.isError.value
  )

  /** `null` until all three have landed; otherwise the adapter's Result. */
  const built = computed(() => {
    const m = meta.data.value
    const l = log.data.value
    const s = textSource.value
    if (!m || !l || !s) return null
    return replayFromApi(m, l, s)
  })

  type ViewState =
    | 'loading'
    | 'not-found'
    | 'log-loading'
    | 'log-error'
    | 'dict-error'
    | 'dict-mismatch'
    | 'build-error'
    | 'ready'

  const state = computed<ViewState>(() => {
    // Stage 1. A failure here is the only one that means "no such run" — and it
    // is deliberately indistinguishable from under-review, rejected, pending or
    // banned-owner, because the server answers all of them with the same 404.
    if (meta.isError.value) return 'not-found'
    if (!meta.data.value) return 'loading'

    // Stages 2 and 3, in flight together. Their failures are separate states:
    // the run exists and is on screen, only its payload did not arrive.
    if (log.isError.value) return 'log-error'
    if (textQueryFailed.value) return 'dict-error'

    const result = built.value
    if (!result) return 'log-loading'
    if (result.isErr()) {
      return result.error.kind === 'DictHashMismatch' ? 'dict-mismatch' : 'build-error'
    }
    return 'ready'
  })

  const replay = computed(() => {
    const result = built.value
    return result?.isOk() === true ? result.value : null
  })

  // ── The results screen over the reconstructed run ──────────────────────────

  /** Playback on demand; the page lands on the results. */
  const watching = ref(false)

  const RESULTS_ACTIONS: readonly ResultsAction[] = ['replay', 'screenshot']

  const results = computed(() => (replay.value ? replayResults(replay.value) : null))

  const summary = computed<ResultSummary>(() => {
    const r = replay.value
    if (!r) {
      return {
        mode: '',
        language: '',
        difficulty: '',
        amount: 0,
        punctuation: false,
        numbers: false,
        randomCase: false,
        nospace: false
      }
    }
    return {
      mode: r.config.mode,
      language: meta.data.value?.lang ?? '',
      difficulty: r.config.difficulty,
      // A quote's generation `length` is deliberately 0 (its targets are its
      // own bytes) — the reconstructed text carries the honest word count.
      amount: summaryAmountOf({
        mode: r.config.mode,
        isQuote: isQuoteRun.value,
        seconds: durationSeconds(r.config.durationMs),
        wordTarget: r.generation.length,
        quoteWords: r.words.length
      }),
      punctuation: r.generation.punctuation,
      numbers: r.generation.numbers,
      randomCase: r.generation.randomCase,
      nospace: r.config.nospace
    }
  })

  /** Mod chips from the run's own stored setup — the replay header shows the same. */
  const activeMods = computed(() => {
    const r = replay.value
    if (!r) return []
    return activeModsV1({ generation: r.generation, config: r.config }, r.declaration)
  })

  const quoteSourceText = computed(() => quote.data.value?.source ?? null)

  /** When the run was achieved, in the viewer's locale — chrome beside the byline. */
  const achievedDate = computed(() => {
    const at = meta.data.value?.achievedAt
    if (at === undefined) return ''
    const formatted = formatShortDate(at, locale.value)
    return formatted === '—' ? '' : formatted
  })

  // Only a word list carries direction; a quote is rendered in the page's own.
  const isRightToLeft = computed(() => dict.data.value?.rightToleft ?? false)

  /**
   * The stage-3 copy names what actually failed. Both kinds share the STATE —
   * "the run is on screen, its text did not arrive" — but a viewer told a word
   * list failed on a quote run would go looking for the wrong thing.
   */
  const textErrorText = computed(() =>
    isQuoteRun.value ? t('replay.quoteError') : t('replay.dictError')
  )
  const textMismatchText = computed(() =>
    isQuoteRun.value ? t('replay.quoteMismatch') : t('replay.dictMismatch')
  )

  /** Whose run this is — shown alongside a stage-2/3 failure, not just on success. */
  const byLine = computed(() => {
    const name = meta.data.value?.displayName
    return name === undefined ? null : t('replay.by', { player: name })
  })

  /** Each retry refetches exactly the query that failed, never the whole page. */
  const retryLog = (): void => void log.refetch()
  const retryDict = (): void => void (isQuoteRun.value ? quote.refetch() : dict.refetch())

  /**
   * Back to the board the viewer came from. `?bucket=` is how the boards page
   * names its selection, so carrying it back restores the exact board rather
   * than dumping them on the default one.
   */
  const bucket = computed(() => {
    const value = route.query.bucket
    return typeof value === 'string' && value !== '' ? value : null
  })

  const goBack = (): void => {
    void router.push({
      name: ROUTE_NAMES.BOARDS,
      query: bucket.value === null ? {} : { bucket: bucket.value }
    })
  }
</script>

<style lang="scss" scoped>
  .replay-page {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-height: 60vh;
    padding: 2rem 0;
  }

  .replay-page__results {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    width: 100%;
  }

  .replay-page__byline {
    display: flex;
    gap: 1rem;
    align-items: center;
  }

  .replay-page__notice {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    align-items: center;
    justify-content: center;
    min-height: 8rem;
    text-align: center;
  }
</style>
