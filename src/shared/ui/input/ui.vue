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

  type InputColor = 'primary' | 'gray'
  type InputSize = 'xs' | 's' | 'm' | 'l' | 'xl'

  interface Props {
    placeholder?: string
    isError?: boolean
    errorMessage?: string
    isDisabled?: boolean
    label?: string
    size?: InputSize
    hasErrorSpace?: boolean
    tagName?: 'input' | 'textarea'
    color?: InputColor
  }
  const modelValue = defineModel<string | number>()

  const props = withDefaults(defineProps<Props>(), {
    tagName: 'input',
    color: 'primary',
    size: 's',
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
      `text-input--${props.color}`,
      `text-input--${props.size}`,
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
    --xs: 4px 8px;
    --s: 8px 8px;
    --m: 10px 10px;
    --l: 12px 10px;
    --xl: 14px 10px;

    position: relative;
    width: 100%;

    border: none;
    box-sizing: border-box;
    font-size: 16px;
    line-height: normal;

    border-radius: var(--border-radius);
    color: var(--text-color);
    caret-color: var(--main-color);

    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;

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

    &--primary {
      background-color: var(--sub-alt-color);
    }

    &--gray {
      background-color: var(--sub-color);
    }

    &--xs {
      padding: var(--xs);
    }

    &--s {
      padding: var(--s);
    }

    &--m {
      padding: var(--m);
    }

    &--l {
      padding: var(--l);
    }

    &--xl {
      padding: var(--xl);
    }
  }
</style>
