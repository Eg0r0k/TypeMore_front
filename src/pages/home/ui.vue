<template>
  <main class="home">
    <!--
      Pinned to the viewport, not to the stage: it is `position: fixed`. A timed
      run drains its duration, a counted one fills with the words committed —
      same bar, same question ("how much of this is left").
    -->
    <TestProgress
      :running="isRunning"
      :duration-ms="config.mode === 'time' ? config.time * 1000 : undefined"
      :value="config.mode === 'time' ? undefined : wordProgress"
    />

    <!--
      One of three screens, never two: the replay player, the results, or the
      typing stage. The results are their own shape (a chart, a breakdown, a list
      of mistyped words) and do not belong in the stage's fixed field row — the
      row exists precisely so nothing can resize it.
    -->
    <ReplayPlayer
      v-if="replaying && replayData"
      :replay="replayData"
      :is-right-to-left="isRightToLeft"
      @exit="replaying = false"
    />

    <TestResults
      v-else-if="isFinished"
      :metrics="game.metrics"
      :timeline="game.timeline"
      :fail-reason="game.snapshot.failReason"
      :summary="summary"
      :score="game.scoreResult"
      :active-mods="game.activeMods"
      :save-state="saveState"
      :afk-ms="game.afk.afkMs"
      :quote-id="activeQuote?.id ?? null"
      :quote-source="activeQuote?.source ?? null"
      @retry="runSubmission.retry"
      @signin="onSignIn"
      @replay="onReplay"
      @next="loadAndSetup"
    />

    <TestStage v-else>
      <!-- Settings, then the language, then the words: the language is the last
           thing above the field because it is the one that names what is in it. -->
      <template #above>
        <SettingsBar v-show="!isRunning" />
        <ScoreHud
          v-show="isRunning && !config.blind"
          :score="game.score"
          :combo="game.combo"
          :multiplier="game.comboMultiplier"
          :mod-multiplier="game.modMultiplier"
          :wpm="game.metrics.wpm"
          :raw="game.metrics.raw"
        />
      </template>

      <Transition name="fade" mode="out-in">
        <div v-if="setupState !== 'ready'" key="setup" class="home__notice">
          <Typography v-if="setupState === 'loading'" size="m" color="sub">
            {{ t('game.setup.loading') }}
          </Typography>
          <template v-else>
            <Typography size="m" color="error">
              {{ setupErrorText }}
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

      <template #below>
        <Button
          color="shadow"
          size="icon"
          :aria-label="t('game.restart')"
          data-testid="restart-test"
          @click="loadAndSetup"
        >
          <IconRestart class="size-6" />
        </Button>
      </template>
    </TestStage>
  </main>
</template>

<script lang="ts" setup>
  import { computed, onMounted, ref, watch } from 'vue'
  import { useEventListener } from '@vueuse/core'
  import { useI18n } from 'vue-i18n'

  import { Test } from '@/widgets/test'
  import { TestStage } from '@/features/layouts/test-stage'
  import { SettingsBar } from '@/features/test/settings-bar'
  import { ScoreHud } from '@/features/test/score-hud'
  import { TestProgress } from '@/features/test/progress'
  import { type ResultSummary, TestResults } from '@/features/test/results'
  import { ReplayPlayer } from '@/features/test/replay'
  import { type ReplayData, toCoreSetup, toGameSession, useGameStore } from '@entities/game'
  import { useConfigStore } from '@/entities/config/model/store'
  import {
    isApiError,
    loadDictionaryBody,
    loadRandomQuote,
    quoteCorpusLang,
    type DictionaryBody,
    type Quote
  } from '@shared/api'
  import { ConfigModes } from '@/shared/constants/type'
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
  import IconRestart from '~icons/tabler/refresh'

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
   * Share of the words committed — what the progress bar fills to in a counted
   * run. Measured against the words the run ACTUALLY has, not the configured
   * count: a quote has no configured length, and `generateWords` is free to
   * return a different number than was asked for.
   */
  const wordProgress = computed(() => {
    const total = game.words.length
    return total > 0 ? Math.min(1, game.wordIndex / total) : 0
  })

  /**
   * Whether a test exists to type into. `dictionary-error` — the word list
   * failed to load (server down, unknown language); `generation-error` — the
   * settings produced no words; `quote-empty` — the language/length filter
   * matches no quote (the registry's honest 404, not a failure); `quote-error`
   * — the draw itself failed. Anything but `ready` hides the field: an empty
   * field still owns the keyboard, so the player would type into nothing.
   */
  type SetupState =
    'loading' | 'ready' | 'dictionary-error' | 'generation-error' | 'quote-empty' | 'quote-error'
  const setupState = ref<SetupState>('loading')

  /**
   * The quote the current run is played on, `null` for a seeded run. Its
   * attribution is shown on the RESULTS screen only: under the field it would be
   * one more thing changing height around the words.
   */
  const activeQuote = ref<Quote | null>(null)

  const setupErrorText = computed(() => {
    switch (setupState.value) {
      case 'dictionary-error':
        return t('game.setup.dictionaryError', { lang: config.language })
      case 'quote-empty':
        // The corpus that was actually asked for, not the dictionary key: a
        // draw for `russian_50k` is a draw for `russian`, and naming the key
        // the player set would send them looking for a filter that was never
        // sent.
        return t('game.setup.quoteEmpty', {
          lang: quoteCorpusLang(config.language),
          group: t(`game.quote.group.${config.quoteGroup}`)
        })
      case 'quote-error':
        return t('game.setup.quoteError')
      default:
        return t('game.setup.generationError')
    }
  })

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
    // A quote's magnitude is the text's own word count, not a configured
    // preset — the config's `words` would be a number the run never used.
    amount:
      activeQuote.value !== null
        ? game.words.length
        : config.mode === 'time'
          ? config.time
          : config.words,
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
   * No text ⇒ no test. Every failure below leaves the game store without a
   * core, so the field would render empty while still capturing keystrokes —
   * surface the failure instead and let the player retry.
   *
   * A QUOTE run draws its text first, and the dictionary becomes optional:
   * `generateWords` never reads it for a quote, and `code_python` /
   * `code_javascript` are quote-only languages with no served word list at all.
   * A seeded run still treats a missing dictionary as fatal.
   */
  async function loadAndSetup(): Promise<void> {
    replaying.value = false
    setupState.value = 'loading'
    const quoteMode = config.mode === ConfigModes.Quote

    let quote: Quote | null = null
    if (quoteMode) {
      try {
        quote = await loadRandomQuote({
          // A size variant is not a language: `russian_50k` is Russian with a
          // longer word list, and the quote registry publishes Russian quotes
          // once, under `russian`. See `quoteCorpusLang`.
          lang: quoteCorpusLang(config.language),
          // `all` is the absence of a filter, not a sixth band: the parameter
          // is omitted rather than sent as a value the server rejects (400).
          group: config.quoteGroup === 'all' ? undefined : config.quoteGroup
        })
      } catch (error) {
        console.error('quote draw failed', error)
        // 404 is the registry saying this filter matches nothing — a real state
        // the player can act on (pick another length or language), not a fault.
        setupState.value = isApiError(error) && error.status === 404 ? 'quote-empty' : 'quote-error'
        return
      }
    }
    activeQuote.value = quote

    let body: DictionaryBody | null = null
    try {
      body = await loadDictionaryBody(config.language)
    } catch (error) {
      console.error('dictionary load failed', error)
      if (!quoteMode) {
        setupState.value = 'dictionary-error'
        return
      }
    }
    const dictionary: Dictionary = {
      name: body?.name ?? config.language,
      bcp47: body?.bcp47 ?? config.language,
      words: body?.words ?? []
    }
    isRightToLeft.value = body?.rightToleft === true

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
      quickEnd: config.quickEnd,
      // The text is already resolved — the core never fetches. On submission it
      // is stripped back to {quoteId, quoteHash}; the server re-resolves it.
      textSource: quote
        ? { kind: 'quote', quoteId: quote.id, quoteHash: quote.textHash, text: quote.text }
        : undefined
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
      config.quoteGroup,
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
  // Layout lives in `TestStage`; the page only sizes its bands, and the sizes are
  // fixed on purpose. The band above holds either the whole settings bar (mods,
  // modes, amount, the chips, the language) or the score HUD; the field row is
  // exactly the field's viewport, so the words land where the loading notice
  // stood; the band below holds the restart button. Nothing here reacts to its
  // content — that is what stops the words moving.
  .home {
    --tm-stage-above: 8rem;
    --tm-stage-field: 10rem;
    --tm-stage-below: 3rem;
  }

  // The bar wraps before the field does; give it the room rather than letting it
  // climb out of its band.
  @media screen and (width <= 900px) {
    .home {
      --tm-stage-above: 11rem;
    }
  }

  .home__notice {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    align-items: center;
    justify-content: center;
    height: 100%;
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
