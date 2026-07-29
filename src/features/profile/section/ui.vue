<template>
  <section class="pf-section" :data-testid="`profile-section-${name}`">
    <header v-if="title" class="pf-section__head">
      <Typography tag-name="h2" size="m" color="primary">{{ title }}</Typography>
      <slot name="head" />
    </header>

    <div
      v-if="loading"
      class="pf-section__skeleton"
      :data-testid="`profile-loading-${name}`"
      aria-hidden="true"
    />

    <div v-else-if="error" class="pf-section__error" :data-testid="`profile-error-${name}`">
      <Typography size="s" color="error">{{ t('profile.sectionError') }}</Typography>
      <Button
        color="main-outline"
        size="s"
        :data-testid="`profile-retry-${name}`"
        @click="$emit('retry')"
      >
        {{ t('profile.retry') }}
      </Button>
    </div>

    <slot v-else />
  </section>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import { Button } from '@/shared/ui/button'
  import { Typography } from '@/shared/ui/typography'

  /**
   * One profile section's chrome: title, loading skeleton, and a per-section
   * error card with its own retry. Every widget on /profile renders inside one
   * of these so the failure of one aggregate is one grey card, never a blank
   * page.
   */
  defineProps<{ name: string; title?: string; loading?: boolean; error?: boolean }>()
  defineEmits<{ retry: [] }>()
  const { t } = useI18n()
</script>

<style lang="scss" scoped>
  .pf-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;

    &__head {
      display: flex;
      gap: 1rem;
      align-items: baseline;
      justify-content: space-between;
    }

    &__skeleton {
      min-height: 6rem;
      background: linear-gradient(
        100deg,
        var(--sub-alt-color) 40%,
        color-mix(in srgb, var(--sub-alt-color) 60%, var(--bg-color)) 50%,
        var(--sub-alt-color) 60%
      );
      background-size: 200% 100%;
      border-radius: var(--border-radius);
      animation: pf-shimmer 1.4s ease infinite;
    }

    &__error {
      display: flex;
      gap: 1rem;
      align-items: center;
      padding: 1rem;
      background-color: var(--sub-alt-color);
      border-radius: var(--border-radius);
    }
  }

  @keyframes pf-shimmer {
    to {
      background-position: -200% 0;
    }
  }
</style>
