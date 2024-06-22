<template>
  <div class="text-input__wrapper">
    <label for="" class="text-input__label">
      <slot></slot>
    </label>
    <component v-bind="$attrs" ref="inputEl" :is="props.tagName" class="text-input" :value="modelValue"
      :placeholder="placeholder" :disabled="isDisabled" @input="updateInput" @blur="$emit('blur')"
      :class="{ 'text-input--error': props.isError }">
    </component>
    <Typography class="error-msg" v-if="errorMessage" tag-name="p" :size="'xs'" color="error">{{ errorMessage }}
    </Typography>
  </div>
</template>

<script setup lang="ts" generic="T">
import { Typography } from '@/shared/ui/typography'
defineOptions({
  inheritAttrs: false
})
interface Props {
  placeholder?: string
  isError?: boolean
  errorMessage?: string
  isDisabled?: boolean
  label?: string
  tagName?: 'input' | 'textarea'
}
defineEmits(['blur'])
const props = withDefaults(defineProps<Props>(), {
  tagName: 'input',
})
const modelValue = defineModel<T>()

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
}
</style>
