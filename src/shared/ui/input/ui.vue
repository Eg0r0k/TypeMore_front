<template>
  <div :class="wrapperClasses">
    <label for="" class="text-input__label">
      <slot></slot>
    </label>
    <div :class="containerClasses">
      <component
        v-bind="$attrs"
        :is="props.tagName"
        ref="inputEl"
        :class="inputClasses"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="isDisabled"
        @input="updateInput"
        @blur="$emit('blur')"
      />

      <div v-if="props.hasErrorSpace" class="error-msg-container">
        <Typography v-if="errorMessage" class="error-msg" tag-name="p" :size="'xs'" color="error">
          {{ errorMessage }}
        </Typography>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T">
  import { Typography } from '@/shared/ui/typography'
  import { computed } from 'vue'
  import clsx from 'clsx'
  defineOptions({
    inheritAttrs: false
  })
  interface Props {
    placeholder?: string
    isError?: boolean
    errorMessage?: string
    isDisabled?: boolean
    label?: string
    hasErrorSpace?: boolean
    tagName?: 'input' | 'textarea'
  }
  const modelValue = defineModel<string | number>()

  const props = withDefaults(defineProps<Props>(), {
    tagName: 'input',
    hasErrorSpace: false
  })
  defineEmits<{
    (e: 'blur'): void
  }>()
  const wrapperClasses = computed(() =>
    clsx('text-input__wrapper', { 'text-input__wrapper--no-error': !props.hasErrorSpace })
  )
  const containerClasses = computed(() =>
    clsx('text-input__container', { 'text-input__container--no-error': !props.hasErrorSpace })
  )
  const inputClasses = computed(() =>
    clsx(
      'text-input',
      { 'text-input--error': props.isError },
      { 'text-input--disabled': props.isDisabled }
    )
  )

  const updateInput = (e: any) => {
    modelValue.value = e.target.value
  }
</script>

<style lang="scss" scoped>
  textarea {
    -webkit-user-select: none;
    -moz-user-select: none;
    user-select: none;
    resize: vertical;
    max-height: 100px;
    min-height: 35px;

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::placeholder {
      color: var(--sub-alt-color);
      opacity: 1;
    }

    &::-webkit-scrollbar-thumb {
      background-color: var(--main-color);
      border-radius: var(--border-radius);
    }

    &--error {
      outline: 1px solid var(--error-color) !important;
    }
  }

  .text-input__container {
    &--no-error {
      min-height: auto;
    }
  }

  .error-msg-container {
    min-height: 23px;
  }

  .error-msg {
    padding-top: 5px;
  }

  .text-input {
    -webkit-user-select: none;
    -moz-user-select: none;
    user-select: none;
    width: 100%;
    line-height: normal;
    box-sizing: border-box;
    background-color: var(--sub-alt-color);
    border-radius: var(--border-radius);
    border: none;
    padding: 8px;
    font-size: 16px;
    color: var(--text-color);
    caret-color: var(--main-color);
    position: relative;

    &:focus {
      outline: solid var(--main-color) 1px;
    }

    &::placeholder {
      color: var(--sub-color);
      opacity: 1;
    }

    &__label {
      margin-bottom: 4px;
      display: block;
    }

    &--error {
      outline: 1px solid var(--error-color) !important;
    }

    &--disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
</style>
