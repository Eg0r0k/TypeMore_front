<template>
  <div class="replay">
    <header class="replay__header">
      <div class="replay__result">
        <span
          class="replay__grade"
          :class="{ 'replay__grade--top': isTopGrade }"
          data-testid="replay-grade"
        >
          {{ replay.grade }}
        </span>
        <div class="replay__total">
          <span class="replay__label">score</span>
          <span class="replay__value" data-testid="replay-score">{{ replay.score.total }}</span>
        </div>
        <div class="replay__breakdown">
          <span data-testid="replay-mod-multiplier">
            mods &times;{{ modMultiplier.toFixed(2) }}
          </span>
          <span class="replay__version" data-testid="replay-score-version">
            score v{{ replay.score.version }}
          </span>
        </div>
      </div>

      <ul class="replay__mods" data-testid="replay-mods">
        <li
          v-for="mod in activeMods"
          :key="mod.id"
          class="replay__mod"
          :class="{ 'replay__mod--view': VIEW_MOD_IDS.includes(mod.id) }"
          :data-mod="mod.id"
        >
          {{ mod.id }} &times;{{ mod.multiplier.toFixed(2) }}
        </li>
      </ul>

      <div v-if="hasViewMods" class="replay__as-seen">
        <Switch
          v-model="asPlayerSaw"
          data-testid="replay-as-seen"
          :aria-labelledby="asSeenLabelId"
        />
        <span :id="asSeenLabelId">view as the player saw it</span>
      </div>
    </header>

    <Test
      :store="view"
      view-only
      :is-right-to-left="isRightToLeft"
      :fading="viewMods.fading"
      :flashlight="viewMods.flashlight"
    />

    <div class="replay__bar">
      <div
        class="replay__seek"
        role="slider"
        tabindex="0"
        aria-label="Replay position"
        :aria-valuemin="0"
        :aria-valuemax="100"
        :aria-valuenow="Math.round(progress * 100)"
        data-testid="replay-seek"
        @pointerdown="onSeekDown"
        @pointermove="onSeekMove"
        @pointerup="onSeekUp"
        @pointercancel="onSeekUp"
        @keydown.left.prevent="nudge(-NUDGE_MS)"
        @keydown.right.prevent="nudge(NUDGE_MS)"
      >
        <div class="replay__track">
          <ProgressFill :value="progress" :immediate="scrubbing" />
          <span
            v-for="(mark, index) in errorMarks"
            :key="index"
            class="replay__error-mark"
            :style="{ left: `${mark.position * 100}%` }"
          >
            <span class="replay__error-word">{{ mark.word }}</span>
          </span>
        </div>
      </div>

      <div class="replay__controls">
        <Button size="icon-sm" button-label="Exit replay" @click="exit">
          <IconX class="size-5" />
        </Button>
        <Button size="icon-sm" button-label="Restart replay" @click="restart">
          <IconRefresh class="size-5" />
        </Button>
        <Button size="icon-sm" :button-label="mainLabel" @click="onMain">
          <component :is="mainIcon" class="size-5" />
        </Button>

        <ToggleGroup
          :model-value="String(speed)"
          aria-label="Playback speed"
          @update:model-value="onSpeed"
        >
          <ToggleGroupItem v-for="o in SPEEDS" :key="o" :value="String(o)">
            {{ o }}x
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { computed, onMounted, onUnmounted, ref, useId } from 'vue'

  import { Test } from '@/widgets/test'
  import { type ReplayData, withBlind } from '@entities/game'
  import { GhostDriver } from '@entities/match'
  import { activeModsV1, analyzeLog } from '@typemore/core'
  import IconPlayerPlay from '~icons/tabler/player-play-filled'
  import IconPlayerPause from '~icons/tabler/player-pause-filled'
  import IconRefresh from '~icons/tabler/refresh'
  import IconX from '~icons/tabler/x'
  import { Button } from '@/shared/ui/button'
  import { Switch } from '@/shared/ui/switch'
  import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
  import { ProgressFill } from '@/shared/ui/progress-fill'

  /**
   * Replay player — a ghost fed its complete log up front: a GhostDriver with
   * zero display delay, its view rendered by the same GameField in view-only
   * mode. Play/pause/speed are pure UI concerns — this component owns the
   * virtual clock (a rAF loop, speed-scaled) and simply stops advancing it while
   * paused. No Pinia store is involved; the driver's view-model IS the render
   * contract.
   *
   * EVERYTHING the replay renders comes from `ReplayData` — the run's own stored
   * setup: the CoreConfig (nospace/difficulty) and words drive the ghost core,
   * the GenerationConfig + ModsDeclaration drive the mod chips, and the declared
   * view mods (blind/fading/flashlight) are applied to THIS field. The viewer's
   * config store is never read here, directly or through the field (GameView
   * contract) — a replay shows the run as the player saw it, not as the viewer
   * happens to be configured now.
   *
   * The "view as the player saw it" switch gates only the VISUAL layer; the core,
   * the log, the setup and the chip row are untouched by it. It defaults ON so a
   * fading/flashlight run replays authentically, and OFF for a blind run: blind
   * hides correctness, which is precisely what a viewer came to watch.
   */
  const props = defineProps<{ replay: ReplayData; isRightToLeft?: boolean }>()
  const emit = defineEmits<{ (event: 'exit'): void }>()

  const SPEEDS = [1, 2, 4] as const
  const onSpeed = (value: unknown): void => {
    if (value !== null && value !== undefined) setSpeed(Number(value))
  }

  /** Declared (view-only) mod ids — the ones the switch can turn off on screen. */
  const VIEW_MOD_IDS: readonly string[] = ['blind', 'fading', 'flashlight']

  const { config, words, declaration, generation, score } = props.replay

  const driver = new GhostDriver({ config, words }, { delayMs: 0 })
  driver.append(props.replay.log)
  const durationMs = driver.endMs

  interface ErrorMark {
    /** 0..1 fraction along the run's timeline. */
    readonly position: number
    /** The target word the mistyped keystroke landed in. */
    readonly word: string
  }

  /**
   * Mistyped keystrokes along the run — red ticks on the seek bar, each
   * carrying the word it landed in (a CSS-hover tooltip), so "where it went
   * wrong" is visible before scrubbing there. One analysis pass at mount; the
   * log never changes afterwards.
   */
  const errorMarks: readonly ErrorMark[] = (() => {
    if (durationMs <= 0) return []
    const analysis = analyzeLog({ config, words }, props.replay.log)
    const marks: ErrorMark[] = []
    for (let i = 0; i < analysis.keyTimes.length; i++) {
      if (analysis.keyCorrect[i]) continue
      marks.push({
        position: Math.min(1, analysis.keyTimes[i] / durationMs),
        word: words[analysis.keyWordIndex[i]] ?? ''
      })
    }
    return marks
  })()

  // Mod chips: derived from the run's STORED setup (both halves), so they stay
  // accurate whatever the switch does. The multiplier is the one the score was
  // actually computed with.
  const activeMods = activeModsV1({ generation, config }, declaration)
  const modMultiplier = score.modMultiplier ?? 1
  const isTopGrade = props.replay.grade === 'SS' || props.replay.grade === 'S'

  const hasViewMods = declaration.blind || declaration.fading || declaration.flashlight
  const asPlayerSaw = ref(hasViewMods && !declaration.blind)
  const asSeenLabelId = useId()
  const viewMods = computed(() => ({
    blind: asPlayerSaw.value && declaration.blind,
    fading: asPlayerSaw.value && declaration.fading,
    flashlight: asPlayerSaw.value && declaration.flashlight
  }))
  // The ghost view hardcodes `blind: false`; re-project it under the RUN's
  // declaration instead. The core behind it is unaffected either way.
  const view = withBlind(driver.view, () => viewMods.value.blind)

  const isPlaying = ref(false)
  const isDone = ref(false)
  const speed = ref<number>(1)
  const progress = ref(0)

  let position = 0 // virtual clock, ms of log time
  let rafId = 0
  let last = 0

  function sync(): void {
    isDone.value = driver.drained && position >= durationMs
    if (isDone.value) isPlaying.value = false
    progress.value = durationMs > 0 ? Math.min(1, position / durationMs) : 1
  }

  function frame(now: number): void {
    const delta = now - last
    last = now
    // Coalesced scrub: pointermove only RECORDS the target, the fold happens
    // here — one per frame however fast the pointer streams. A backward seek
    // re-folds the log prefix (bench: ~10ms at 14k events), and pointermove
    // outpaces the display refresh.
    if (pendingSeekMs !== null) {
      const target = pendingSeekMs
      pendingSeekMs = null
      seekTo(target)
    }
    if (isPlaying.value) {
      position += Math.max(0, delta) * speed.value
      driver.advance(position)
      sync()
    }
    rafId = requestAnimationFrame(frame)
  }

  const mainIcon = computed(() =>
    isDone.value ? IconRefresh : isPlaying.value ? IconPlayerPause : IconPlayerPlay
  )
  const mainLabel = computed(() =>
    isDone.value ? 'Replay again' : isPlaying.value ? 'Pause' : 'Play'
  )

  function onMain(): void {
    if (isDone.value) {
      restart()
      return
    }
    isPlaying.value = !isPlaying.value
  }

  function setSpeed(next: number): void {
    speed.value = next
  }

  function restart(): void {
    driver.reset()
    position = 0
    isPlaying.value = true
    sync()
  }

  // ── Seeking ────────────────────────────────────────────────────────────────
  // Forward is just `advance(t)`. Backward re-folds from zero (`reset` +
  // `advance`): the driver's clock is monotonic, and replaying a keystroke log
  // from the start is cheaper than any rewind machinery would be.

  /** Arrow-key seek step over the run's own timeline, ms. */
  const NUDGE_MS = 5000

  const scrubbing = ref(false)
  let wasPlayingBeforeScrub = false
  /** Latest scrub target, applied once per frame by the rAF loop. */
  let pendingSeekMs: number | null = null

  function seekTo(targetMs: number): void {
    const target = Math.min(durationMs, Math.max(0, targetMs))
    if (target < position) driver.reset()
    position = target
    driver.advance(target)
    sync()
  }

  function nudge(deltaMs: number): void {
    seekTo(position + deltaMs)
  }

  function fractionAt(event: PointerEvent): number {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    if (rect.width <= 0) return 0
    return Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  }

  function onSeekDown(event: PointerEvent): void {
    const el = event.currentTarget as HTMLElement
    // Guarded: pointer capture is a progressive enhancement for dragging past
    // the bar's edges; a runtime without it (happy-dom) still click-seeks.
    if (typeof el.setPointerCapture === 'function') el.setPointerCapture(event.pointerId)
    scrubbing.value = true
    wasPlayingBeforeScrub = isPlaying.value
    isPlaying.value = false
    seekTo(fractionAt(event) * durationMs)
  }

  function onSeekMove(event: PointerEvent): void {
    if (!scrubbing.value) return
    pendingSeekMs = fractionAt(event) * durationMs
  }

  function onSeekUp(event: PointerEvent): void {
    if (!scrubbing.value) return
    scrubbing.value = false
    const el = event.currentTarget as HTMLElement
    if (typeof el.releasePointerCapture === 'function') el.releasePointerCapture(event.pointerId)
    // The release position must not wait for the next frame: apply it now so
    // the resume below starts from where the pointer actually let go.
    if (pendingSeekMs !== null) {
      const target = pendingSeekMs
      pendingSeekMs = null
      seekTo(target)
    }
    // Resume only if the scrub didn't land on the end — `sync` keeps `isDone` fresh.
    isPlaying.value = wasPlayingBeforeScrub && !isDone.value
  }

  function exit(): void {
    emit('exit')
  }

  onMounted(() => {
    last = performance.now()
    isPlaying.value = true
    sync()
    rafId = requestAnimationFrame(frame)
  })

  onUnmounted(() => {
    if (rafId) cancelAnimationFrame(rafId)
  })
</script>

<style lang="scss" scoped>
  .replay {
    display: flex;
    flex-direction: column;
    gap: 20px;
    justify-content: center;

    // The same vertical band the typing stage centres itself in (see
    // features/layouts/test-stage): without it the player hugs the top of
    // #main while the game floats mid-viewport.
    min-height: 60vh;
    width: 100%;
    margin: 0 auto;
    padding-block: 2rem;

    &__header {
      display: flex;
      flex-wrap: wrap;
      gap: 12px 24px;
      align-items: center;
      font-variant-numeric: tabular-nums;
    }

    &__result {
      display: flex;
      gap: 16px;
      align-items: center;
    }

    &__grade {
      font-size: 40px;
      font-weight: 700;
      line-height: 1;
      color: var(--sub-color);

      &--top {
        color: var(--main-color);
      }
    }

    &__total {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    &__label {
      font-size: 14px;
      color: var(--sub-color);
    }

    &__value {
      font-size: 32px;
      line-height: 1;
      color: var(--main-color);
    }

    &__breakdown {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 14px;
      color: var(--sub-color);
    }

    &__version {
      opacity: 0.6;
    }

    &__mods {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    &__mod {
      padding: 4px 8px;
      font-size: 13px;
      color: var(--sub-color);
      background-color: var(--sub-alt-color);
      border-radius: var(--border-radius);

      // Declared view mods: the ones the switch below can hide on screen.
      &--view {
        color: var(--main-color);
      }
    }

    &__as-seen {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-left: auto;
      font-size: 14px;
      color: var(--sub-color);
      cursor: pointer;
    }

    &__bar {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    &__seek {
      // The bar itself is 4px; the padding is the hit target. `touch-action:
      // none` keeps a finger scrub as pointer events instead of a page scroll.
      padding: 0.375rem 0;
      cursor: pointer;
      touch-action: none;

      &:focus-visible {
        outline: 2px solid var(--main-color);
        outline-offset: 2px;
        border-radius: var(--border-radius);
      }
    }

    &__track {
      position: relative;
    }

    // The mark is a WIDE transparent hit box (the visible 3px tick is its
    // ::before) — a 3px hover target is untargetable. Pointer events stay ON:
    // pointerdown bubbles to the seek handler, so a mark is still seekable.
    &__error-mark {
      position: absolute;
      top: 50%;
      width: 0.75rem;
      height: 1.25rem;
      transform: translate(-50%, -50%);

      &::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 3px;
        height: 9px;
        background-color: var(--error-color);
        border-radius: 1px;
        transform: translate(-50%, -50%);
      }

      &:hover > .replay__error-word {
        opacity: 1;
      }
    }

    // CSS-only hover tooltip above the tick: the word the mistake landed in.
    // No popover machinery — marks are few and the bar sits clear of any
    // overflow-clipping ancestor.
    &__error-word {
      position: absolute;
      bottom: calc(100% + 0.375rem);
      left: 50%;
      padding: 0.125rem 0.5rem;
      font-size: 0.75rem;
      color: var(--text-color);
      white-space: nowrap;
      pointer-events: none;
      background-color: var(--sub-alt-color);
      border-radius: var(--border-radius);
      box-shadow: 0 0 0.5rem rgb(0 0 0 / 25%);
      opacity: 0;
      transform: translateX(-50%);
      transition: opacity var(--transition-duration) linear;
    }

    &__controls {
      display: flex;
      gap: 12px;
      align-items: center;
      justify-content: center;
    }
  }
</style>
