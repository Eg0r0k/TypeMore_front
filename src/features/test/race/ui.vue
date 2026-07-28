<template>
  <div class="race-host" data-testid="race-host">
    <div v-if="source.state.value === 'loading'" class="race-host__chip" data-testid="race-loading">
      <Typography size="s" color="sub">{{ t('race.loading') }}</Typography>
      <Button color="shadow" size="s" data-testid="race-exit" @click="exitRace">
        {{ t('race.exit') }}
      </Button>
    </div>

    <div
      v-else-if="source.state.value !== 'ready'"
      class="race-host__chip"
      data-testid="race-error"
    >
      <Typography size="s" color="error">
        {{ source.state.value === 'not-found' ? t('race.notFound') : t('race.error') }}
      </Typography>
      <Button
        v-if="source.state.value === 'error'"
        color="main-outline"
        size="s"
        data-testid="race-retry"
        @click="source.retry"
      >
        {{ t('race.retry') }}
      </Button>
      <Button color="shadow" size="s" data-testid="race-exit" @click="exitRace">
        {{ t('race.exit') }}
      </Button>
    </div>

    <template v-else>
      <!-- The visible race banner: who, at what pace, and the way out. -->
      <div class="race-host__chip race-host__chip--banner" data-testid="race-banner">
        <Typography size="s" color="primary">
          {{ t('race.banner', { player: opponentName, score: bannerScore }) }}
        </Typography>
        <Typography size="xs" color="sub">{{ t('race.unranked') }}</Typography>
        <Button color="shadow" size="s" data-testid="race-exit" @click="exitRace">
          {{ t('race.exit') }}
        </Button>
      </div>

      <!-- The compact opponent row: name, live WPM, progress, finished.
           (In-field ghost carets are a later phase.) -->
      <div class="race-host__opponent" data-testid="race-opponent">
        <span class="race-host__name">{{ opponentName }}</span>
        <span class="race-host__wpm" data-testid="race-opponent-wpm">
          {{ Math.round(ghostWpm) }} wpm
        </span>
        <span class="race-host__track" aria-hidden="true">
          <span class="race-host__fill" :style="{ width: `${Math.round(ghostProgress * 100)}%` }" />
        </span>
        <span v-if="ghostFinished" class="race-host__done" data-testid="race-opponent-finished">
          {{ t('race.opponentFinished') }}
        </span>
      </div>

      <!-- Side-by-side verdict once the player crosses the line. -->
      <div
        v-if="verdict"
        class="race-host__chip race-host__chip--verdict"
        data-testid="race-verdict"
      >
        <Typography size="m" :color="verdict.won ? 'primary' : 'sub'">
          {{ verdict.won ? t('race.won') : t('race.lost') }}
        </Typography>
        <Typography size="s" color="sub" data-testid="race-verdict-score">
          {{ t('race.score', { you: verdict.you, them: verdict.them }) }}
        </Typography>
        <Button color="main-outline" size="s" data-testid="race-again" @click="restart">
          {{ t('race.again') }}
        </Button>
      </div>

      <!-- 3-2-1: both clocks pin to the same GO. -->
      <div v-if="phase === 'countdown'" class="race-host__countdown" data-testid="race-countdown">
        <Typography size="xxl" color="primary">{{ countdown }}</Typography>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
  import { computed, onUnmounted, ref, toRef, watch } from 'vue'
  import { useI18n } from 'vue-i18n'

  import { useGameStore } from '@entities/game'
  import { GhostDriver } from '@entities/match'
  import { useRaceStore, type RaceConfigSnapshot } from '@entities/race'
  import { useReplaySource } from '@/features/replay-view'
  import { progressOf, type CoreContext } from '@shared/core'
  import { Button } from '@/shared/ui/button'
  import { Typography } from '@/shared/ui/typography'

  /**
   * The race state of the HOME solo screen (the race-vs-run rework). This host
   * owns everything race: fetching the run (the same public-replay assembly the
   * replay page uses), applying its stored setup WHOLESALE to the config bar
   * (snapshot first — the race store restores it on exit), seating the ghost
   * (the existing GhostDriver), the 3-2-1 countdown pinning both clocks to one
   * GO, the compact opponent row, and the verdict.
   *
   * The game surface itself stays the home page's one field — this component
   * renders no second game screen, which is the entire point of the rework.
   */
  const props = defineProps<{ runId: string }>()
  const { t } = useI18n()

  const race = useRaceStore()
  const source = useReplaySource(toRef(props, 'runId'))

  /** The same keyed instance the home page renders — one field, one store. */
  const game = useGameStore('local')

  const opponentName = computed(() => source.displayName.value ?? t('race.ghost'))
  const bannerScore = computed(() => {
    const data = source.replay.value
    if (!data) return ''
    const total = (data.score as { total?: number } | null)?.total
    return typeof total === 'number' ? String(total) : ''
  })

  type RacePhase = 'idle' | 'countdown' | 'racing' | 'done'
  const phase = ref<RacePhase>('idle')
  const countdown = ref(3)
  const verdict = ref<{ won: boolean; you: number; them: number } | null>(null)

  let ghost: GhostDriver | null = null
  let ghostCtx: CoreContext | null = null
  const ghostSeat = ref(0)
  const ghostWpm = computed(() => {
    void ghostSeat.value
    return ghost?.metrics.value.wpm ?? 0
  })
  const ghostProgress = computed(() => {
    void ghostSeat.value
    if (ghost === null || ghostCtx === null) return 0
    return progressOf(ghostCtx, ghost.view.snapshot)
  })
  const ghostFinished = computed(() => {
    void ghostSeat.value
    return ghost?.view.finished ?? false
  })

  let rafId = 0
  let goAt = 0
  let countdownTimer: ReturnType<typeof setInterval> | undefined
  const COUNTDOWN_FROM = 3
  const COUNTDOWN_STEP_MS = 1000

  const frame = (now: number): void => {
    if (ghost !== null && phase.value === 'racing') {
      ghost.advance(now - goAt)
      ghostSeat.value++
      if (game.phase === 'finished') {
        finish()
        return
      }
    }
    rafId = requestAnimationFrame(frame)
  }

  /**
   * The verdict compares the player's finished wpm against the ghost's FINAL
   * fold — drained to its end, i.e. exactly the numbers the board row shows.
   * Same words, so finishing them sooner IS the higher number.
   */
  const finish = (): void => {
    cancelAnimationFrame(rafId)
    if (ghost !== null) ghost.advance(Number.MAX_SAFE_INTEGER)
    ghostSeat.value++
    phase.value = 'done'
    const you = Math.round(game.metrics.wpm)
    const them = Math.round(ghost?.metrics.value.wpm ?? 0)
    verdict.value = { won: you >= them, you, them }
  }

  /** The run's core-bound settings, as the config bar should display them. */
  const settingsOf = (): Partial<RaceConfigSnapshot> | null => {
    const data = source.replay.value
    if (!data) return null
    const generation = data.generation
    const config = data.config
    const settings: Partial<RaceConfigSnapshot> = {
      mode: generation.mode as RaceConfigSnapshot['mode'],
      punctuation: generation.punctuation,
      numbers: generation.numbers,
      randomCase: generation.randomCase,
      reverse: generation.reverse,
      nospace: config.nospace,
      difficulty: config.difficulty,
      minWpm: config.minWpm
    }
    if (generation.mode === 'time') settings.time = Math.round(config.durationMs / 1000)
    if (generation.mode === 'words') settings.words = generation.length
    return settings
  }

  /** Fresh seats every (re)start: same seed, same log, same 3-2-1. */
  const start = (): void => {
    const data = source.replay.value
    if (data === null) return
    verdict.value = null
    ghostCtx = { config: data.config, words: data.words }
    ghost = new GhostDriver(ghostCtx, { delayMs: 0 })
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

  // The run arrived: apply its setup to the bar (snapshot first) and race.
  watch(
    () => source.state.value,
    (now) => {
      if (now !== 'ready' || phase.value !== 'idle') return
      const settings = settingsOf()
      if (settings !== null) race.applySettings(settings)
      start()
    },
    { immediate: true }
  )

  // Restart requests from the home surface (restart button, Esc, results).
  watch(
    () => race.restartTick,
    () => {
      if (source.state.value === 'ready') restart()
    }
  )

  const exitRace = (): void => race.exit()

  // NOTE: the 'local' game store belongs to the HOME page — the host borrows
  // it and must never release it; only the race's own clocks die with it.
  onUnmounted(() => {
    cancelAnimationFrame(rafId)
    clearInterval(countdownTimer)
  })
</script>

<style lang="scss" scoped>
  .race-host {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;

    &__chip {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      align-items: center;
      padding: 0.5rem 0.875rem;
      background-color: var(--sub-alt-color);
      border-radius: var(--border-radius);

      &--banner {
        justify-content: space-between;
      }

      &--verdict {
        justify-content: flex-start;
      }
    }

    &__opponent {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      padding: 0.375rem 0.875rem;
      font-size: 0.8125rem;
      background-color: var(--sub-alt-color);
      border-radius: var(--border-radius);
    }

    &__name {
      color: var(--text-color);
    }

    &__wpm {
      font-variant-numeric: tabular-nums;
      color: var(--sub-color);
    }

    &__track {
      position: relative;
      flex: 1;
      height: 4px;
      overflow: hidden;
      background-color: var(--bg-color);
      border-radius: 2px;
    }

    &__fill {
      position: absolute;
      inset: 0 auto 0 0;
      background-color: var(--main-color);
      border-radius: 2px;
      transition: width 0.15s linear;
    }

    &__done {
      color: var(--main-color);
    }

    &__countdown {
      position: fixed;
      inset: 0;
      z-index: var(--popup-z);
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      background-color: color-mix(in srgb, var(--bg-color) 60%, transparent);
    }
  }
</style>
