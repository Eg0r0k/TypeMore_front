<template>
  <component
    :is="isLink ? 'a' : 'button'"
    :href="isLink ? to : undefined"
    :disabled="isButtonDisabled"
    :class="classes"
    role="button"
    :aria-label="buttonLabel"
    :aria-busy="isLoading"
  >
    <span v-if="props.isLoading" class="loader" aria-hidden="true"></span>
    <span class="icon" :class="{ invisible: props.isLoading }">
      <slot name="left-icon" :aria-label="props.buttonLabel"></slot>
    </span>

    <Typography
      v-if="slots.default"
      class="button__text"
      :class="{ invisible: props.isLoading }"
      tag-name="p"
      :size="props.size"
      :aria-hidden="props.isLoading"
    >
      <slot></slot>
    </Typography>
    <span class="icon" :class="{ invisible: props.isLoading }">
      <slot name="right-icon" :aria-label="props.buttonLabel"></slot>
    </span>
  </component>
</template>

<script setup lang="ts">
  import { useSlots, computed } from 'vue'
  import { Typography } from '@/shared/ui/typography'
  import clsx from 'clsx'

  export type ButtonColor = 'main' | 'gray' | 'error' | 'main-outline' | 'error-outline' | 'shadow'
  type ButtonSize = 's' | 'm' | 'l'
  type ButtonDecoration = 'default' | 'none'

  //Sizes:
  // s : padding - 4px 8px
  // m : padding - 8px 16px
  // l : padding - 16px 24px
  export interface ButtonI {
    color?: ButtonColor
    size?: ButtonSize
    decoration?: ButtonDecoration
    isDisabled?: boolean
    buttonLabel?: string
    isLoading?: boolean
    to?: string | null
    isLink?: boolean
  }

  const slots = useSlots()
  const props = withDefaults(defineProps<ButtonI>(), {
    color: 'main',
    size: 'm',
    isDisabled: false,
    decoration: 'default',
    buttonLabel: 'Button',
    to: null,
    isLink: false
  })
  const isLink = computed(() => !!props.to)
  const isButtonDisabled = computed(() => !isLink.value && (props.isDisabled || props.isLoading))

  const classes = computed(() =>
    clsx(
      'button',
      `button--size-${props.size}`,
      `button--color-${props.color}`,
      `decoration--${props.decoration}`,
      {
        loading: props.isLoading,
        'button--link': isLink.value
      }
    )
  )
</script>

<style scoped lang="scss">
  @use 'sass:map';
  $main: (
    'background': var(--main-color),
    'hover': var(--text-color),
    'active': var(--sub-alt-color),
    'color': var(--bg-color),
    'hover-color': var(--bg-color),
    'active-color': var(--text-color)
  );
  $shadow: (
    'background': transparent,
    'hover': transparent,
    'active': transparent,
    'color': var(--sub-color),
    'hover-color': var(--main-color),
    'active-color': var(--sub-color)
  );
  $error: (
    'background': var(--error-color),
    'hover': var(--text-color),
    'active': var(--error-extra-color),
    'color': var(--text-color),
    'hover-color': var(--bg-color),
    'active-color': var(--text-color)
  );
  $gray: (
    'background': var(--sub-alt-color),
    'hover': var(--text-color),
    'active': var(--sub-color),
    'color': var(--text-color),
    'hover-color': var(--bg-color),
    'active-color': var(--text-color)
  );

  $styles: (
    'main': $main,
    'gray': $gray,
    'error': $error,
    'shadow': $shadow
  );

  @include button-style($styles);

  .icon {
    transition: var(--transition-duration) ease-in;
    display: flex;

    &:empty {
      // If only one Icon sets to ignore second Icon block
      display: none;
    }
  }

  .button {
    display: flex;
    justify-content: center;
    align-items: center;
    height: min-content;
    border: none;
    border-radius: var(--border-radius);
    -webkit-user-select: none;
    appearance: none;
    user-select: none;
    cursor: pointer;
    line-height: 1.3;
    font-family: inherit;
    transition: var(--transition-duration) ease-in;
    gap: 8px;

    &:focus-visible {
      box-shadow:
        0 0 0 1.5px var(--bg-color),
        0 0 0 3px var(--text-color);
      outline: none;
    }

    &__text {
      text-align: center;
      transition: var(--transition-duration) ease-in;

      &:empty {
        display: none;
      }
    }

    & .decoration--none {
      background-color: unset;
      border-color: unset;
    }

    &--link {
      text-decoration: none;
    }

    &--size {
      &-s {
        padding: 4px 8px;
        gap: 4px;
      }

      &-m {
        padding: 8px 16px;
      }

      &-l {
        padding: 12px 24px;
      }
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }
  }

  .loading {
    cursor: progress !important;
  }

  .invisible {
    visibility: hidden;
  }

  .loader {
    position: absolute;
    min-width: 20px;
    min-height: 20px;
    border: 3px solid var(--bg-color);
    border-bottom-color: var(--text-color);
    border-radius: 100%;
    display: inline-block;
    box-sizing: border-box;
    animation: rotation 1.5s linear infinite;
  }

  @keyframes rotation {
    0% {
      transform: rotate(0deg);
    }

    100% {
      transform: rotate(360deg);
    }
  }
</style>
