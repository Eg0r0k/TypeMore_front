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
  --typography-size-xxxl: 49px;
  --typography-size-xxl: 39px;
  --typography-size-xl: 31px;
  --typography-size-l: 25px;
  --typography-size-m: 20px;
  --typography-size-s: 16px;
  --typography-size-xs: 13px;
  --typography-size-xxs: 10px;
  
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
      font-size: var(--typography-size-xxxl);
    }

    &xxl {
      font-size: var(--typography-size-xxl);
    }

    &xl {
      font-size: var(--typography-size-xl);
    }

    &l {
      font-size: var(--typography-size-l);
    }

    &m {
      font-size: var(--typography-size-m);
    }

    &s {
      font-size: var(--typography-size-s);
    }

    &xs {
      font-size: var(--typography-size-xs);
      ;
    }

    &xxs {
      font-size: var(--typography-size-xxs);
      ;
    }
  }
}
</style>
