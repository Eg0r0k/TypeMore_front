<template>
  <button
    :disabled="isLoading || isDisabled"
    :class="classes"
    role="button"
    :aria-label="buttonLabel"
  >
    <span class="loader" v-if="isLoading" aria-hidden="true"></span>
    <span class="icon" v-if="!isLoading">
      <slot name="left-icon"></slot>
    </span>

    <Typography
      v-if="slots.default"
      class="button__text"
      :class="isLoading ? 'invisible' : ''"
      tagName="p"
      :size="props.size"
      :aria-hidden="isLoading"
    >
      <slot></slot>
    </Typography>
    <span class="icon" v-if="!isLoading">
      <slot name="right-icon"></slot>
    </span>
  </button>
</template>

<script setup lang="ts">
import { useSlots, withDefaults, computed } from 'vue'
import { Typography } from '@/shared/ui/typography'
//Sizes:
// s : padding - 4px 8px
// m : padding - 8px 16px
// l : padding - 16px 24px
interface Props {
  color?: 'main' | 'gray' | 'error' | 'main-outline' | 'error-outline'
  size?: 's' | 'm' | 'l'
  decoration?: 'default' | 'none'
  isDisabled?: boolean
  buttonLabel?: string
  isLoading?: boolean
}

const slots = useSlots()
const props = withDefaults(defineProps<Props>(), {
  color: 'main',
  size: 'm',
  isDisabled: false,
  decoration: 'default',
  buttonLabel: 'Button'
})

const classes = computed(() => [
  'button',
  `button--size-${props.size}`,
  `button--color-${props.color}`,
  `decoration--${props.decoration}`
])
</script>

<style scoped lang="scss">
$main: (
  'background': var(--main-color),
  'hover': var(--text-color),
  'active': var(--sub-color),
  'color': var(--bg-color),
  'hover-color': var(--bg-color),
  'active-color': var(--bg-color)
);
$error: (
  'background': var(--error-color),
  'hover': var(--text-color),
  'active': var(--sub-color),
  'color': var(--text-color),
  'hover-color': var(--bg-color),
  'active-color': var(--bg-color)
);
$gray: (
  'background': var(--sub-alt-color),
  'hover': var(--text-color),
  'active': var(--sub-alt-color),
  'color': var(--text-color),
  'hover-color': var(--bg-color),
  'active-color': var(--text-color)
);

// Styles for button
$styles: (
  'main': $main,
  'gray': $gray,
  'error': $error
);

// Get map of styles and set it to classes
@mixin button-style($styles) {
  @each $key, $val in $styles {
    .button--color-#{$key} {
      background-color: map-get($val, 'background');

      p {
        color: map-get($val, 'color');
      }

      .icon {
        color: map-get($val, 'color');
      }

      &:hover {
        background-color: map-get($val, 'hover');

        p {
          color: map-get($val, 'hover-color');
        }

        .icon {
          color: map-get($val, 'hover-color');
        }
      }

      &:active {
        background-color: map-get($val, 'active');

        p {
          color: map-get($val, 'active-color');
        }

        .icon {
          color: map-get($val, 'active-color');
        }
      }
    }

    // Outline button styles
    .button--color-#{$key}-outline {
      background-color: transparent;
      box-shadow: 0 0 0 1px map-get($val, 'background');

      p {
        color: map-get($val, 'background');
      }

      .icon {
        color: map-get($val, 'background');
      }

      &:hover {
        background-color: map-get($val, 'background');
        box-shadow: 0 0 0 1px map-get($val, 'hover');

        p {
          color: map-get($val, 'hover-color');
        }

        .icon {
          color: map-get($val, 'hover-color');
        }
      }

      &:active {
        background-color: map-get($val, 'active');
        box-shadow: 0 0 0 1px map-get($val, 'active');

        p {
          color: map-get($val, 'active-color');
        }

        .icon {
          color: map-get($val, 'active-color');
        }
      }
    }
  }
}

// call function
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
  }

  &.decoration--none {
    background-color: unset;
    border-color: unset;
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
