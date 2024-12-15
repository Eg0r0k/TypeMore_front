<template>
  <div
    class="custom-select"
    :tabindex="isDisabledComputed ? -1 : 0"
    @blur="handleBlur"
    role="combobox"
    :aria-expanded="isOpen"
    :aria-labelledby="labelId"
    @keydown="handleKeydown"
    :aria-disabled="isDisabledComputed"
  >
    <label :id="labelId" class="sr-only">{{ label }}</label>
    <div
      :class="selectedClasses"
      @click="toggleDropdown"
      role="button"
      aria-haspopup="listbox"
      :aria-disabled="isDisabledComputed"
    >
      {{ selected }}
    </div>
    <div :class="itemsClasses" role="listbox">
      <div
        v-for="(option, index) in options"
        :role="'option'"
        :key="option"
        :tabindex="isDisabledComputed ? -1 : 0"
        @click="selectOption(option, index)"
        :aria-selected="selected === option"
        :class="optionClasses(index)"
        :aria-disabled="isDisabledComputed"
      >
        {{ option }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, nextTick, ref, watch } from 'vue'
  import { v4 as uuidv4 } from 'uuid'
  import clsx from 'clsx'

  interface Props {
    options: string[]
    default?: string | null
    tabindex?: number
    label?: string
    isDisabled?: boolean
  }

  const props = defineProps<Props>()
  const emit = defineEmits<{
    (e: 'input', value: string): void
  }>()

  const selectedIndex = ref<number>(-1)
  const isOpen = ref<boolean>(false)
  const selected = ref<string | null>(props.default || props.options[0] || null)
  const isDisabledComputed = computed(() => props.isDisabled || false)

  const selectedClasses = computed(() =>
    clsx('selected', {
      open: isOpen.value,
      disabled: isDisabledComputed.value
    })
  )

  const itemsClasses = computed(() =>
    clsx('items', {
      'select-hide': !isOpen.value,
      disabled: isDisabledComputed.value
    })
  )

  const optionClasses = (index: number) =>
    clsx({
      'selected-option': index === selectedIndex.value,
      disabled: isDisabledComputed.value
    })

  function generateId(prefix: string) {
    return `${prefix}-${uuidv4()}`
  }
  const labelId = generateId('custom-select')

  watch(selected, (newValue: string | null) => {
    if (!newValue) return
    emit('input', newValue)
  })

  const toggleDropdown = async (): Promise<void> => {
    if (!isDisabledComputed.value) {
      isOpen.value = !isOpen.value
      await nextTick()
    }
  }

  const selectOption = (option: string, index: number): void => {
    if (!isDisabledComputed.value) {
      selected.value = option
      selectedIndex.value = index
      isOpen.value = false
    }
  }

  const handleKeydown = (event: KeyboardEvent): void => {
    const actions: Record<string, () => void> = {
      Escape: () => {
        isOpen.value = false
        event.preventDefault()
      },
      ArrowDown: () => {
        selectedIndex.value = (selectedIndex.value + 1) % props.options.length
        event.preventDefault()
      },
      ArrowUp: () => {
        selectedIndex.value =
          (selectedIndex.value - 1 + props.options.length) % props.options.length
        event.preventDefault()
      },
      Enter: () => {
        selectOption(props.options[selectedIndex.value], selectedIndex.value)
        isOpen.value = false
        event.preventDefault()
      },
      ' ': () => {
        if (!isOpen.value) isOpen.value = true
        else {
          selectOption(props.options[selectedIndex.value], selectedIndex.value)
          isOpen.value = false
        }
        event.preventDefault()
      }
    }

    if (isOpen.value) {
      actions[event.key]?.()
    } else if (event.key === 'Enter' || event.key === ' ') {
      actions[' ']()
    }
  }

  const handleBlur = (): void => {
    isOpen.value = false
  }
</script>

<style lang="scss" scoped>
  .custom-select {
    position: relative;
    width: 100%;
    text-align: left;
    height: 31px;
    line-height: 31px;
    font-size: 13px;
    outline: none;

    &:focus {
      outline: 1px solid var(--main-color);
      border-radius: var(--border-radius);
    }

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
      position: absolute;
      right: 0;
      left: 0;
      z-index: 1;
      color: var(--text-color);
      border-radius: 0 0 var(--border-radius) var(--border-radius);
      overflow: hidden;
      outline: 1px solid var(--main-color);
      background-color: var(--sub-alt-color);

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

        &.selected-option {
          background-color: var(--bg-color);
          color: var(--text-color);
        }
      }
    }

    & .disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    .select-hide {
      display: none;
    }
  }

  .sr-only {
    @include hide-visually;
  }
</style>
