<template>
  <div class="custom-select" :tabindex="tabindex" @blur="handleBlur" role="combobox" :aria-expanded="open"
    :aria-labelledby="labelId" @keydown="handleKeydown" :aria-disabled="disabled">
    <label :id="labelId" class="sr-only">{{ label }}</label>
    <div class="selected" :class="{ open, disabled }" @click="toggleDropdown" role="button" aria-haspopup="listbox"
      :aria-disabled="disabled">
      {{ selected }}
    </div>
    <div class="items" :class="{ selectHide: !open }" role="listbox">
      <div v-for="(option, index) in options" :key="option" @click="selectOption(option)"
        :aria-selected="selected === option" :class="{ selectedOption: index === selectedIndex, disabled: disabled }"
        :aria-disabled="disabled">
        {{ option }}
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'

interface Props {
  options: string[]
  default?: string | null
  tabindex?: number
  label: string
  disabled?: boolean
}
function generateId(prefix: string) {
  return `${prefix}-${Date.now()}`
}

const selectedIndex = ref(0)
const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'input', value: string): void
}>()
const labelId = generateId('custom-select')

const selected = ref(props.default || props.options[0] || null)
const open = ref(false)
const disabled = ref(props.disabled || false)

watch(selected, (newValue: string | null) => {
  if (!newValue) return
  emit('input', newValue)
})
const toggleDropdown = (): void => {
  if (!disabled.value) {
    open.value = !open.value
  }
}

const selectOption = (option: string): void => {
  if (!disabled.value) {
    selected.value = option
    open.value = false
  }
}
const handleKeydown = (event: KeyboardEvent): void => {
  if (!open.value) return
  if (event.key === 'Escape') {
    open.value = false
  }
  if (event.key === 'ArrowDown') {
    selectedIndex.value = (selectedIndex.value + 1) % props.options.length
  }
  if (event.key === 'ArrowUp') {
    selectedIndex.value = (selectedIndex.value - 1 + props.options.length) % props.options.length
  }
  if (event.key === 'Enter') {
    selectOption(props.options[selectedIndex.value])
  }
}
const handleBlur = (): void => {
  open.value = false
}
</script>

<style lang="scss" scoped>
.custom-select {
  position: relative;
  width: 100%;
  text-align: left;
  outline: none;
  height: 31px;
  line-height: 31px;
  font-size: 13px;

  .selected {
    background-color: var(--sub-alt-color);
    border-radius: var(--border-radius);
    outline: 1px solid var(--sub-color);
    color: var(--text-color);
    padding-left: 8px;
    padding-right: 24px;

    cursor: pointer;
    user-select: none;
    white-space: nowrap;

    overflow: hidden;

    text-overflow: ellipsis;

    &.open {
      outline: 1px solid var(--main-color);
      border-radius: var(--border-radius) var(--border-radius) 0 0;
    }

    &::after {
      position: absolute;
      content: '';
      top: 15px;

      right: 1em;
      width: 0;
      height: 0;
      border: 5px solid transparent;
      border-color: var(--text-color) transparent transparent transparent;
    }
  }

  .items {
    color: var(--text-color);
    border-radius: 0 0 var(--border-radius) var(--border-radius);
    overflow: hidden;
    outline: 1px solid var(--main-color);
    position: absolute;
    background-color: var(--sub-alt-color);
    left: 0;
    right: 0;
    z-index: 1;

    div {
      color: var(--text-color);
      padding-left: 8px;
      cursor: pointer;
      user-select: none;
      overflow: hidden;
      text-overflow: ellipsis;

      &:hover {
        background-color: var(--sub-color);
      }

      &.selectedOption {
        background-color: var(--bg-color);
        color: var(--text-color);
      }
    }
  }

  .selectHide {
    display: none;
  }
}

.sr-only {
  @include hide-visually;
}
</style>
