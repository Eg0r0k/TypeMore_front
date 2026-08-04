<template>
  <div class="empty"></div>
  <div ref="rootRef" class="results mx-auto flex w-full flex-col gap-3">
    <!--
      The verdict beside the shape of the run: the grade is what a glance is for,
      the score is the number that is compared, and the chart is the story.

      From `md` the verdict is a column whose width (`--results-verdict`) is
      shared with the stats grid below, so the first stat lines up UNDER the
      grade instead of merely starting near it. Below `md` there is no room for
      two columns: the verdict lays itself out as a row over the chart, and the
      two grids stop sharing an edge because there is no edge left to share.
    -->
    <div
      class="grid items-center gap-4 md:grid-cols-[var(--results-verdict)_minmax(0,1fr)] md:gap-0"
    >
      <div
        class="flex min-w-0 flex-row flex-wrap items-baseline justify-center gap-x-8 gap-y-2 md:flex-col md:items-stretch md:justify-start md:gap-2"
      >
        <!-- What the run was played under, before a single key: the mods as
             the shared icon chips (tooltips carry the words) — the same glyphs
             the settings bar, the boards and the profile use. Renders nothing
             when the run was plain. -->
        <GameModIcons :mods="summaryMods" class="basis-full justify-center md:basis-auto" />

        <!-- Grade and combo are one mark, not two facts: the combo hangs off the
             grade's baseline rather than starting a line of its own. -->
        <div class="flex flex-col items-center">
          <span
            class="relative text-7xl leading-none font-bold sm:text-8xl md:text-9xl"
            :class="isTopGrade ? 'text-main' : 'text-text'"
          >
            {{ grade }}
            <span
              v-if="comboLabel"
              class="absolute -top-1 -right-5 text-xl font-black tabular-nums text-primary md:-top-2 md:-right-6 md:text-2xl"
            >
              {{ comboLabel }}
            </span>
          </span>
        </div>

        <Tooltip v-if="score">
          <TooltipTrigger as-child>
            <!-- A score has no bound worth designing around, so it is the one
                 number given room to break rather than to push the chart off
                 the row. -->
            <div
              class="flex min-w-0 cursor-help flex-col gap-0.5 [overflow-wrap:anywhere]"
              data-testid="results-score"
            >
              <span class="text-xs text-sub">score</span>
              <span class="text-main text-3xl font-bold leading-tight tabular-nums sm:text-4xl">
                {{ scoreText }}
              </span>
              <span v-if="modLabel" class="text-xs tabular-nums text-sub">{{ modLabel }}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" class="w-56">
            <dl class="flex flex-col gap-0.5 text-xs tabular-nums">
              <div v-for="row in scoreFormula" :key="row.label" class="flex justify-between gap-4">
                <dt class="text-sub">{{ row.label }}</dt>
                <dd>{{ row.value }}</dd>
              </div>
            </dl>
          </TooltipContent>
        </Tooltip>
      </div>

      <div class="min-w-0">
        <WpmChart :timeline="timeline" />
      </div>
    </div>

    <!--
      One row of everything else, its first cell under the grade. Only `wpm` is
      accented: it is the number the reader came for, and a screen where six
      things shout has nothing left to emphasise with.

      Two columns on a phone, three from `sm`, and one row of auto-fitted cells
      from `lg` — six 24px numbers do not fit across 360px, and squeezing them
      there is how a stats row turns into a wall of clipped digits. `lg` and not
      `md` because of ONE cell: `chars` is four numbers where its neighbours have
      one, and it is what overflows first when the row is packed.
    -->
    <dl
      class="m-0 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-[var(--results-verdict)_repeat(auto-fit,minmax(6rem,1fr))] lg:gap-x-7"
    >
      <div class="flex min-w-0 flex-col gap-0.5">
        <dt class="text-xs text-sub">test type</dt>
        <dd class="m-0 flex flex-col text-sm text-sub">
          <span v-for="line in testType" :key="line">{{ line }}</span>
        </dd>
      </div>
      <div class="flex min-w-0 flex-col gap-0.5">
        <dt class="text-xs text-sub">wpm / raw</dt>
        <dd class="m-0 text-xl/tight tabular-nums sm:text-2xl/tight">
          <span class="text-main font-black">{{ Math.round(metrics.wpm) }}</span>
          <span class="text-sub">/{{ Math.round(metrics.raw) }}</span>
        </dd>
      </div>
      <div class="flex min-w-0 flex-col gap-0.5">
        <dt class="text-xs text-sub">acc</dt>
        <dd class="m-0 text-xl/tight tabular-nums sm:text-2xl/tight">
          {{ Math.round(metrics.accuracy * 100) }}%
        </dd>
      </div>
      <div class="flex min-w-0 flex-col gap-0.5">
        <dt class="text-xs text-sub">chars</dt>
        <!-- correct / incorrect / extra / missed. The three failure counts are
             sub-coloured rather than red: this is a summary read after the fact,
             not an alarm going off. Smaller than its neighbours on purpose — it
             is four numbers in the space they each use for one. -->
        <dd class="m-0 text-lg/tight tabular-nums sm:text-xl/tight xl:text-2xl/tight">
          {{ metrics.chars.correct }}/{{ metrics.chars.incorrect }}/{{ metrics.chars.extra }}/{{
            metrics.chars.missed
          }}
        </dd>
      </div>
      <div class="flex min-w-0 flex-col gap-0.5">
        <dt class="text-xs text-sub">consistency</dt>
        <dd class="m-0 text-xl/tight tabular-nums sm:text-2xl/tight">
          {{ Math.round(metrics.consistency * 100) }}%
        </dd>
      </div>
      <div class="flex min-w-0 flex-col gap-0.5">
        <dt class="text-xs text-sub">time</dt>
        <dd class="m-0 flex flex-col text-xl/tight tabular-nums sm:text-2xl/tight">
          <span>{{ Math.round(metrics.durationSec) }}s</span>
          <!-- Idle time belongs to the duration it ate from: seconds and the
               share of the run window, one quiet line under the number. -->
          <span v-if="afkLabel" class="text-sm text-sub" data-testid="results-afk">
            {{ afkLabel }}
          </span>
        </dd>
      </div>

      <!-- Quote runs only: who wrote it, and the one way into its board. -->
      <div
        v-if="quoteSource"
        class="col-span-full flex min-w-0 flex-col gap-0.5 sm:col-span-2 lg:col-span-1"
        data-testid="results-quote-source"
      >
        <dt class="text-xs text-sub">source</dt>
        <dd class="m-0 flex items-center gap-2 text-sm">
          <span class="min-w-0 truncate">{{ quoteSource }}</span>
          <Tooltip v-if="quoteBoard">
            <TooltipTrigger as-child>
              <!-- The name is a real (visually hidden) child rather than an
                   `aria-label`: this is a component, and the rule that would
                   check the attribute cannot see what it renders. -->
              <Link
                :to="quoteBoard"
                class="text-sub hover:text-text transition-tm focus-ring inline-flex shrink-0 items-center rounded-md p-1 [&_svg]:size-4"
                data-testid="quote-board-link"
              >
                <IconBoard />
                <span class="sr-only">{{ t('results.quoteBoard') }}</span>
              </Link>
            </TooltipTrigger>
            <TooltipContent>{{ t('results.quoteBoard') }}</TooltipContent>
          </Tooltip>
          <!-- Reporting stays an EVENT: this view owns no modal and no session
               knowledge — the surface decides whether reporting is possible. -->
          <Tooltip v-if="canReportQuote">
            <TooltipTrigger as-child>
              <button
                type="button"
                class="text-sub hover:text-text transition-tm focus-ring inline-flex shrink-0 cursor-pointer items-center rounded-md p-1 [&_svg]:size-4"
                data-testid="results-report-quote"
                @click="emit('reportQuote')"
              >
                <IconFlag />
                <span class="sr-only">{{ t('report.title.quote') }}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>{{ t('report.title.quote') }}</TooltipContent>
          </Tooltip>
        </dd>
      </div>
    </dl>

    <!-- Anything unusual about the run, and nothing else. The bot line only
         ever reports a LOSS — a win over the pace bot or the record ghost says
         nothing here. -->
    <div v-if="failReason || botDefeat" class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-sub">
      <span v-if="failReason">{{ reason }}</span>
      <span v-if="botDefeat" class="text-error" data-testid="results-bot-loss">
        {{ t('results.botLoss', { you: botDefeat.you, them: botDefeat.them }) }}
      </span>
    </div>

    <!--
      Icon-only actions. Each carries its label twice: `aria-label` for a screen
      reader, a tooltip for a pointer — an icon alone names nothing.
    -->
    <div v-if="actions.length || hasHistory" class="flex w-full justify-center gap-5 items-center">
      <Tooltip v-for="action in actions" :key="action.key">
        <TooltipTrigger as-child>
          <Button
            color="shadow"
            size="icon"
            :aria-label="action.label"
            :disabled="action.disabled"
            :data-testid="action.testId"
            @click="action.run"
          >
            <component :is="action.icon" class="size-6" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ action.label }}</TooltipContent>
      </Tooltip>

      <Tooltip v-if="hasHistory">
        <TooltipTrigger as-child>
          <Button
            color="shadow"
            size="icon"
            :aria-label="t('results.history.toggle')"
            :class="{ 'text-main': showHistory }"
            data-testid="results-history"
            @click="toggleHistory"
          >
            <IconHistory class="size-6" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ t('results.history.toggle') }}</TooltipContent>
      </Tooltip>
    </div>

    <!-- Grid-rows collapse (see tailwind.css): the block stays mounted, so the
         expand animates without height measurement; `inert` pulls the hidden
         content out of the tab order. -->
    <div
      v-if="hasHistory"
      class="grid-collapse w-full"
      :class="{ 'grid-collapse-open': showHistory }"
    >
      <div class="grid-collapse-content" :inert="!showHistory">
        <!-- Mounted on FIRST expand, never before: a long run is hundreds of
             word components, and most results screens never open the block.
             It stays mounted after, so the close animation has content. -->
        <InputHistory v-if="historyEverOpened" :history="history ?? []" />
      </div>
    </div>

    <div
      v-if="saveState !== 'idle' && saveState !== 'ineligible'"
      class="mt-2 flex min-h-6 items-center justify-center"
      data-testid="results-save"
    >
      <button
        v-if="saveState === 'guest'"
        type="button"
        class="text-sub hover:text-text focus-ring transition-tm cursor-pointer text-sm underline underline-offset-2"
        data-testid="save-signin"
        @click="$emit('signin')"
      >
        {{ t('results.signIn') }}
      </button>
      <span v-else-if="saveState === 'saving'" class="text-sm text-sub" data-testid="save-saving">
        {{ t('results.saving') }}
      </span>
      <span v-else-if="saveState === 'saved'" class="text-main text-sm" data-testid="save-saved">
        {{ t('results.savedPending') }}
      </span>
      <span
        v-else-if="saveState === 'restricted'"
        class="text-sm text-sub"
        data-testid="save-restricted"
      >
        {{ t('results.notCountedRestricted') }}
      </span>
      <span
        v-else-if="saveState === 'error'"
        class="inline-flex items-center gap-3 text-sm text-sub"
        data-testid="save-error"
      >
        {{ t('results.saveFailed') }}
        <Button color="gray" size="s" data-testid="save-retry" @click="$emit('retry')">
          {{ t('results.retry') }}
        </Button>
      </span>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { computed, ref } from 'vue'
  import { useI18n } from 'vue-i18n'

  import {
    type ActiveMod,
    type FailReason,
    type Metrics,
    type ScoreResult,
    type TimelinePoint,
    type WordHistoryEntry,
    gradeOf
  } from '@typemore/core'
  import WpmChart from './wpm-chart.vue'
  import InputHistory from './input-history.vue'
  import IconHistory from '~icons/tabler/history'
  import IconPlayerPlay from '~icons/tabler/player-track-prev-filled'
  import IconNext from '~icons/tabler/player-play-filled'
  import IconRepeat from '~icons/tabler/repeat'
  import IconRestart from '~icons/tabler/refresh'
  import IconCamera from '~icons/tabler/camera-filled'
  import IconSwords from '~icons/tabler/swords'
  import IconUsers from '~icons/tabler/users'
  import IconDoorExit from '~icons/tabler/door-exit'
  import IconBoard from '~icons/tabler/trophy'
  import IconFlag from '~icons/tabler/flag'
  import { quoteBucketKey } from '@shared/api'
  import { GameModIcons, type GameModsLike } from '@/entities/game'
  import { routeLocation } from '@/app/router/route-locations'
  import { Button } from '@/shared/ui/button'
  import { Link } from '@/shared/ui/link'
  import { toast } from '@/shared/ui/sonner'
  import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'
  import { groupThousands } from '@/shared/lib/helpers/numbers'
  import { useScreenshot } from '@/shared/lib/hooks/useScreenshot'

  /**
   * Pure results view. Every input is a pure function of the log (metrics, the wpm
   * timeline, the error-word list) computed in the store — this component holds no
   * state. Shows wpm/raw/accuracy/consistency, the character breakdown
   * (correct/incorrect/extra/missed), a wpm-over-time chart, the completion reason
   * (time / words / difficulty fail), the test config, and the mistyped words.
   *
   * ONE side effect, and it is over this component's own DOM: "copy screenshot"
   * rasterises the element below and puts it on the clipboard. Everything else
   * leaves as an event for the page to act on.
   */
  export interface ResultSummary {
    mode: string
    language: string
    difficulty: string
    amount: number
    punctuation: boolean
    numbers: boolean
    randomCase: boolean
    /**
     * Both are TEXT mods like the three above and were simply missing here,
     * so a run played reversed — or without diacritics — reported neither on
     * the result screen. Optional so a caller that predates them still
     * compiles; every caller in this repo passes them.
     */
    reverse?: boolean
    lazy?: boolean
    nospace: boolean
  }

  /**
   * Result-screen save state. Mirrors the run-submit feature's `SubmitState`; kept
   * local so this pure view carries no feature→feature import. `saved` means the
   * run is PENDING server validation — never a rank or leaderboard placement.
   */
  export type ResultsSaveState =
    'idle' | 'ineligible' | 'guest' | 'saving' | 'saved' | 'restricted' | 'error'

  /**
   * The icon-only actions, in the order they render. Not every surface can offer
   * all of them: a MATCH result has no next test to load and no replay screen to
   * open, so it asks for the screenshot alone rather than showing buttons that
   * lead nowhere. `race-again` replaces `next` while a record race is live —
   * the "one more" that re-seats the SAME ghost. `restart` is the solo repeat:
   * the same seed played again (the surface decides what that implies — on the
   * home page a repeated text never submits).
   */
  export type ResultsAction =
    | 'next'
    | 'restart'
    | 'race-again'
    | 'replay'
    | 're-ready'
    | 'lobby'
    | 'screenshot'
    | 'leave'

  const props = withDefaults(
    defineProps<{
      metrics: Metrics
      timeline: readonly TimelinePoint[]
      failReason: FailReason | null
      summary: ResultSummary
      /** Finalized score (v2); `null` hides the score block. */
      score: ScoreResult | null
      /** Active mods for the breakdown (empty when none). */
      activeMods: readonly ActiveMod[]
      /** Run-submit state; drives the subtle save hint. Defaults to `idle` (hidden). */
      saveState?: ResultsSaveState
      /** Idle time inside the run window (`afkOf`, shared/core); `0` hides the line. */
      afkMs?: number
      /**
       * The quote this run was played on, when it was a quote run. Present ⇒ a
       * link to that quote's board, which is the ONLY place that board is
       * offered: there is one per quote, so it is not in the picker (they run
       * to thousands) and this is where it is worth reaching — the reader just
       * typed the text it ranks.
       */
      quoteId?: string | null
      /** Upstream's attribution for that quote, shown under the run's summary. */
      quoteSource?: string | null
      /**
       * Offer the "report this quote" flag beside the source line. The SURFACE
       * decides (a session is required to file, and only a quote run has a
       * quote); this pure view just renders the button and emits.
       */
      canReportQuote?: boolean
      /**
       * The player finished SLOWER than the active bot (pace caret or record
       * ghost): `{ you, them }` in wpm. Null (a win, or no bot) renders nothing.
       */
      botDefeat?: { you: number; them: number } | null
      /**
       * The run replayed an already-seen text (the results screen's own
       * "restart"). Adds a `repeated` line to the test-type cell — sub-coloured
       * like the rest of the summary, not red: the warning already burned on
       * the settings bar while the run was typed; here it is a fact on record.
       */
      repeated?: boolean
      /** Which of the icon actions to offer. Defaults to next/replay/screenshot (the solo run). */
      actions?: readonly ResultsAction[]
      /**
       * Actions to render but refuse. A rematch with a dropped connection is
       * the case: hiding the button would read as "there is no rematch", and
       * the tooltip still says what it is.
       */
      disabledActions?: readonly ResultsAction[]
      /**
       * Per-word history of the run (`wordHistory`, shared/core). Present ⇒ an
       * extra toggle in the actions row expands the input-history block: the
       * words as typed, hover burst speeds, the heatmap, and the copy actions.
       */
      history?: readonly WordHistoryEntry[] | null
    }>(),
    {
      saveState: 'idle',
      afkMs: 0,
      quoteId: null,
      quoteSource: null,
      canReportQuote: false,
      history: null,
      botDefeat: null,
      repeated: false,
      // Inline rather than a shared const: `withDefaults` is hoisted out of
      // setup(), so it cannot reference anything declared in this block.
      actions: () => ['next', 'replay', 'screenshot'] as const,
      disabledActions: () => [] as const
    }
  )

  const emit = defineEmits<{
    (event: 'replay'): void
    (event: 'retry'): void
    (event: 'signin'): void
    (event: 'next'): void
    (event: 'restart'): void
    (event: 'raceAgain'): void
    /** Room only: ready up for another match in the same room. */
    (event: 'reReady'): void
    /** Room only: back to the lobby, keeping the seat. */
    (event: 'lobby'): void
    /** Room only: give the seat up. */
    (event: 'leave'): void
    /** The quote-source flag: the surface hosts the report dialog. */
    (event: 'reportQuote'): void
  }>()

  const { t } = useI18n()

  const rootRef = ref<HTMLElement | null>(null)
  const { copy: copyScreenshot } = useScreenshot(rootRef)

  // Input-history expansion is view state of THIS screen, not a surface concern.
  const showHistory = ref(false)
  // Latches on the first expand — the mount gate for the word list.
  const historyEverOpened = ref(false)
  const hasHistory = computed(() => (props.history?.length ?? 0) > 0)

  const toggleHistory = (): void => {
    showHistory.value = !showHistory.value
    if (showHistory.value) historyEverOpened.value = true
  }

  /**
   * Copying an image can fail for reasons that are not this app's doing (an
   * insecure context, a browser that refuses image writes), so the outcome is
   * always reported — a button that silently does nothing reads as broken.
   */
  const onScreenshot = async (): Promise<void> => {
    const ok = await copyScreenshot()
    // Sonner — the app's ONE toast system. The old alert store this used to
    // call had no renderer mounted anywhere, so its "always reported" was a
    // report into the void; the store and its widget are gone.
    if (ok) toast.success(t('results.screenshotCopied'))
    else toast.error(t('results.screenshotFailed'))
  }

  // Filtering the catalogue, rather than mapping the prop, keeps the buttons in
  // the same places whatever order a caller happens to list them in.
  const actions = computed(() => {
    const catalogue = [
      {
        key: 'next' as const,
        icon: IconNext,
        label: t('results.nextTest'),
        run: () => emit('next')
      },
      {
        key: 'restart' as const,
        icon: IconRepeat,
        label: t('results.repeatTest'),
        run: () => emit('restart')
      },
      {
        key: 'race-again' as const,
        icon: IconRestart,
        label: t('race.again'),
        run: () => emit('raceAgain')
      },
      {
        key: 'replay' as const,
        icon: IconPlayerPlay,
        label: t('results.watchReplay'),
        run: () => emit('replay')
      },
      /*
       * The room's three. They used to be a row of worded buttons under the
       * standings table, which put the thing you do next at the bottom of a
       * long scroll; as icons they sit with the other post-run actions, where
       * the eye already is. The tooltip carries the words the button lost.
       */
      {
        key: 're-ready' as const,
        icon: IconSwords,
        label: t('room.results.reReady'),
        testId: 're-ready-button',
        run: () => emit('reReady')
      },
      {
        key: 'lobby' as const,
        icon: IconUsers,
        label: t('room.results.backToLobby'),
        testId: 'back-to-lobby-button',
        run: () => emit('lobby')
      },
      {
        key: 'screenshot' as const,
        icon: IconCamera,
        label: t('results.copyScreenshot'),
        run: onScreenshot
      },
      // Last, always: it is the one that ends the evening.
      {
        key: 'leave' as const,
        icon: IconDoorExit,
        label: t('room.leave'),
        testId: 'leave-button',
        run: () => emit('leave')
      }
    ]
    return catalogue
      .filter((action) => props.actions.includes(action.key))
      .map((action) => ({
        ...action,
        testId: 'testId' in action ? action.testId : `results-${action.key}`,
        disabled: props.disabledActions.includes(action.key)
      }))
  })

  const reason = computed(() => {
    if (props.failReason) return `failed · ${props.failReason}`
    return props.summary.mode === 'time'
      ? `time · ${props.summary.amount}s`
      : `words · ${props.summary.amount}`
  })

  /** Where "this quote's board" goes, or `null` for a seeded run. */
  const quoteBoard = computed(() => {
    const id = props.quoteId
    if (id === null || id === undefined || id === '') return null
    return routeLocation.boards(quoteBucketKey(id))
  })

  // Grade by accuracy (SCORING_CONCEPT §4); SS/S get the main accent color.
  const grade = computed(() => gradeOf(props.metrics.accuracy))
  const isTopGrade = computed(() => grade.value === 'SS' || grade.value === 'S')

  /** Thousands-grouped: a score has no ceiling and reads as noise without them. */
  const scoreText = computed(() => (props.score ? groupThousands(props.score.total) : ''))

  /** The peak streak, hung under the grade — the other half of how the run went. */
  const comboLabel = computed(() => (props.score ? `x${props.score.comboPeak}` : ''))

  /** What the mods multiplied the score by. Absent when nothing was on. */
  const modLabel = computed(() => {
    const multiplier = props.score?.modMultiplier ?? 1
    return multiplier > 1 ? t('results.mods', { multiplier: multiplier.toFixed(2) }) : ''
  })

  /**
   * The score's arithmetic, for the tooltip. On the surface a score is one
   * number to compare; the five factors behind it are for the reader who asks
   * "why", and asking is a hover.
   */
  const scoreFormula = computed(() => {
    const score = props.score
    if (!score) return []
    const rows = [
      { label: 'base', value: String(Math.round(score.base)) },
      { label: 'combo', value: `×${score.comboPeak}` },
      { label: 'acc', value: `×${score.accMultiplier.toFixed(2)}` }
    ]
    if (score.timeBonus !== null)
      rows.push({ label: 'time', value: `×${score.timeBonus.toFixed(2)}` })
    for (const mod of props.activeMods) {
      rows.push({ label: mod.id, value: `×${mod.multiplier.toFixed(2)}` })
    }
    rows.push({ label: `score v${score.version}`, value: scoreText.value })
    return rows
  })

  /**
   * The "test type" cell, one fact per line: what was typed and in what
   * language. A quote run says `quote` and the word count it turned out to be
   * — a quote has no configured length to report. A repeat says so on its own
   * last line — the reader comparing two result screens should see why this
   * one saved nothing. The mods (difficulty included — `normal` is the absence
   * of one) moved out of the lines into the shared icon chips below.
   */
  const testType = computed(() => {
    const s = props.summary
    const shape =
      s.mode === 'time' ? `time ${s.amount}` : s.mode === 'quote' ? 'quote' : `words ${s.amount}`
    const lines = [shape, s.language]
    if (props.repeated) lines.push(t('game.repeated'))
    return lines
  })

  /** The summary's mods slice, in the shape the shared chips take. */
  const summaryMods = computed<GameModsLike>(() => ({
    punctuation: props.summary.punctuation,
    numbers: props.summary.numbers,
    randomCase: props.summary.randomCase,
    reverse: props.summary.reverse,
    lazy: props.summary.lazy,
    nospace: props.summary.nospace,
    difficulty: props.summary.difficulty
  }))

  /**
   * Whole seconds: a sub-second idle gap is noise, not a fact worth a line.
   * The share (idle over the run window) is what makes the number mean
   * something — 9s of afk is a shrug in a 60s run and the whole run in a 10s
   * one. A zero-length window has nothing to divide by, so it keeps the bare
   * seconds rather than printing a fabricated percentage.
   */
  const afkLabel = computed(() => {
    if (props.afkMs <= 0) return ''
    const seconds = Math.round(props.afkMs / 1000)
    const windowMs = props.metrics.durationSec * 1000
    if (!(windowMs > 0)) return t('results.afk', { seconds })
    const percent = Math.round(Math.min(props.afkMs / windowMs, 1) * 100)
    return t('results.afkWithShare', { seconds, percent })
  })
</script>

<style lang="scss" scoped>
  /*
   * The layout itself is Tailwind, up in the template. What is left here is the
   * ONE value two separate grids have to agree on: the verdict column's width.
   * It is what lines the first stat up under the grade rather than merely near
   * it, and a shared track cannot be expressed by either grid alone.
   */
  .results {
    --results-verdict: minmax(9rem, 12rem);
  }
</style>
