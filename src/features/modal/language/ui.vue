<template>
  <ConsoleModal
    v-model:open="open"
    :model-value="language"
    :items="languages"
    search-key="name"
    :search-keys="['lang']"
    value-key="lang"
    :title="t('game.language')"
    :description="t('picker.languageHint')"
    @update:model-value="onSelect"
  />
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import { useQuery } from '@tanstack/vue-query'
  import { useI18n } from 'vue-i18n'

  import { ConsoleModal } from '../console'
  import { dictionaryCatalogueQueryOptions } from '@shared/api'

  /**
   * Test-language picker: the dictionary catalogue rendered as a searchable
   * console list. The caller owns both the open state and the value, so the same
   * modal serves the home settings bar (writes the persisted config) and the room
   * config panel (writes the room settings).
   *
   * A row shows the catalogue's `name` and selects its `lang`: the key is the
   * identifier the config, the run payload and the leaderboard bucket all speak,
   * and it is never what the player reads. Search covers BOTH, so `code_css`
   * finds "CSS (code)" for whoever already knows the key.
   */

  /** All a row needs: the key it selects, the name it shows. */
  type LanguageRow = { readonly lang: string; readonly name: string }

  const open = defineModel<boolean>('open', { required: true })
  const language = defineModel<string>({ required: true })

  const { t } = useI18n()

  const { data: catalogue } = useQuery(dictionaryCatalogueQueryOptions())

  // Falls back to the current value so the list is never empty while the
  // catalogue loads (or if it fails to) — the one case a key reaches the screen,
  // because a picker showing nothing is worse than one showing an identifier.
  const languages = computed<LanguageRow[]>(
    () =>
      catalogue.value?.map(({ lang, name }) => ({ lang, name })) ?? [
        { lang: language.value, name: language.value }
      ]
  )

  const onSelect = (value: string | string[] | null): void => {
    if (typeof value === 'string') language.value = value
  }
</script>
