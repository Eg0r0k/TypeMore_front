<template>
  <div class="race-page">
    <div v-if="state === 'loading'" class="race-page__notice" data-testid="race-loading">
      <Typography size="m" color="sub">{{ t('race.loading') }}</Typography>
    </div>

    <div v-else-if="state === 'not-found'" class="race-page__notice" data-testid="race-not-found">
      <Typography size="m" color="error">{{ t('race.notFound') }}</Typography>
      <Button color="main-outline" size="s" data-testid="race-back" @click="goBack">
        {{ t('race.back') }}
      </Button>
    </div>

    <div v-else-if="state === 'error'" class="race-page__notice" data-testid="race-error">
      <Typography size="m" color="error">{{ t('race.error') }}</Typography>
      <Button color="main-outline" size="s" data-testid="race-retry" @click="retry">
        {{ t('race.retry') }}
      </Button>
      <Button color="main-outline" size="s" data-testid="race-back" @click="goBack">
        {{ t('race.back') }}
      </Button>
    </div>

    <template v-else>
      <header class="race-page__header">
        <Typography tag-name="h1" size="l" color="primary" data-testid="race-title">
          {{ t('race.title', { player: displayName ?? '?' }) }}
        </Typography>
        <Button color="main-outline" size="s" data-testid="race-back" @click="goBack">
          {{ t('race.back') }}
        </Button>
      </header>

      <!-- The seat: you type, the ghost replays. Both clocks pin to GO. -->
      <section class="race-page__seat" data-testid="race-self">
        <div class="race-page__bar">
          <Typography size="s" color="primary">{{ t('race.you') }}</Typography>
          <Typography size="s" color="sub" data-testid="race-self-wpm">
            {{ Math.round(game.metrics.wpm) }} wpm
          </Typography>
        </div>
        <Test
          :store="session"
          :is-right-to-left="false"
          :caret-style="config.caretStyle"
          :smooth-caret="config.smoothCaret"
        />
        <!--
          The countdown covers the field until GO, so the first keystroke and
          the ghost's first event race from the same instant.
        -->
        <div v-if="phase === 'countdown'" class="race-page__countdown" data-testid="race-countdown">
          <Typography size="xxl" color="primary">{{ countdown }}</Typography>
        </div>
      </section>

      <section class="race-page__seat" data-testid="race-ghost">
        <div class="race-page__bar">
          <Typography size="s" color="sub">{{ displayName ?? t('race.ghost') }}</Typography>
          <Typography size="s" color="sub" data-testid="race-ghost-wpm">
            {{ Math.round(ghostMetrics.wpm) }} wpm
          </Typography>
        </div>
        <Test :store="ghostView" view-only :is-right-to-left="false" />
      </section>

      <div v-if="phase === 'done'" class="race-page__verdict" data-testid="race-verdict">
        <Typography size="l" :color="won ? 'primary' : 'sub'">
          {{ won ? t('race.won') : t('race.lost') }}
        </Typography>
        <Typography size="s" color="sub">
          {{
            t('race.score', {
              you: Math.round(game.metrics.wpm),
              them: Math.round(ghostFinalWpm)
            })
          }}
        </Typography>
        <Button color="main-outline" size="s" data-testid="race-again" @click="restart">
          {{ t('race.again') }}
        </Button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
  import { computed, onUnmounted, ref, toRef, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'

  import { Test } from '@/widgets/test'
  import { releaseGameStore, toGameSession, useGameStore } from '@entities/game'
  import { GhostDriver } from '@entities/match'
  import { useReplaySource } from '@/features/replay-view'
  import { useConfigStore } from '@/entities/config'
  import { ROUTE_NAMES, routeLocation } from '@/shared/router'
  import { Button } from '@/shared/ui/button'
  import { Typography } from '@/shared/ui/typography'

  /**
   * Race a board run: the run's public replay data becomes a GHOST (the same
   * GhostDriver the match and the replay player already use), you take the
   * other seat, both clocks pin to one GO instant. WIRING of existing pieces —
   * the replay assembly, the ghost core, the Test field, the game store — with
   * nothing rebuilt: this page owns only the countdown and the two clocks.
   *
   * The race is local practice: nothing is submitted, no run is recorded. The
   * ghost's final numbers come from `replayResults` — the fold of its own log
   * — so the bar you race against is exactly what the board row shows.
   */
  const props = defineProps<{ runId: string }>()

  const { t } = useI18n()
  const route = useRoute()
  const router = useRouter()
  const { config } = useConfigStore()

  const { state, replay, displayName, retry } = useReplaySource(toRef(props, 'runId'))

  // ── The two seats ──────────────────────────────────────────────────────────

  const game = useGameStore('race')
  const session = toGameSession(game, () => false)

  type RacePhase = 'idle' | 'countdown' | 'racing' | 'done'
  const phase = ref<RacePhase>('idle')
  const countdown = ref(3)
  const won = ref(false)

  let ghost: GhostDriver | null = null
  const ghostSeat = ref(0)
  /** The ghost's live view — re-resolved when a (re)start builds a new driver. */
  const ghostView = computed(() => {
    void ghostSeat.value
    return ghost?.view ?? session
  })
  const ghostMetrics = computed(() => {
    void ghostSeat.value
    return ghost?.metrics.value ?? { wpm: 0 }
  })

  /**
   * The pace to beat, read off the ghost's own fold at race end. When the
   * ghost finished, this IS the run's final wpm; when the player crossed the
   * line first, the ghost is mid-run and its pace so far is the honest
   * comparison — same words, so finishing them sooner means the higher number.
   */
  const ghostFinalWpm = computed(() => ghostMetrics.value.wpm)

  let rafId = 0
  let goAt = 0
  let countdownTimer: ReturnType<typeof setInterval> | undefined

  const COUNTDOWN_FROM = 3
  const COUNTDOWN_STEP_MS = 1000

  const frame = (now: number): void => {
    if (ghost !== null && phase.value === 'racing') {
      ghost.advance(now - goAt)
      const playerDone = game.phase === 'finished'
      const ghostDone = ghost.drained && now - goAt >= ghost.endMs
      if (playerDone || ghostDone) {
        finish()
        return
      }
    }
    rafId = requestAnimationFrame(frame)
  }

  const finish = (): void => {
    phase.value = 'done'
    // Same words, so speed IS the ranking: whoever finished first typed them
    // faster, and in time mode both seats ran the same clock.
    won.value = game.metrics.wpm >= ghostFinalWpm.value
    cancelAnimationFrame(rafId)
  }

  const start = (): void => {
    const data = replay.value
    if (data === null) return
    // Fresh seats every start: the ghost re-folds its log from zero, the
    // player's core resets to the same words the run was played on.
    ghost = new GhostDriver({ config: data.config, words: data.words }, { delayMs: 0 })
    ghost.append(data.log)
    ghostSeat.value++
    game.setup({
      config: { ...data.config, startPolicy: 'go' },
      words: data.words,
      generation: data.generation,
      declaration: data.declaration
    })

    phase.value = 'countdown'
    countdown.value = COUNTDOWN_FROM
    clearInterval(countdownTimer)
    countdownTimer = setInterval(() => {
      countdown.value -= 1
      if (countdown.value > 0) return
      clearInterval(countdownTimer)
      goAt = performance.now()
      game.start(goAt)
      phase.value = 'racing'
      rafId = requestAnimationFrame(frame)
    }, COUNTDOWN_STEP_MS)
  }

  const restart = (): void => {
    cancelAnimationFrame(rafId)
    start()
  }

  // Seats fill as soon as the run is assembled.
  watch(
    () => state.value,
    (now) => {
      if (now === 'ready' && phase.value === 'idle') start()
    },
    { immediate: true }
  )

  const goBack = (): void => {
    const bucket = route.query.bucket
    if (typeof bucket === 'string' && bucket !== '') {
      void router.push(routeLocation.boards(bucket))
      return
    }
    if (window.history.length > 1) {
      router.back()
      return
    }
    void router.push({ name: ROUTE_NAMES.BOARDS })
  }

  onUnmounted(() => {
    cancelAnimationFrame(rafId)
    clearInterval(countdownTimer)
    releaseGameStore('race')
  })
</script>

<style lang="scss" scoped>
  .race-page {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 100%;

    &__notice {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      align-items: flex-start;
      padding: 2rem 0.5rem;
    }

    &__header {
      display: flex;
      gap: 1rem;
      align-items: center;
      justify-content: space-between;
    }

    &__seat {
      position: relative;
      padding: 0.75rem;
      background-color: var(--sub-alt-color);
      border-radius: var(--border-radius);
    }

    &__bar {
      display: flex;
      gap: 0.75rem;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: 0.5rem;
    }

    &__countdown {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: color-mix(in srgb, var(--bg-color) 75%, transparent);
      border-radius: var(--border-radius);
    }

    &__verdict {
      display: flex;
      gap: 1rem;
      align-items: baseline;
    }
  }
</style>
