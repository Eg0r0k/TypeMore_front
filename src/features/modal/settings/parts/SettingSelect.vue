<template>
  <Select :model-value="modelValue" @update:model-value="(value) => emit('update', value)">
    <SelectTrigger class="w-full" :aria-label="label">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </SelectItem>
    </SelectContent>
  </Select>
</template>

<script setup lang="ts">
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

  /**
   * The dialog's standard picker: a dropdown that fills the row's control rail.
   *
   * Anything with more than three choices belongs here rather than in a
   * `ToggleGroup` — a four- or five-segment group either overflows the rail or
   * shrinks each option until the labels stop being readable, and it grows
   * sideways with every option added. A dropdown costs one extra click and its
   * width never depends on how many options exist.
   *
   * `w-full` on the trigger is what keeps every picker in the dialog exactly as
   * wide as every other control (the trigger is `w-fit` by default), and the
   * popover inherits that width through `--reka-select-trigger-width`, so the
   * open list is never narrower than the label it has to show.
   */
  export interface SettingOption {
    value: string
    label: string
  }

  defineProps<{
    modelValue: string
    options: readonly SettingOption[]
    /** Accessible name — the visible label lives in the row, not in the trigger. */
    label: string
  }>()

  const emit = defineEmits<{ update: [value: unknown] }>()
</script>
