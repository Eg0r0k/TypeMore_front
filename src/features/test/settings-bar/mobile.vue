<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-[380px]">
      <DialogTitle>{{ t('game.testSettings') }}</DialogTitle>
      <DialogDescription class="sr-only">{{ t('game.testSettingsHint') }}</DialogDescription>

      <!--
        The bar's three groups, stacked and full width.

        Side by side these need ~700px; below that the bar wrapped into three
        centred rows that re-centred themselves on every mode switch, which is
        the phone half of "everything jumps". A column of full-width rows cannot
        re-centre: each group keeps its box whatever is in it, and the words
        behind the modal never move at all.
      -->
      <section v-if="visibleTextMods.length" class="mobile-config__group">
        <h3 class="mobile-config__label">{{ t('game.slot.generation') }}</h3>
        <div class="mobile-config__grid">
          <button
            v-for="option in visibleTextMods"
            :key="option.key"
            type="button"
            class="mobile-config__btn"
            :class="{ 'is-on': config[option.key] === true }"
            :disabled="reasonOf(option) !== null"
            :title="reasonOf(option) !== null ? titleOf(option) : undefined"
            @click="onTextMod(option)"
          >
            <component :is="OPTION_ICONS[option.key]" aria-hidden="true" />
            {{ t(option.i18nKey) }}
          </button>
        </div>
      </section>

      <section class="mobile-config__group">
        <h3 class="mobile-config__label">{{ t('room.mode') }}</h3>
        <div class="mobile-config__grid">
          <button
            v-for="value in modeValues"
            :key="value"
            type="button"
            class="mobile-config__btn"
            :class="{ 'is-on': config.mode === value }"
            :disabled="modeReason(value) !== null"
            :title="modeReason(value) ?? undefined"
            @click="onMode(value)"
          >
            <component :is="modeIconOf(value)" v-if="modeIconOf(value)" aria-hidden="true" />
            {{ t(`${modeOption.valueI18nPrefix}.${value}`) }}
          </button>
        </div>
      </section>

      <section v-if="amount" class="mobile-config__group">
        <h3 class="mobile-config__label">{{ t(amount.option.i18nKey) }}</h3>
        <div class="mobile-config__grid">
          <button
            v-for="value in valuesOf(amount.option)"
            :key="value"
            type="button"
            class="mobile-config__btn"
            :class="{ 'is-on': String(config[amount.option.key]) === value }"
            :disabled="raceLock !== null"
            :title="raceLock ?? undefined"
            @click="onDimension(amount.option, value)"
          >
            {{ labelOf(amount.option, value) }}
          </button>
        </div>
      </section>
    </DialogContent>
  </Dialog>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'

  import { modeIconOf, OPTION_ICONS } from '@/entities/game'
  import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
  import { useTestConfig } from './model/use-test-config'

  /**
   * The phone-sized test config — monkeytype's `MobileTestConfigModal`.
   *
   * Below `md` the bar is replaced by a single "test settings" button that
   * opens this: the same three groups (text mods, mode, amount), one per row,
   * driven by the same `useTestConfig` rules. Only what SHAPES the run lives
   * here; the notice line under the field keeps the language, the pace and the
   * view mods, because those already fit on a phone.
   */
  defineProps<{ open: boolean }>()
  const emit = defineEmits<{ 'update:open': [boolean] }>()

  const {
    t,
    config,
    modeOption,
    modeValues,
    modeReason,
    raceLock,
    visibleTextMods,
    amountVariants,
    reasonOf,
    titleOf,
    valuesOf,
    labelOf,
    onTextMod,
    onMode,
    onDimension
  } = useTestConfig()

  /** The one amount group the current mode makes visible. */
  const amount = computed(() => amountVariants.value.find((v) => v.mode === config.mode))
</script>

<style lang="scss" scoped>
  .mobile-config {
    &__group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    &__label {
      font-size: 0.75rem;
      color: var(--sub-color);
      text-transform: lowercase;
      user-select: none;
    }

    /*
     * Two per row, and the last one on an odd count spans both — a lone pill
     * half a row wide reads as an interrupted list, and a mode group of three
     * is the common case.
     */
    &__grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.375rem;

      > :last-child:nth-child(odd) {
        grid-column: 1 / -1;
      }
    }

    &__btn {
      display: inline-flex;
      gap: 0.5rem;
      align-items: center;
      justify-content: center;
      padding: 0.625rem 0.5rem;
      font-size: 0.875rem;
      color: var(--sub-color);
      cursor: pointer;

      // The dialog's own surface is `sub-alt`; a button on it has to be the
      // OTHER one or the row reads as flat text.
      background: var(--bg-color);
      border-radius: var(--border-radius, 0.375rem);
      transition:
        color var(--transition-duration, 0.125s) linear,
        background-color var(--transition-duration, 0.125s) linear;

      &:focus-visible {
        outline: none;
        box-shadow:
          0 0 0 1.5px var(--bg-color),
          0 0 0 3px var(--text-color);
      }

      &:disabled {
        cursor: default;
        opacity: 0.4;
      }

      &:hover:not(:disabled) {
        color: var(--text-color);
      }

      &.is-on {
        color: var(--bg-color);
        background: var(--main-color);
      }

      :deep(svg) {
        flex-shrink: 0;
        width: 1rem;
        height: 1rem;
      }
    }
  }
</style>
