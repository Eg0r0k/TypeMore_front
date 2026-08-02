<template>
  <button
    type="button"
    :class="chipClass"
    data-testid="pace-picker"
    :aria-label="`${t('game.pace.title')}: ${chipLabel}`"
    @click="pickerOpen = true"
  >
    <IconGauge aria-hidden="true" />
    {{ chipLabel }}
  </button>

  <ConsoleModal
    v-model="selected"
    v-model:open="pickerOpen"
    :items="items"
    search-key="label"
    value-key="value"
    :title="t('game.pace.title')"
  >
    <template #item="{ item }">
      <span class="flex w-full items-center justify-between gap-2">
        <Typography color="primary">{{ item.label }}</Typography>
        <!-- Re-edit the number without leaving custom mode: selecting an
             already-selected row is a no-op by the picker's own rules, so the
             pencil is the way back into the dialog. -->
        <button
          v-if="item.value === 'custom'"
          type="button"
          class="text-sub hover:text-text focus-ring cursor-pointer"
          data-testid="pace-custom-edit"
          :aria-label="t('game.pace.customTitle')"
          @click.stop="openCustom"
        >
          <IconPencil class="size-4" />
        </button>
      </span>
    </template>

    <!-- The speed FLOOR lives with the speed things: dropping below it fails
         the run. Same registry option the notice chip used to draw — only the
         rendering moved here; a live race locks it like the rest of the bar. -->
    <template #footer>
      <span class="inline-flex items-center gap-1.5 text-xs text-sub">
        <component :is="OPTION_ICONS.minWpm" class="size-3.5" aria-hidden="true" />
        {{ t('game.minSpeed') }}
      </span>
      <ToggleGroup
        size="sm"
        :model-value="String(config.minWpm)"
        :aria-label="t('game.minSpeed')"
        @update:model-value="onMinWpm"
      >
        <ToggleGroupItem
          v-for="value in minWpmValues"
          :key="value"
          :value="value"
          class="text-xs data-[disabled]:pointer-events-auto"
          :disabled="race.racing"
          :title="race.racing ? t('game.constraint.racing') : undefined"
          :data-testid="`pace-min-wpm-${value}`"
        >
          {{ value === '0' ? t('game.minSpeedOff') : value }}
        </ToggleGroupItem>
      </ToggleGroup>
    </template>
  </ConsoleModal>

  <!-- Custom speed: one number, applied on confirm — cancelling keeps the
       previous mode untouched. -->
  <Dialog v-model:open="customOpen">
    <DialogContent class="sm:max-w-[360px]">
      <DialogTitle>{{ t('game.pace.customTitle') }}</DialogTitle>
      <form class="flex items-center gap-3" @submit.prevent="applyCustom">
        <Input
          v-model="customInput"
          type="number"
          min="1"
          max="1000"
          step="1"
          :placeholder="t('game.pace.customPlaceholder')"
          :aria-label="t('game.pace.customTitle')"
          data-testid="pace-custom-wpm"
        />
        <Button type="submit" color="main-outline" size="s" data-testid="pace-custom-apply">
          {{ t('game.pace.customApply') }}
        </Button>
      </form>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useI18n } from 'vue-i18n'

  import { useAuthStore } from '@/entities/auth'
  import { useConfigStore } from '@/entities/config'
  import { noticeChipClass, OPTION_ICONS, optionOf, presetsFor } from '@/entities/game'
  import { useRaceStore } from '@entities/race'
  import { ConsoleModal } from '@/features/modal/console'
  import { Button } from '@/shared/ui/button'
  import { Dialog, DialogContent, DialogTitle } from '@/shared/ui/dialog'
  import { Input } from '@/shared/ui/input'
  import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
  import { Typography } from '@/shared/ui/typography'
  import type { PaceCaretMode } from '@/shared/constants/type'
  import IconGauge from '~icons/tabler/gauge'
  import IconPencil from '~icons/tabler/pencil'

  /**
   * The pace selector — the chip right of the language picker, opening the
   * console-style list of pace caret modes: off / pb / last / avg / custom
   * (custom asks for a wpm number first). pb/last/avg resolve against the
   * server profile, so a guest is offered only off/custom.
   *
   * While a record race is live the selector reads `ghost · <nick>` and is the
   * race's ONE exit: choosing any other mode leaves the race (the player's own
   * settings come back through the race store's snapshot) and applies the
   * chosen pace. That is why this chip must never be disabled by the race lock
   * that freezes the rest of the bar.
   */
  const { t } = useI18n()
  const configStore = useConfigStore()
  const config = configStore.config
  const auth = useAuthStore()
  const race = useRaceStore()

  const pickerOpen = ref(false)
  const customOpen = ref(false)
  const customInput = ref(String(config.paceCaretWpm))

  const GHOST = 'ghost'
  const MODES: readonly PaceCaretMode[] = ['off', 'pb', 'last', 'avg', 'custom']
  /** Guests get no profile-backed paces — the numbers live on the server. */
  const availableModes = computed<readonly PaceCaretMode[]>(() =>
    auth.isAuth ? MODES : (['off', 'custom'] as const)
  )

  const modeLabel = (mode: PaceCaretMode): string =>
    mode === 'custom' && config.paceCaret === 'custom'
      ? `${t('game.pace.custom')} · ${config.paceCaretWpm} wpm`
      : t(`game.pace.${mode}`)

  const ghostLabel = computed(() =>
    `${t('game.pace.ghost')} · ${race.ghostName ?? ''}`.trim().replace(/ ·$/, '')
  )

  const items = computed<{ label: string; value: string }[]>(() => {
    const rows: { label: string; value: string }[] = []
    if (race.racing) rows.push({ label: ghostLabel.value, value: GHOST })
    for (const mode of availableModes.value) rows.push({ label: modeLabel(mode), value: mode })
    return rows
  })

  const chipLabel = computed(() => {
    if (race.racing) return ghostLabel.value
    if (config.paceCaret === 'custom') return `${config.paceCaretWpm} wpm`
    return t(`game.pace.${config.paceCaret}`)
  })

  /**
   * The modal's model. Reading: the live ghost outranks the config. Writing:
   * any non-ghost pick exits a live race FIRST — the snapshot restore is what
   * brings the player's own settings back — then applies the pace mode.
   * `custom` only opens the number dialog; nothing changes until it applies.
   */
  const selected = computed<string>({
    get: () => (race.racing ? GHOST : config.paceCaret),
    set: (value) => {
      if (value === GHOST) return
      if (value === 'custom') {
        openCustom()
        return
      }
      if (race.racing) race.exit()
      configStore.setConfig('paceCaret', value as PaceCaretMode)
    }
  })

  const openCustom = (): void => {
    customInput.value = String(config.paceCaretWpm)
    customOpen.value = true
  }

  const applyCustom = (): void => {
    const wpm = Math.round(Number(customInput.value))
    if (!Number.isFinite(wpm) || wpm < 1 || wpm > 1000) return
    if (race.racing) race.exit()
    configStore.setConfig('paceCaretWpm', wpm)
    configStore.setConfig('paceCaret', 'custom')
    customOpen.value = false
  }

  /**
   * The minimum-speed floor, presented here with the other speed controls.
   * Values come from the registry's `minWpm` presets; the write goes through
   * the store's validator like every other config write.
   */
  const minWpmValues = presetsFor(optionOf('minWpm')).map(String)
  const onMinWpm = (value: unknown): void => {
    if (typeof value !== 'string' || value === '') return
    configStore.setConfig('minWpm', Number(value))
  }

  /**
   * The notice line's chip look, shared with the language and difficulty chips
   * beside it; lit while any pace (or a ghost) is on the track.
   */
  const chipClass = computed(() =>
    noticeChipClass(race.racing || config.paceCaret !== 'off')
  )
</script>
