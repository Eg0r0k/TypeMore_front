<template>
  <main class="home relative">
    <TimeProgress
      v-if="config.mode === 'time'"
      :running="isRunning"
      :duration-ms="config.time * 1000"
    />
    <SettingsBar v-show="!isRunning && !replaying" class="absolute top-0" />
    <ScoreHud
      v-show="isRunning && !config.blind"
      class="absolute inset-x-0 top-0"
      :score="game.score"
      :combo="game.combo"
      :multiplier="game.comboMultiplier"
      :mod-multiplier="game.modMultiplier"
      :wpm="game.metrics.wpm"
      :raw="game.metrics.raw"
    />
    <ReplayPlayer
      v-if="replaying && replayData"
      :replay="replayData"
      :is-right-to-left="isRightToLeft"
      @exit="replaying = false"
    />
    <Transition v-else name="fade" mode="out-in">
      <TestResults
        v-if="isFinished"
        key="results"
        :metrics="game.metrics"
        :timeline="game.timeline"
        :error-words="game.errorWords"
        :fail-reason="game.snapshot.failReason"
        :summary="summary"
        :score="game.scoreResult"
        :active-mods="game.activeMods"
        :save-state="saveState"
        :afk-ms="game.afk.afkMs"
        @retry="runSubmission.retry"
        @signin="onSignIn"
        @replay="onReplay"
      />
      <div v-else-if="setupState !== 'ready'" key="setup" class="home__notice">
        <Typography v-if="setupState === 'loading'" size="m" color="sub">
          {{ t('game.setup.loading') }}
        </Typography>
        <template v-else>
          <Typography size="m" color="error">
            {{
              setupState === 'dictionary-error'
                ? t('game.setup.dictionaryError', { lang: config.language })
                : t('game.setup.generationError')
            }}
          </Typography>
          <Button color="main-outline" size="s" @click="loadAndSetup">
            {{ t('game.setup.retry') }}
          </Button>
        </template>
      </div>
      <Test
        v-else
        key="field"
        :store="localSession"
        :is-right-to-left="isRightToLeft"
        :fading="config.fading"
        :flashlight="config.flashlight"
        :caret-style="config.caretStyle"
        :smooth-caret="config.smoothCaret"
      />
    </Transition>
  </main>
</template>

<script lang="ts" setup>
  import { computed, onMounted, ref, watch } from 'vue'
  import { useEventListener } from '@vueuse/core'
  import { useI18n } from 'vue-i18n'

  import { Test } from '@/widgets/test'
  import { SettingsBar } from '@/features/test/settings-bar'
  import { ScoreHud } from '@/features/test/score-hud'
  import { TimeProgress } from '@/features/test/time-progress'
  import { type ResultSummary, TestResults } from '@/features/test/results'
  import { ReplayPlayer } from '@/features/test/replay'
  import { type ReplayData, toCoreSetup, toGameSession, useGameStore } from '@entities/game'
  import { useConfigStore } from '@/entities/config/model/store'
  import { loadDictionaryBody, type DictionaryBody } from '@shared/api'
  import { createTimerWorker } from '@/shared/lib/hooks/createTimerWorker'
  import {
    type Dictionary,
    type GenerationMode,
    type ModsDeclaration,
    generateWords,
    makeSeedContext
  } from '@shared/core'
  import { useRouter } from 'vue-router'
  import { type RunSubmitContext, useRunSubmission } from '@/features/run-submit'
  import { Button } from '@shared/ui/button'
  import { Typography } from '@shared/ui/typography'

  /**
   * The game lives on `/`. This page owns the session lifecycle so the field can be
   * swapped for the results screen and back without losing it: it generates words
   * from the config, rebuilds on any core-bound setting change, drives the timer,
   * and restarts on Esc. The field (`Test`) and `TestResults` are pure views.
   */
  const { t } = useI18n()
  const game = useGameStore('local')
  const config = useConfigStore().config
  // The field reads only the GameView contract; `blind` flows in from app config
  // here — the widget layer never touches the config store.
  const localSession = toGameSession(game, () => config.blind)

  const isRightToLeft = ref(false)
  const isRunning = computed(() => game.phase === 'running')
  const isFinished = computed(() => game.phase === 'finished')

  /**
   * Whether a test exists to type into. `dictionary-error` — the word list
   * failed to load (server down, unknown language); `generation-error` — the
   * settings produced no words. Anything but `ready` hides the field: an empty
   * field still owns the keyboard, so the player would type into nothing.
   */
  type SetupState = 'loading' | 'ready' | 'dictionary-error' | 'generation-error'
  const setupState = ref<SetupState>('loading')

  // Replay overlay: a finished run played back over a second store instance.
  const replaying = ref(false)
  const replayData = ref<ReplayData | null>(null)
  function onReplay(): void {
    const data = game.getReplayData()
    if (!data) return
    replayData.value = data
    replaying.value = true
  }

  const summary = computed<ResultSummary>(() => ({
    mode: config.mode,
    language: config.language,
    difficulty: config.difficulty,
    amount: config.mode === 'time' ? config.time : config.words,
    punctuation: config.punctuation,
    numbers: config.numbers,
    randomCase: config.randomCase,
    nospace: config.nospace
  }))

  // Generation-time metadata neither the store nor the log retains (seed,
  // dictHash, lang). Captured here so the run-submit feature can assemble the
  // exact RUNS.md payload at finish; the two mod halves come from the run's own
  // snapshot (`getReplayData`), so payload and replay can never disagree.
  const runMeta = ref<{ seed: number; dictHash: string; lang: string } | null>(null)

  // Finished normally — not failed (expert/master/minSpeed) and not aborted.
  const finishedOk = computed(() => game.phase === 'finished' && game.snapshot.failReason === null)

  function buildRunContext(): RunSubmitContext | null {
    const meta = runMeta.value
    const replay = game.getReplayData()
    const score = game.scoreResult
    if (!meta || !replay || !score) return null
    return {
      mode: replay.config.mode,
      config: replay.config,
      generation: replay.generation,
      declaration: replay.declaration,
      lang: meta.lang,
      seed: meta.seed,
      dictHash: meta.dictHash,
      metrics: game.metrics,
      score,
      log: replay.log
    }
  }

  const router = useRouter()
  const runSubmission = useRunSubmission({ finished: finishedOk, buildContext: buildRunContext })
  const saveState = runSubmission.state

  function onSignIn(): void {
    void router.push('/login')
  }

  /** The view-only mods the run is played under — the trusted half of its multiplier. */
  const declarationOf = (): ModsDeclaration => ({
    blind: config.blind,
    fading: config.fading,
    flashlight: config.flashlight
  })

  /**
   * No word list ⇒ no test. Both failure modes below leave the game store
   * without a core, so the field would render empty while still capturing
   * keystrokes — surface the failure instead and let the player retry.
   */
  async function loadAndSetup(): Promise<void> {
    replaying.value = false
    setupState.value = 'loading'
    let lang: DictionaryBody
    try {
      lang = await loadDictionaryBody(config.language)
    } catch (error) {
      console.error('dictionary load failed', error)
      setupState.value = 'dictionary-error'
      return
    }
    const dictionary: Dictionary = {
      name: lang.name,
      bcp47: lang.bcp47 ?? config.language,
      words: lang.words
    }
    isRightToLeft.value = lang.rightToleft === true

    const { coreConfig, generation } = toCoreSetup({
      mode: config.mode as GenerationMode,
      time: config.time,
      words: config.words,
      punctuation: config.punctuation,
      numbers: config.numbers,
      randomCase: config.randomCase,
      reverse: config.reverse,
      nospace: config.nospace,
      difficulty: config.difficulty,
      minWpm: config.minWpm,
      freedomMode: config.freedomMode,
      stopOnError: config.stopOnError,
      quickEnd: config.quickEnd
    })
    // Local play seeds itself; a ranked/multiplayer server supplies the seed.
    const seed = Math.floor(Math.random() * 0x1_0000_0000)
    const generated = generateWords(dictionary, makeSeedContext(dictionary, seed, generation))
    if (generated.isErr()) {
      console.error('word generation failed', generated.error)
      setupState.value = 'generation-error'
      return
    }
    runMeta.value = {
      seed,
      dictHash: generated.value.context.dictVersion,
      lang: dictionary.bcp47
    }
    game.setup({
      config: coreConfig,
      words: generated.value.words,
      generation,
      declaration: declarationOf()
    })
    setupState.value = 'ready'
  }

  onMounted(async () => {
    game.attachTimer(createTimerWorker)
    await loadAndSetup()
  })

  // Any core-bound setting change rebuilds the game (fresh instance / restart);
  // the view-only mods are intentionally absent — they are applied live and
  // re-declared below instead of costing a regeneration.
  watch(
    () => [
      config.mode,
      config.time,
      config.words,
      config.language,
      config.punctuation,
      config.numbers,
      config.randomCase,
      config.nospace,
      config.difficulty,
      config.reverse,
      config.minWpm,
      config.freedomMode,
      config.stopOnError,
      config.quickEnd
    ],
    () => void loadAndSetup()
  )

  // View-only mods (blind/fading/flashlight) never rebuild the run, but they are
  // scored (SCORING_CONCEPT §2): re-declare them so the multiplier and the mod
  // chips follow the toggles. The store freezes the declaration once the run has
  // started, so a restart is what carries a mid-run change into the next run.
  watch(
    () => [config.blind, config.fading, config.flashlight],
    () => game.setDeclaration(declarationOf())
  )

  // Esc exits the replay if open, otherwise restarts with fresh words (bringing the
  // field and settings bar back).
  useEventListener(window, 'keydown', (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    if (replaying.value) {
      replaying.value = false
      return
    }
    void loadAndSetup()
  })
</script>

<style lang="scss" scoped>
  .home {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-height: 60vh;
    padding: 2rem 0;
  }

  .home__notice {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    align-items: center;
    justify-content: center;
    min-height: 8rem;
    text-align: center;
  }

  .fade-enter-active,
  .fade-leave-active {
    transition: opacity 0.15s ease;
  }

  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
  }
</style>
