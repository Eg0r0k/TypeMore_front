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
      <ProgressFill :value="progress" />

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
  import { activeModsV1 } from '@shared/core'
  import IconPlayerPlay from '~icons/tabler/player-play'
  import IconPlayerPause from '~icons/tabler/player-pause'
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
    width: 100%;
    margin: 0 auto;

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

    &__controls {
      display: flex;
      gap: 12px;
      align-items: center;
      justify-content: center;
    }
  }
</style>
