<template>
  <main class="replay-page">
    <ReplayPlayer
      v-if="state === 'ready' && replay"
      :replay="replay"
      :is-right-to-left="isRightToLeft"
      @exit="goBack"
    />

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
      <Typography size="m" color="error">{{ t('replay.dictError') }}</Typography>
      <Button color="main-outline" size="s" data-testid="replay-dict-retry" @click="retryDict">
        {{ t('replay.retry') }}
      </Button>
    </div>

    <div
      v-else-if="state === 'dict-mismatch'"
      class="replay-page__notice"
      data-testid="replay-dict-mismatch"
    >
      <Typography size="m" color="error">{{ t('replay.dictMismatch') }}</Typography>
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
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import { useQuery } from '@tanstack/vue-query'

  import { ReplayPlayer } from '@/features/test/replay'
  import { replayFromApi } from '@/features/replay-view'
  import {
    dictionaryBodyByHashQueryOptions,
    runReplayLogQueryOptions,
    runReplayQueryOptions
  } from '@shared/api'
  import { ROUTE_NAMES } from '@app/router/route-names'
  import { Button } from '@shared/ui/button'
  import { Typography } from '@shared/ui/typography'

  /**
   * Public replay at `/replay/:runId` — anyone with the link, no session.
   *
   * THREE requests, and the whole design is that their failures stay apart.
   * (a) metadata names the run; (b) the event log and (c) the word list both
   * depend only on (a), so they are two independent queries enabled by the same
   * condition and run CONCURRENTLY — chaining (c) behind (b) would serialize two
   * fetches that share no data. Only when all three have landed does
   * `replayFromApi` combine them, and the player receives a finished
   * `ReplayData`: it does zero fetching and has no loading or error state of its
   * own, so every one of those belongs here.
   */
  const props = defineProps<{ runId: string }>()

  const { t } = useI18n()
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

  // By CONTENT HASH, never by language: `lang` says what the run was played in,
  // the hash says which exact word list it was played on.
  const dictHash = computed(() => meta.data.value?.dictHash ?? '')
  const dict = useQuery(
    computed(() =>
      gatedBy(
        dictionaryBodyByHashQueryOptions(dictHash.value),
        runIsReal.value && dictHash.value !== ''
      )
    )
  )

  /** `null` until all three have landed; otherwise the adapter's Result. */
  const built = computed(() => {
    const m = meta.data.value
    const l = log.data.value
    const d = dict.data.value
    if (!m || !l || !d) return null
    return replayFromApi(m, l, d)
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
    if (dict.isError.value) return 'dict-error'

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

  const isRightToLeft = computed(() => dict.data.value?.rightToleft ?? false)

  /** Whose run this is — shown alongside a stage-2/3 failure, not just on success. */
  const byLine = computed(() => {
    const name = meta.data.value?.displayName
    return name === undefined ? null : t('replay.by', { player: name })
  })

  /** Each retry refetches exactly the query that failed, never the whole page. */
  const retryLog = (): void => void log.refetch()
  const retryDict = (): void => void dict.refetch()

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
