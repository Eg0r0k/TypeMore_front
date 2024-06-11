<template>
  <component :is="props.tagName" :href="props.tagName === 'a' ? props.href : ''" :class="classes">
    <slot></slot>
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue'
// xxxl  49px
// xxl   39px
// xl    31px
// l     25px
// m     20px
// s     16px
// xs    13px
// xxs   10px
interface Props {
  isBold?: boolean
  tagName?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'a'
  size?: 'xxxl' | 'xxl' | 'xl' | 'l' | 'm' | 's' | 'xs' | 'xxs'
  color?: 'unset' | 'primary' | 'error' | 'main' | 'extra-error' | 'sub'
  decoration?: 'underline'
  href?: string
}
const props = withDefaults(defineProps<Props>(), {
  color: 'unset',
  isBold: false,
  tagName: 'p',
  size: 's'
})

const classes = computed(() => [
  'typography',
  `typography--color-${props.color}`,
  `typography--size-${props.size}`,
  `typography--decoration-${props.decoration}`,
  `${props.isBold ? 'bold' : ''}`,
  `tag--${props.tagName}`
])
</script>

<style lang="scss" scoped>
.tag {
  &--h1 {
    margin-bottom: 50px;
  }

  &--h2 {
    margin-bottom: 45px;
  }

  &--h3 {
    margin-bottom: 30px;
  }

  &--h4,
  &--h5,
  &--h6 {
    margin-bottom: 20px;
  }
}

.typography {
  margin-top: 0;
  font-style: normal;

  &.bold {
    font-weight: 700;
  }

  &--decoration {
    &-underline {
      text-decoration: underline;
    }
  }

  &--color {
    &-sub {
      color: var(--sub-color);
    }

    &-primary {
      color: var(--text-color);
    }

    &-none {
      color: unset;
    }

    &-error {
      color: var(--error-color);
    }

    &-main {
      color: var(--main-color);
    }

    &-extra-error {
      color: var(--error-extra-color);
    }
  }

  &--size- {
    &xxxl {
      font-size: 49px;
    }

    &xxl {
      font-size: 39px;
    }

    &xl {
      font-size: 31px;
    }

    &l {
      font-size: 25px;
    }

    &m {
      font-size: 20px;
    }

    &s {
      font-size: 16px;
    }

    &xs {
      font-size: 13px;
    }

    &xxs {
      font-size: 10px;
    }
  }
}
</style>
