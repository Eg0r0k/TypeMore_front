<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { cva } from 'class-variance-authority'
  import { cn } from '@/shared/lib/utils'

  defineOptions({ inheritAttrs: false })

  type Size = 'xs' | 's' | 'm' | 'l' | 'xl'
  type Color = 'primary' | 'gray'
  type TagName = 'input' | 'textarea'

  const inputVariants = cva(
    'w-full rounded-md bg-sub-alt caret-main placeholder:text-sub outline-none transition-tm disabled:cursor-not-allowed',
    {
      variants: {
        size: {
          xs: 'text-xs px-2 py-1',
          s: 'text-base sm:text-sm px-3 py-1.5',
          m: 'text-base px-3 py-2',
          l: 'text-lg px-4 py-2.5',
          xl: 'text-xl px-4 py-3'
        },
        color: {
          primary: 'text-text',
          gray: 'text-sub'
        }
      },
      defaultVariants: { size: 's', color: 'primary' }
    }
  )

  const props = withDefaults(
    defineProps<{
      placeholder?: string
      isError?: boolean
      errorMessage?: string
      isDisabled?: boolean
      label?: string
      size?: Size
      hasErrorSpace?: boolean
      tagName?: TagName
      color?: Color
    }>(),
    {
      size: 's',
      tagName: 'input',
      color: 'primary'
    }
  )

  const emit = defineEmits<{ blur: [event: FocusEvent] }>()

  const [model, modelModifiers] = defineModel<string | number>()

  const inputRef = ref<HTMLInputElement | HTMLTextAreaElement | null>(null)

  const hasError = computed(() => props.isError || !!props.errorMessage)

  const onInput = (event: Event) => {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement
    let value: string | number = target.value
    if (modelModifiers.number) {
      const num = parseFloat(value)
      value = Number.isNaN(num) ? value : num
    }
    model.value = value
  }

  const getInputRef = () => inputRef.value

  defineExpose({ getInputRef })
</script>

<template>
  <div class="flex flex-col gap-1" :class="{ 'opacity-50': isDisabled }">
    <label v-if="$slots.default || label" class="text-sub text-sm">
      <slot>{{ label }}</slot>
    </label>

    <div class="relative flex items-center">
      <component
        :is="tagName"
        ref="inputRef"
        v-bind="$attrs"
        :value="model"
        :placeholder="placeholder"
        :disabled="isDisabled"
        :class="
          cn(
            inputVariants({ size, color }),
            hasError ? 'shadow-[0_0_0_1.5px_var(--error-color)]' : 'focus-ring',
            $slots['right-icon'] && 'pr-10'
          )
        "
        @input="onInput"
        @blur="emit('blur', $event)"
      />

      <span v-if="$slots['right-icon']" class="absolute right-0 flex items-center">
        <slot name="right-icon" />
      </span>
    </div>

    <span v-if="hasErrorSpace" class="text-error min-h-4 text-xs">
      {{ errorMessage }}
    </span>
  </div>
</template>

<style scoped>
  /* stylelint-disable-next-line selector-no-vendor-prefix */
  input[type='number']::-webkit-inner-spin-button,
/* stylelint-disable-next-line selector-no-vendor-prefix */
input[type='number']::-webkit-outer-spin-button {
    /* stylelint-disable-next-line property-no-vendor-prefix */
    -webkit-appearance: none;
    margin: 0;
  }

  input[type='number'] {
    appearance: textfield;
  }

  textarea {
    resize: none;
  }

  textarea::-webkit-scrollbar {
    width: 6px;
  }

  textarea::-webkit-scrollbar-thumb {
    background: var(--sub-color);
    border-radius: var(--border-radius);
  }

  textarea::-webkit-scrollbar-track {
    background: transparent;
  }
</style>
