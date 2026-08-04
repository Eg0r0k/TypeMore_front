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
    <!-- Racing a record: the RENDERLESS race engine. Everything visible goes
         through the standard solo surfaces — the record's settings in the
         locked bar, the red "repeated" mark, the pace selector reading
         "ghost", the caret inside the field, the defeat line on results. -->
    <RaceHost v-if="race.racing && race.requestedRunId" :run-id="race.requestedRunId" />

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
      :can-report-quote="auth.isAuth && activeQuote != null"
      :history="game.wordHistory"
      :bot-defeat="botDefeat"
      :repeated="repeatedRun"
      :actions="resultActions"
      @retry="runSubmission.retry"
      @signin="onSignIn"
      @replay="onReplay"
      @next="onNext"
      @restart="onRepeat"
      @race-again="onRestart"
      @report-quote="quoteReportOpen = true"
    />

    <TestStage v-else>
      <!-- Settings, then the language, then the words: the language is the last
           thing above the field because it is the one that names what is in it. -->
      <template #above>
        <SettingsBar v-show="!isRunning" :repeated="repeatedRun" />
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
        <div v-if="setupState !== 'ready' && !race.racing" key="setup" class="home__notice">
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
          :ghosts="fieldGhosts"
          :fading="config.fading"
          :flashlight="config.flashlight"
          :caret-style="config.caretStyle"
          :smooth-caret="config.smoothCaret"
          :font-size="config.fontSize"
          :font-family="config.fontFamily"
          :canary-seed="fieldCanarySeed"
        />
      </Transition>

      <template #below>
        <Button
          color="shadow"
          size="icon"
          :aria-label="t('game.restart')"
          data-testid="restart-test"
          @click="onRestart"
        >
          <IconRestart class="size-6" />
        </Button>
      </template>
    </TestStage>

    <!-- The report dialog over the quote just typed. Mounted only while a
         quote is active: the flag that opens it requires one.

         It lives AFTER the whole ReplayPlayer / TestResults / TestStage chain
         and must stay there: v-else binds to the NEXT SIBLING, so a node
         placed between the branches silently detaches the chain and the stage
         renders alongside the results instead of replacing them. -->
    <ReportModal
      v-if="activeQuote"
      v-model:open="quoteReportOpen"
      :subject="{ type: 'quote', id: activeQuote.id }"
      :subject-label="activeQuote.source ?? undefined"
    />
  </main>
</template>

<script lang="ts" setup>
  import { computed, onMounted, onUnmounted, ref, watch, watchEffect } from 'vue'
  import { useEventListener } from '@vueuse/core'
  import { useI18n } from 'vue-i18n'

  import { toast } from '@/shared/ui/sonner'

  import { Test, type TestGhostCaret } from '@/widgets/test'
  import { TestStage } from '@/features/layouts/test-stage'
  import { SettingsBar } from '@/features/test/settings-bar'
  import { ScoreHud } from '@/features/test/score-hud'
  import { TestProgress } from '@/features/test/progress'
  import {
    type ResultsAction,
    type ResultSummary,
    TestResults,
    summaryAmountOf
  } from '@/features/test/results'
  import { usePaceCaret } from '@/features/test/pace'
  import { ReplayPlayer } from '@/features/test/replay'
  import { ReportModal } from '@/features/modal/report'
  import {
    type GameSetup,
    type ReplayData,
    toCoreSetup,
    toGameSession,
    useGameStore
  } from '@entities/game'
  import { useRaceStore } from '@entities/race'
  import { useScreenStore } from '@/entities/screen'
  import { useAuthStore } from '@/entities/auth'
  import { RaceHost } from '@/features/test/race'
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
  } from '@typemore/core'
  import { useRouter } from 'vue-router'
  import {
    adoptedFromOf,
    bumpRestarts,
    isUnnameableRepeat,
    type RunSubmitContext,
    type TextOrigin,
    useRunSubmission
  } from '@/features/run-submit'
  import { Button } from '@shared/ui/button'
  import { Typography } from '@shared/ui/typography'
  import IconRestart from '~icons/tabler/refresh'

  /**
   * The game lives on `/`. This page owns the session lifecycle so the field can be
   * swapped for the results screen and back without losing it: it generates words
   * from the config, rebuilds on any core-bound setting change, drives the timer,
   * and restarts on Ctrl+Enter. The field (`Test`) and `TestResults` are pure views.
   */
  const { t } = useI18n()
  const game = useGameStore('local')
  const race = useRaceStore()
  const auth = useAuthStore()
  /** The quote-report dialog; opened by the flag on the results screen. */
  const quoteReportOpen = ref(false)
  const config = useConfigStore().config
  // The field reads only the GameView contract; `blind` flows in from app config
  // here — the widget layer never touches the config store.
  const localSession = toGameSession(game, () => config.blind)

  const isRightToLeft = ref(false)
  const isRunning = computed(() => game.phase === 'running')
  const isFinished = computed(() => game.phase === 'finished')

  /**
   * The pace caret bot — active whenever a pace mode is configured and no
   * record race owns the ghost channel.
   */
  const pace = usePaceCaret({ game, suspended: () => race.racing })

  /**
   * The field's ghost carets: the record ghost while racing (labelled with the
   * record owner's nick), the pace bot otherwise (nameless by design — a pace
   * bot is nobody, not even the player). An empty list keeps the plain solo
   * path untouched.
   */
  const fieldGhosts = computed<TestGhostCaret[]>(() => {
    if (race.racing) {
      const caret = race.ghostCaret
      if (caret === null) return []
      return [
        {
          id: 'race-ghost',
          label: caret.label,
          wordIndex: caret.wordIndex,
          charIndex: caret.charIndex
        }
      ]
    }
    const bot = pace.caret.value
    if (bot === null) return []
    // `glideMs` is what separates the pace bot from a relayed opponent: its next
    // character is due at a known instant, so the caret travels the whole way
    // there instead of jumping a cell and waiting.
    return [
      {
        id: 'pace-caret',
        label: '',
        wordIndex: bot.wordIndex,
        charIndex: bot.charIndex,
        glideMs: bot.glideMs
      }
    ]
  })

  /**
   * The results screen's "lost to the bot" line: the race ghost's verdict while
   * racing (the host computes it from the drained log), the pace comparison
   * otherwise. Only ever a LOSS — a win renders nothing.
   */
  const botDefeat = computed<{ you: number; them: number } | null>(() => {
    if (race.racing) return race.defeat
    if (game.phase !== 'finished') return null
    const target = pace.targetWpm.value
    if (target === null) return null
    const you = Math.round(game.metrics.wpm)
    const them = Math.round(target)
    return you < them ? { you, them } : null
  })

  /**
   * In a race the "next test" slot becomes "race again" — same ghost, fresh
   * seats — and `restart` is absent: re-racing IS the same-text repeat. Solo
   * offers both: `next` regenerates, `restart` replays the very same seed.
   */
  const resultActions = computed<readonly ResultsAction[]>(() =>
    race.racing
      ? (['race-again', 'replay', 'screenshot'] as const)
      : (['next', 'restart', 'replay', 'screenshot'] as const)
  )

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

  /**
   * The last language whose body actually loaded — the fallback a FAILED
   * language switch reverts to (DICTFIX_LOG.md, B-DICT-3). Its body sits in the
   * query cache with `staleTime: Infinity`, so the revert rebuilds the field
   * without the network — switching languages on a dead connection must not
   * cost the player the dictionary they were just typing on.
   */
  const lastLoadedLanguage = ref<string | null>(null)

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
    amount: summaryAmountOf({
      mode: config.mode,
      isQuote: activeQuote.value !== null,
      seconds: config.time,
      wordTarget: config.words,
      quoteWords: game.words.length
    }),
    punctuation: config.punctuation,
    numbers: config.numbers,
    randomCase: config.randomCase,
    reverse: config.reverse,
    lazy: config.lazy,
    nospace: config.nospace
  }))

  // Generation-time metadata neither the store nor the log retains (seed,
  // dictHash, lang). Captured here so the run-submit feature can assemble the
  // exact RUNS.md payload at finish; the two mod halves come from the run's own
  // snapshot (`getReplayData`), so payload and replay can never disagree.
  const runMeta = ref<{ seed: number; dictHash: string; lang: string } | null>(null)

  /**
   * The seed the field's display canaries are scheduled from — the SAME seed
   * the submit payload carries, so the server can recompute the schedule. It
   * covers quote runs too: a quote's words ignore the seed, but the canary
   * stream is independent of generation and the seed still travels in the
   * submission. `null` while racing: the race host set the session up from the
   * record's setup and `runMeta` still describes the PREVIOUS solo run — a
   * stale schedule would be worse than none (and the record's text is already
   * public to the racer via the results screen anyway). A repeat (`onRepeat`)
   * keeps the original seed with the original words, which is exactly right.
   */
  const fieldCanarySeed = computed<number | null>(() =>
    race.racing ? null : (runMeta.value?.seed ?? null)
  )

  // The last solo setup (config + words + generation), kept so the results
  // screen's "restart" can replay the very same text. Declaration is NOT kept:
  // the view-only mods are re-read at repeat time, like on any other rebuild.
  const lastSetup = ref<Omit<GameSetup, 'declaration'> | null>(null)

  // The current run replays the very same text again, straight off the results
  // screen where the player just read it in full.
  const repeatedRun = ref(false)

  /**
   * Where this run's text came from. The judgement over it lives in the
   * run-submit feature (`text-origin.ts`) rather than in this computed, so the
   * rule has ONE home and its test cannot restate it.
   */
  const textOrigin = computed<TextOrigin>(() => ({
    racedRunId: race.racing ? race.requestedRunId : null,
    repeated: repeatedRun.value,
    fixedText: activeQuote.value !== null
  }))

  // Finished normally — not failed (expert/master/minSpeed) and not aborted.
  //
  // Note what is NO LONGER here: `!race.racing`. A race run IS submitted now,
  // carrying `adoptedFromRunId`; the server saves it, shows it in history and
  // ranks it nowhere (RUNS.md, "Text provenance"). Blocking the POST was the
  // same verdict with the run thrown away, and it gated on the wrong thing — the
  // rule is about where the TEXT came from, not about whether a second caret was
  // on screen.
  const finishedOk = computed(
    () =>
      game.phase === 'finished' &&
      game.snapshot.failReason === null &&
      !isUnnameableRepeat(textOrigin.value)
  )

  function buildRunContext(): RunSubmitContext | null {
    const meta = runMeta.value
    const replay = game.getReplayData()
    const score = game.scoreResult
    if (!meta || !replay || !score) return null
    const adopted = adoptedFromOf(textOrigin.value)
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
      log: replay.log,
      logVersion: game.logVersion,
      ...(adopted !== undefined ? { adoptedFromRunId: adopted } : {})
    }
  }

  const router = useRouter()
  const runSubmission = useRunSubmission({ finished: finishedOk, buildContext: buildRunContext })
  const saveState = runSubmission.state

  /**
   * Abandoned-run accounting (RUNS.md `restartsSinceLastSubmit`): a SOLO run
   * that took its first keystroke and will never reach POST /runs is counted
   * locally and reported with the next submission.
   *
   * `soloSession` marks that the 'local' store currently holds home's OWN run —
   * it goes false the moment a race arms (the ghost's run must never be
   * charged, including the rebuild that fires when the race exits and the
   * settings snapshot is restored) and comes back with the next solo setup.
   */
  const soloSession = ref(false)
  watch(
    () => race.racing,
    (racing) => {
      if (!racing) return
      soloSession.value = false
      // The armed race replaces whatever solo run was up — including a repeat.
      // The race draws its own "repeated" mark; this flag must not leak into it
      // (a QUOTE race deliberately shows none).
      repeatedRun.value = false
    }
  )

  /**
   * Count the live solo run as abandoned, at most once: every abandonment path
   * funnels here — a rebuild over a running run (restart button, Esc, any
   * core-bound settings change), leaving the page mid-run (unmount), and the
   * page dying mid-run (`pagehide`: reload/close — localStorage is written
   * synchronously, the one chance that path gives).
   */
  const abandonIfRunning = (): void => {
    if (!soloSession.value || game.phase !== 'running') return
    soloSession.value = false
    bumpRestarts()
  }

  // A run that FINISHED but failed its own rules (expert/master, minWpm) also
  // never submits: started, no row — same accounting as an abandon.
  watch(
    () => game.phase,
    (phase) => {
      if (phase !== 'finished' || !soloSession.value) return
      if (game.snapshot.failReason !== null) {
        soloSession.value = false
        bumpRestarts()
      }
    }
  )

  useEventListener(window, 'pagehide', abandonIfRunning)
  onUnmounted(abandonIfRunning)

  /**
   * Tell the SHELL a run is under way. It is what fades the header chrome and
   * the footer out and hides the pointer — none of which this page owns, and
   * none of which can read a page's game store from outside the router view.
   * Cleared on unmount so leaving mid-run does not strand the app with its
   * chrome invisible.
   */
  const screen = useScreenStore()
  watchEffect(() => screen.setTyping(isRunning.value))
  onUnmounted(() => screen.setTyping(false))

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
    // While racing, the race host owns the game setup (exact words, exact
    // seed, 'go' clock). The config writes a race makes on entry would
    // otherwise trigger this rebuild and replace the record's text with a
    // fresh generation.
    if (race.racing) return
    // Rebuilding over a still-running run IS the abandonment (restart, Esc,
    // a settings change) — record it before the session is replaced.
    abandonIfRunning()
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
      lastLoadedLanguage.value = config.language
    } catch (error) {
      console.error('dictionary load failed', error)
      if (!quoteMode) {
        // A failed SWITCH is not a dead field: the previous language's body is
        // still in the immutable query cache, so revert the config (the watcher
        // re-runs this setup from cache) and say what happened. Only a load
        // with nothing to fall back to becomes the blocking error state.
        const fallback = lastLoadedLanguage.value
        if (fallback !== null && fallback !== config.language) {
          toast.error(
            t('game.setup.dictionarySwitchFailed', { lang: config.language, kept: fallback })
          )
          config.language = fallback
          return
        }
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
      lazy: config.lazy,
      // The canonical key, NOT `dictionary.name` — that is the human catalogue
      // label ('CSS (code)'), and the accent pack is keyed by 'german_1k'.
      language: config.language,
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
      // The CANONICAL dictionary key ('russian', 'code_css') — the identifier
      // that names the word list in configs, bucket keys and the catalogue.
      // NOT `dictionary.bcp47`: that is display chrome ('ru-RU'), and a run
      // submitted under it mints a bucket the language rail cannot name.
      lang: config.language
    }
    lastSetup.value = {
      config: coreConfig,
      words: generated.value.words,
      generation
    }
    repeatedRun.value = false
    game.setup({ ...lastSetup.value, declaration: declarationOf() })
    setupState.value = 'ready'
    soloSession.value = true
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
      config.lazy,
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

  /** Restart: in a race this re-races the SAME ghost from 3-2-1; solo, fresh words. */
  function onRestart(): void {
    if (race.racing) {
      race.requestRestart()
      return
    }
    void loadAndSetup()
  }

  /** The results screen's "next": same routing as the restart control. */
  function onNext(): void {
    onRestart()
  }

  /**
   * The results screen's "restart": the SAME text again — no draw, no
   * generation, just a fresh run over the retained setup. The player has read
   * the full text on the results screen, so the run is marked repeated and is
   * never submitted (same standing as a race); it is not charged to the
   * abandoned-run count either, exactly like a race run.
   */
  function onRepeat(): void {
    const setup = lastSetup.value
    if (race.racing || setup === null) return
    replaying.value = false
    repeatedRun.value = true
    soloSession.value = false
    game.setup({ ...setup, declaration: declarationOf() })
  }

  // Ctrl+Enter — the combo the footer advertises — exits the replay if open,
  // otherwise restarts (same routing as the restart button: a race re-races
  // its ghost, solo regenerates). Esc only closes the replay overlay: it no
  // longer restarts, and an unhandled Esc is left alone so dialogs above the
  // page (pace, language) keep their own Esc-to-close.
  useEventListener(window, 'keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      if (!replaying.value) return
      event.preventDefault()
      replaying.value = false
      return
    }
    if (!(event.ctrlKey && event.key === 'Enter')) return
    event.preventDefault()
    if (replaying.value) {
      replaying.value = false
      return
    }
    onRestart()
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
