<template>
  <div class="text-input__wrapper">
    <label for="" class="text-input__label" v-if="label">
      <Typography tag-name="p" :size="'s'" color="primary">{{ label }}</Typography>
    </label>
    <component v-bind="$attrs" ref="inputEl" :is="props.tagName" class="text-input" :value="modelValue"
      :placeholder="placeholder" :disabled="isDisabled" @input="updateInput"
      :class="{ 'text-input--error': props.isError }">
    </component>
  </div>
</template>

<script setup lang="ts">
import { Typography } from '@/shared/ui/typography'
defineOptions({
  inheritAttrs: false
})
interface Props {
  placeholder?: string
  isError?: boolean
  isDisabled?: boolean
  label?: string
  tagName?: 'input' | 'textarea'
}

const props = withDefaults(defineProps<Props>(), {
  tagName: 'input',
})
const modelValue = defineModel<string | number>()

const updateInput = (e: any) => {
  modelValue.value = e.target.value
}
</script>

<style lang="scss" scoped>
textarea {
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
    outline: 1px solid red;
  }
}

.text-input {
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
    outline: 1px solid red;
  }
}
</style>
