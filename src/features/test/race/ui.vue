<template>
  <!-- Renderless: the race has NO chrome of its own any more. Its whole visible
       surface is the standard solo screen — the record's settings in the bar,
       the red "repeated" mark, the pace selector reading "ghost", the caret in
       the field, and the defeat line on the results screen. -->
  <span hidden data-testid="race-host"></span>
</template>

<script setup lang="ts">
  import { onUnmounted, ref, toRef, watch } from 'vue'
  import { useI18n } from 'vue-i18n'

  import { useGameStore } from '@entities/game'
  import { GhostDriver } from '@entities/match'
  import { useRaceStore, type RaceConfigSnapshot } from '@entities/race'
  import { useReplaySource } from '@/features/replay-view'
  import { toast } from '@/shared/ui/sonner'
  import type { CoreContext } from '@typemore/core'

  /**
   * The race engine of the HOME solo screen — logic only. It fetches the run
   * (the same public-replay assembly the replay page uses), applies its stored
   * setup WHOLESALE to the config bar (snapshot first — the race store restores
   * it on exit), seats the ghost (the existing GhostDriver) and publishes
   * everything the visible surfaces read through the race store: the caret for
   * the field, the record owner's name for the pace selector, the defeat for
   * the results screen.
   *
   * There is no countdown and no overlay. The run is seated under the ordinary
   * lazy start policy, and BOTH clocks anchor to the player's first keystroke.
   * Exiting is the pace selector's job (any non-ghost choice calls
   * `race.exit()`); a fetch failure exits the same way, with a toast to say why.
   */
  const props = defineProps<{ runId: string }>()
  const { t } = useI18n()

  const race = useRaceStore()
  const source = useReplaySource(toRef(props, 'runId'))

  /** The same keyed instance the home page renders — one field, one store. */
  const game = useGameStore('local')

  type RacePhase = 'idle' | 'armed' | 'racing' | 'done'
  const phase = ref<RacePhase>('idle')

  let ghost: GhostDriver | null = null
  let ghostCtx: CoreContext | null = null
  let rafId = 0
  let goAt = 0

  const opponentName = (): string => source.displayName.value ?? t('race.ghost')

  /**
   * Publish the ghost's caret to the store (the home field renders it). The
   * anchor is target positions from the ghost's own state — wordIndex plus the
   * typed length inside it — mirroring the multiplayer rule: never measure the
   * raw typed string. A finished ghost leaves the track.
   */
  let lastWord = -1
  let lastChar = -1
  const publishCaret = (): void => {
    if (ghost === null) return
    if (ghost.view.finished) {
      if (lastWord !== -2) {
        lastWord = -2
        race.setGhostCaret(null)
      }
      return
    }
    const snapshot = ghost.view.snapshot
    const wordIndex = snapshot.wordIndex
    const charIndex = snapshot.input[wordIndex]?.length ?? 0
    if (wordIndex === lastWord && charIndex === lastChar) return
    lastWord = wordIndex
    lastChar = charIndex
    race.setGhostCaret({ label: opponentName(), wordIndex, charIndex })
  }

  const frame = (now: number): void => {
    if (ghost !== null && phase.value === 'racing') {
      ghost.advance(now - goAt)
      publishCaret()
      if (game.phase === 'finished') {
        finish()
        return
      }
    }
    rafId = requestAnimationFrame(frame)
  }

  /**
   * The defeat compares the player's finished wpm against the ghost's FINAL
   * fold — drained to its end, i.e. exactly the numbers the board row shows.
   * Only a LOSS is recorded: the results screen says nothing about a win.
   */
  const finish = (): void => {
    cancelAnimationFrame(rafId)
    if (ghost !== null) ghost.advance(Number.MAX_SAFE_INTEGER)
    publishCaret()
    phase.value = 'done'
    const you = Math.round(game.metrics.wpm)
    const them = Math.round(ghost?.metrics.value.wpm ?? 0)
    race.setDefeat(you < them ? { you, them } : null)
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

  /**
   * Fresh seats every (re)start: same seed, same log, and the ghost standing on
   * the start line (caret at the first word) until the player's first key.
   * The run keeps the DEFAULT lazy start — forcing 'input' also shields
   * against a stored config that carries a stray 'go' policy.
   */
  const start = (): void => {
    const data = source.replay.value
    if (data === null) return
    cancelAnimationFrame(rafId)
    race.setDefeat(null)
    ghostCtx = { config: data.config, words: data.words }
    ghost = new GhostDriver(ghostCtx, { delayMs: 0 })
    ghost.append(data.log)
    lastWord = -1
    lastChar = -1
    race.setGhostName(opponentName())
    publishCaret()
    game.setup({
      config: { ...data.config, startPolicy: 'input' },
      words: data.words,
      generation: data.generation,
      declaration: data.declaration
    })
    phase.value = 'armed'
  }

  // The player's first keystroke IS the starting gun: the game leaves `idle`,
  // and the ghost's clock anchors to that same instant.
  watch(
    () => game.phase,
    (now) => {
      if (now !== 'running' || phase.value !== 'armed') return
      goAt = performance.now()
      phase.value = 'racing'
      rafId = requestAnimationFrame(frame)
    }
  )

  // The run arrived: apply its setup to the bar (snapshot first) and arm.
  // A fetch failure exits the race outright — with no chrome of its own, a
  // toast is the only honest place to say why nothing happened.
  watch(
    () => source.state.value,
    (now) => {
      if (now === 'ready') {
        if (phase.value !== 'idle') return
        const settings = settingsOf()
        if (settings !== null) race.applySettings(settings)
        start()
        return
      }
      if (now === 'not-found' || now === 'error') {
        toast.error(t(now === 'not-found' ? 'race.notFound' : 'race.error'))
        race.exit()
      }
    },
    { immediate: true }
  )

  // Restart requests from the home surface (restart button, Esc, results).
  watch(
    () => race.restartTick,
    () => {
      if (source.state.value === 'ready') start()
    }
  )

  // NOTE: the 'local' game store belongs to the HOME page — the host borrows
  // it and must never release it; only the race's own clocks die with it.
  // The caret leaves the field with the host (exit clears it too, but an
  // unmount without exit — route change — must not strand a ghost).
  onUnmounted(() => {
    cancelAnimationFrame(rafId)
    race.setGhostCaret(null)
  })
</script>
