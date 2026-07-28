<template>
  <aside class="board-rail" :aria-label="t('boards.rail.label')">
    <!-- LANGUAGE: every name the dictionary catalogue publishes, searchable. -->
    <section class="board-rail__group" :aria-label="t('game.language')">
      <Typography class="board-rail__heading" tag-name="span" size="xs" color="sub">
        {{ t('game.language') }}
      </Typography>

      <input
        v-model="query"
        type="search"
        class="board-rail__search"
        data-testid="rail-language-search"
        :placeholder="t('boards.rail.search')"
        :aria-label="t('boards.rail.search')"
      />

      <ul class="board-rail__list" data-testid="rail-languages">
        <li v-for="row in visibleLanguages" :key="row.key">
          <button
            type="button"
            class="board-rail__item"
            :class="{
              'board-rail__item--active': row.key === language,
              'board-rail__item--muted': source === 'random' && row.entries === 0
            }"
            :data-lang="row.key"
            data-testid="rail-language"
            :aria-pressed="row.key === language"
            @click="emit('select-language', row.key)"
          >
            <span class="board-rail__name">{{ row.name }}</span>
            <span v-if="source === 'random'" class="board-rail__count">{{ row.entries }}</span>
          </button>
        </li>
        <li v-if="visibleLanguages.length === 0">
          <Typography class="board-rail__none" size="xs" color="sub">
            {{ t('boards.rail.noLanguages') }}
          </Typography>
        </li>
      </ul>
    </section>

    <!-- TEXT SOURCE: random | quotes. Nothing else exists, so nothing else renders. -->
    <section class="board-rail__group" :aria-label="t('boards.rail.source')">
      <Typography class="board-rail__heading" tag-name="span" size="xs" color="sub">
        {{ t('boards.rail.source') }}
      </Typography>

      <button
        v-for="option in SOURCES"
        :key="option"
        type="button"
        class="board-rail__item"
        :class="{ 'board-rail__item--active': option === source }"
        :data-source="option"
        data-testid="rail-source"
        :aria-pressed="option === source"
        @click="emit('select-source', option)"
      >
        <span class="board-rail__name">{{ t(`boards.rail.${option}`) }}</span>
      </button>
    </section>

    <!-- VARIATIONS of the current source. -->
    <section class="board-rail__group" :aria-label="t('boards.rail.variations')">
      <Typography class="board-rail__heading" tag-name="span" size="xs" color="sub">
        {{ t('boards.rail.variations') }}
      </Typography>

      <template v-if="source === 'random'">
        <!--
          Only presets the catalogue holds — for ANY language, so the list is
          the set of ranked shapes people actually play. A preset this language
          has no board for is muted with its zero count and disabled: the
          client cannot mint a language bucket key, so there is no board to go
          to, and pretending otherwise would 404 by construction.
        -->
        <button
          v-for="chip in variations"
          :key="chip.id"
          type="button"
          class="board-rail__item"
          :class="{
            'board-rail__item--active': chip.bucket !== undefined && chip.bucket === selectedBucket,
            'board-rail__item--muted': chip.bucket === undefined
          }"
          :data-variation="chip.id"
          data-testid="rail-variation"
          :disabled="chip.bucket === undefined"
          :aria-pressed="chip.bucket !== undefined && chip.bucket === selectedBucket"
          @click="chip.bucket !== undefined && emit('select-variation', chip.bucket)"
        >
          <span class="board-rail__name">{{ variationLabel(chip) }}</span>
          <span class="board-rail__count">{{ chip.entries }}</span>
        </button>
        <Typography v-if="variations.length === 0" class="board-rail__none" size="xs" color="sub">
          {{ t('boards.rail.noVariations') }}
        </Typography>
      </template>

      <template v-else>
        <button
          v-for="option in GROUPS"
          :key="option"
          type="button"
          class="board-rail__item"
          :class="{ 'board-rail__item--active': option === group }"
          :data-group="option"
          data-testid="rail-group"
          :aria-pressed="option === group"
          @click="emit('select-group', option)"
        >
          <span class="board-rail__name">{{ t(`game.quote.group.${option}`) }}</span>
        </button>
      </template>
    </section>
  </aside>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import type { BoardsSource, QuoteGroupFilter } from '../model/use-boards-selection'
  import type { RailLanguage, RailVariation } from '../model/rail'
  import { Typography } from '@/shared/ui/typography'

  /**
   * The boards rail: three stacked groups — language, text source, and the
   * source's variations — one active item per group. Presentational: the page
   * owns every selection (they live in the URL) and hands them down.
   *
   * There is deliberately nothing else here: no everyone/friends, no daily, no
   * weekly — those boards do not exist, and a filter over nothing is a lie.
   */
  const props = defineProps<{
    languages: readonly RailLanguage[]
    variations: readonly RailVariation[]
    language?: string
    source: BoardsSource
    group: QuoteGroupFilter
    selectedBucket?: string
  }>()

  const emit = defineEmits<{
    (e: 'select-language', lang: string): void
    (e: 'select-source', source: BoardsSource): void
    (e: 'select-variation', bucket: string): void
    (e: 'select-group', group: QuoteGroupFilter): void
  }>()

  const { t } = useI18n()

  const SOURCES = ['random', 'quotes'] as const
  const GROUPS = ['all', 'short', 'medium', 'long', 'thicc'] as const

  const query = ref('')

  /**
   * Search matches the display name AND the raw key, so `code_css` is findable
   * by someone holding the key. The selected language is always kept visible —
   * filtering away the active row would leave the group claiming nothing is
   * chosen.
   */
  const visibleLanguages = computed<readonly RailLanguage[]>(() => {
    const needle = query.value.trim().toLowerCase()
    if (needle === '') return props.languages
    return props.languages.filter(
      (row) =>
        row.key === props.language ||
        row.name.toLowerCase().includes(needle) ||
        row.key.toLowerCase().includes(needle)
    )
  })

  const MS_PER_SECOND = 1000

  const variationLabel = (chip: RailVariation): string =>
    chip.mode === 'time'
      ? t('boards.rail.time', { seconds: Math.round(chip.dimension / MS_PER_SECOND) })
      : t('boards.rail.words', { count: chip.dimension })
</script>

<style lang="scss" scoped>
  .board-rail {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;

    &__group {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 0.75rem;
      background-color: var(--sub-alt-color);
      border-radius: var(--border-radius);
    }

    &__heading {
      padding: 0 0.25rem 0.25rem;
      text-transform: uppercase;
    }

    &__search {
      width: 100%;
      margin-bottom: 0.25rem;
      padding: 0.375rem 0.5rem;
      font-family: inherit;
      font-size: 0.8rem;
      color: var(--text-color);
      background-color: var(--bg-color);
      border: 1px solid var(--sub-color);
      border-radius: var(--border-radius);
      transition: border-color var(--transition-duration) ease;

      &:focus-visible {
        border-color: var(--main-color);
        outline: none;
      }

      &::placeholder {
        color: var(--sub-color);
      }
    }

    &__list {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      max-height: 16rem;
      margin: 0;
      padding: 0;
      overflow-y: auto;
      list-style: none;
      scrollbar-width: thin;
    }

    &__item {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: 0.375rem 0.5rem;
      font-family: inherit;
      font-size: 0.85rem;
      color: var(--text-color);
      text-align: start;
      background: none;
      border: none;
      border-radius: var(--border-radius);
      cursor: pointer;
      transition:
        background-color var(--transition-duration) ease,
        color var(--transition-duration) ease;

      &--active {
        color: var(--bg-color);
        background-color: var(--main-color);

        .board-rail__count {
          color: var(--bg-color);
        }
      }

      &--muted {
        color: var(--sub-color);
      }

      &:disabled {
        cursor: default;
      }

      &:hover:not(:disabled, .board-rail__item--active),
      &:focus-visible:not(:disabled, .board-rail__item--active) {
        background-color: var(--bg-color);
      }
    }

    &__name {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    &__count {
      font-size: 0.7rem;
      color: var(--sub-color);
    }

    &__none {
      display: block;
      padding: 0.25rem 0.5rem;
    }
  }
</style>
