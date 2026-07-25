<template>
  <ConsoleModal
    v-model:open="open"
    :model-value="language"
    :items="languages"
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
  import { languagesQueryOptions } from '@shared/api'

  /**
   * Test-language picker: the dictionary catalogue rendered as a searchable
   * console list. The caller owns both the open state and the value, so the same
   * modal serves the home settings bar (writes the persisted config) and the room
   * config panel (writes the room settings).
   */
  const open = defineModel<boolean>('open', { required: true })
  const language = defineModel<string>({ required: true })

  const { t } = useI18n()

  // Falls back to the current value so the list is never empty while the
  // catalogue loads (or if it fails to).
  const { data: catalogue } = useQuery(languagesQueryOptions())
  const languages = computed<string[]>(() => catalogue.value ?? [language.value])

  const onSelect = (value: string | string[] | null): void => {
    if (typeof value === 'string') language.value = value
  }
</script>
