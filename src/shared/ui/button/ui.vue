<template>
  <component
    :is="isLink ? 'a' : 'button'"
    :href="isLink ? to : undefined"
    :disabled="isDisabled || isLoading"
    :class="classes"
    role="button"
    :aria-label="buttonLabel"
    :aria-busy="isLoading"
  >
    <span v-if="isLoading" class="loader" aria-hidden="true"></span>
    <span class="icon" :class="{ invisible: isLoading }">
      <slot name="left-icon" :aria-label="buttonLabel"></slot>
    </span>

    <Typography
      v-if="slots.default"
      class="button__text"
      :class="isLoading ? 'invisible' : ''"
      tag-name="p"
      :size="props.size"
      :aria-hidden="isLoading"
    >
      <slot></slot>
    </Typography>
    <span class="icon" :class="{ invisible: isLoading }">
      <slot name="right-icon" :aria-label="buttonLabel"></slot>
    </span>
  </component>
</template>

<script setup lang="ts">
import { useSlots, computed } from 'vue'
import { Typography } from '@/shared/ui/typography'

type ButtonColor = 'main' | 'gray' | 'error' | 'main-outline' | 'error-outline' | 'shadow'
type ButtonSize = 's' | 'm' | 'l'
type ButtonDecoration = 'default' | 'none'

//Sizes:
// s : padding - 4px 8px
// m : padding - 8px 16px
// l : padding - 16px 24px
interface Props {
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
const props = withDefaults(defineProps<Props>(), {
  color: 'main',
  size: 'm',
  isDisabled: false,
  decoration: 'default',
  buttonLabel: 'Button',
  to: null,
  isLink: false
})
const isLink = computed(() => !!props.to)
const classes = computed(() => ({
  button: true,
  [`button--size-${props.size}`]: true,
  [`button--color-${props.color}`]: true,
  [`decoration--${props.decoration}`]: true,
  loading: props.isLoading,
  'button--link': isLink.value
}))
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
$shadow: (
  'background': transparent,
  'hover': transparent,
  'active': transparent,
  'color': var(--sub-color),
  'hover-color': var(--main-color),
  'active-color': var(--main-color)
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

$styles: (
  'main': $main,
  'gray': $gray,
  'error': $error,
  'shadow': $shadow
);

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

      @media (hover: hover), (pointer: fine) {
        &:hover {
          background-color: map-get($val, 'hover');

          p {
            color: map-get($val, 'hover-color');
          }

          .icon {
            color: map-get($val, 'hover-color');
          }
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

    .button--color-#{$key}-outline {
      background-color: transparent;
      box-shadow: 0 0 0 1px map-get($val, 'background');

      p {
        color: map-get($val, 'background');
      }

      .icon {
        color: map-get($val, 'background');
      }

      @media (hover: hover), (pointer: fine) {
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

  & &.decoration--none {
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
