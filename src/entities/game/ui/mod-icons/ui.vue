<template>
  <!--
    Tags as glyphs: the binary mods render as their settings-bar icons — the
    same OPTION_ICONS every surface uses, so "flashlight" looks identical here
    and on the bar. The word survives as the chip's tooltip and accessible
    name. Difficulty and the wpm floor keep text: they carry a level or a
    value no glyph alone can say.

    The provider sits INSIDE the ul: it renders no element of its own (so the
    list stays `ul > li` and attrs like data-testid still land on the ul), and
    it makes the chips self-sufficient wherever they are mounted.
  -->
  <ul v-if="chips.length > 0" class="mod-icons">
    <TooltipProvider :delay-duration="80">
      <li v-for="chip in chips" :key="chip.key" class="mod-icons__item">
        <Tooltip>
          <TooltipTrigger
            type="button"
            class="mod-icons__chip focus-ring"
            :class="{ 'mod-icons__chip--square': chip.text === undefined }"
            :aria-label="chip.title"
          >
            <component :is="chip.icon" v-if="chip.icon" class="mod-icons__glyph" aria-hidden="true" />
            <span v-if="chip.text !== undefined">{{ chip.text }}</span>
          </TooltipTrigger>
          <TooltipContent side="top">{{ chip.title }}</TooltipContent>
        </Tooltip>
      </li>
    </TooltipProvider>
  </ul>
</template>

<script setup lang="ts">
  import { computed, type Component } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
  import { OPTION_ICONS } from '../../config/icons'

  /**
   * The mods a run was played under. Loose on purpose: BoardMods (shared/api)
   * satisfies it exactly, and a profile run's untyped `mods` blob narrows to it
   * — every field is optional and re-checked at runtime, so a missing or
   * malformed key renders nothing rather than a broken chip.
   */
  export interface GameModsLike {
    punctuation?: boolean
    numbers?: boolean
    randomCase?: boolean
    reverse?: boolean
    nospace?: boolean
    blind?: boolean
    fading?: boolean
    flashlight?: boolean
    difficulty?: string
    minWpm?: number
  }

  /**
   * Only mods that are ON become chips: `difficulty: 'normal'` and `minWpm: 0`
   * are the ABSENCE of a mod, not a mod called "normal". Labels are the game's
   * own (`game.*`) so every surface names a mod exactly like the settings bar.
   */
  const props = defineProps<{ mods: GameModsLike }>()

  const { t } = useI18n()

  /** Boolean mods, in the order the game's own settings bar lists them. */
  const FLAGS = [
    'punctuation',
    'numbers',
    'randomCase',
    'nospace',
    'blind',
    'reverse',
    'fading',
    'flashlight'
  ] as const

  interface Chip {
    key: string
    /** Tooltip body, and the chip's accessible name. */
    title: string
    icon?: Component
    /** Visible text; when present the icon (if any) is decoration. */
    text?: string
  }

  const chips = computed<Chip[]>(() => {
    const { mods } = props
    const out: Chip[] = []
    if (typeof mods.difficulty === 'string' && mods.difficulty !== 'normal') {
      const label = t(`game.difficulty.${mods.difficulty}`)
      out.push({ key: 'difficulty', title: label, text: label })
    }
    if (typeof mods.minWpm === 'number' && mods.minWpm > 0) {
      out.push({
        key: 'minWpm',
        title: `${t('game.minSpeed')} ${mods.minWpm}`,
        icon: OPTION_ICONS.minWpm,
        text: String(mods.minWpm)
      })
    }
    for (const flag of FLAGS) {
      if (mods[flag] === true) out.push({ key: flag, title: t(`game.${flag}`), icon: OPTION_ICONS[flag] })
    }
    return out
  })
</script>

<style lang="scss" scoped>
  .mod-icons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin: 0;
    padding: 0;
    list-style: none;

    &__item {
      display: inline-flex;
    }

    // The trigger is a real (focusable) button so the tooltip opens from the
    // keyboard too; it acts on nothing, so the cursor stays default.
    &__chip {
      display: inline-flex;
      gap: 0.25rem;
      align-items: center;
      justify-content: center;
      height: 1.625rem;
      padding: 0 0.5rem;
      font-family: inherit;
      font-size: 0.7rem;
      font-variant-numeric: tabular-nums;
      color: var(--sub-color);
      cursor: default;
      background-color: var(--sub-alt-color);
      border: none;
      border-radius: var(--border-radius);
    }

    // Icon-only chips are square — the glyph sits centred in a tile instead
    // of floating in a pill.
    &__chip--square {
      width: 1.625rem;
      padding: 0;
    }

    &__glyph {
      width: 1.125rem;
      height: 1.125rem;
    }
  }
</style>
