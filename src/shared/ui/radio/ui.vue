<template>
  <div class="radio-wrapper">
    <label tabindex="-1" class="radio-wrapper__field" :for="labelId">
      <input
        :tabindex="isDisabled ? -1 : 0"
        :id="labelId"
        v-model="modelValue"
        type="radio"
        :value="value"
        :name="name"
        :disabled="isDisabled"
        class="radio-wrapper__input"
      />
      <span draggable="false" class="radio-wrapper__label">
        <slot>{{ label }}</slot>
      </span>
    </label>
  </div>
</template>
<script setup lang="ts" generic="T">
  import { generateId } from '@/shared/lib/helpers/forms'
  import { computed } from 'vue'

  interface Props {
    value?: T
    label?: string
    name?: string
    isDisabled?: boolean
  }

  const props = withDefaults(defineProps<Props>(), {
    name: 'radio',
    label: ''
  })
  const emit = defineEmits<{
    (e: 'update:modelValue', value: T): void
  }>()
  const modelValue = defineModel<T>()
  const labelId = computed(() => generateId('custom-radio'))
</script>

<style scoped lang="scss">
  .radio-wrapper {
    display: flex;
    align-items: center;

    &__field {
      display: flex;
      align-items: center;
      cursor: pointer;
    }

    &__input {
      position: relative;
      display: inline-block;
      min-width: 20px;
      min-height: 20px;
      margin-right: 8px;
      appearance: none;
      cursor: pointer;
      background-color: var(--sub-alt-color);
      border-radius: 50%;
      box-shadow: 0 0 0 1px var(--sub-color);

      &:disabled {
        cursor: not-allowed;
        opacity: 0.5;
      }

      &:checked {
        background-color: var(--main-color);
        box-shadow: 0 0 0 1px var(--main-color);
      }

      &::before {
        transition: var(--transition-duration);
        position: absolute;
        top: 6px;
        left: 6px;
        width: 8px;
        height: 8px;
        content: '';
        border-radius: 50%;
        background-color: var(--sub-alt-color);
      }

      &:checked::before {
        background-color: var(--text-color);
      }

      &:hover::before {
        background-color: var(--sub-color);
      }
    }

    &__label {
      display: flex;
      user-select: none;
      color: var(--text-color);
    }
  }
</style>
