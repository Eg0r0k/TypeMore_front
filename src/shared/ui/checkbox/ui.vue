<template>
  <div class="checkbox-wrapper">
    <label class="checkbox-wrapper__field">
      <input
        v-model="modelValue"
        type="checkbox"
        :value="value"
        :name="props.name"
        :disabled="isDisabled"
        class="checkbox-wrapper__input"
        @input="$emit('input', $event)"
        @change="$emit('change', $event)"
      />
      <span class="checkbox-wrapper__label">
        <slot>{{ props.label }}</slot>
      </span>
    </label>
  </div>
</template>

<script setup lang="ts" generic="T">
  //Sometimes in some components i forget about T generics in components
  interface Props {
    value: string | number | boolean
    label?: string
    name?: string
    isDisabled?: boolean
  }

  const props = withDefaults(defineProps<Props>(), {
    name: 'checkbox',
    label: ''
  })

  const modelValue = defineModel<T>()

  defineEmits<{
    (e: 'input', event: Event): void
    (e: 'change', event: Event): void
  }>()
</script>

<style scoped lang="scss">
  .checkbox-wrapper {
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
      border-radius: 3px;
      box-shadow: 0 0 0 1px var(--sub-color);

      &:disabled {
        cursor: not-allowed;
        opacity: 0.5;
      }

      /*&:checked{
      box-shadow: 0 0 0 1px var(--main-color);
    }
    */

      &::before {
        transition: border var(--transition-duration);
        position: absolute;
        left: 6px;
        width: 5px;
        height: 13px;
        content: '';
        border: solid transparent;
        border-width: 0 3px 3px 0;
        transform: rotate(45deg);
      }

      &:hover::before {
        border-color: var(--sub-color);
      }

      &:checked::before {
        border-color: var(--main-color);
      }

      &:hover:checked::before {
        border-color: var(--text-color);
      }
    }

    &__label {
      user-select: none;
    }
  }
</style>
