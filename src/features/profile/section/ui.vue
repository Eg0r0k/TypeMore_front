<template>
  <section class="flex min-w-0 flex-col gap-3" :data-testid="`profile-section-${name}`">
    <header
      v-if="title"
      class="flex flex-col gap-2 md:flex-row md:items-baseline md:justify-between md:gap-4"
    >
      <Typography tag-name="h2" size="m" color="primary">{{ title }}</Typography>
      <slot name="head" />
    </header>

    <div
      v-if="loading"
      class="min-h-24 animate-pulse rounded-lg bg-sub-alt"
      :data-testid="`profile-loading-${name}`"
      aria-hidden="true"
    />

    <div
      v-else-if="error"
      role="status"
      class="flex flex-wrap items-center gap-4 rounded-lg bg-sub-alt p-4"
      :data-testid="`profile-error-${name}`"
    >
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

    <!-- Ready. A REFETCH (a new range, a retry that already has data on screen)
         never unmounts the content: it dims in place and floats a spinner, so
         the chart keeps its geometry and the new numbers just slide in. -->
    <div v-else class="relative min-w-0" :aria-busy="busy || undefined">
      <div :class="busy && 'pointer-events-none opacity-40 transition-tm'">
        <slot />
      </div>
      <div
        v-if="busy"
        class="absolute inset-0 grid place-items-center"
        :data-testid="`profile-busy-${name}`"
      >
        <IconLoader class="size-6 animate-spin text-main" aria-hidden="true" />
        <span class="sr-only">{{ t('profile.loading') }}</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import { Button } from '@/shared/ui/button'
  import { Typography } from '@/shared/ui/typography'
  import IconLoader from '~icons/tabler/loader-2'

  /**
   * One profile section's chrome: title, first-load skeleton, an in-place busy
   * overlay for every LATER load, and a per-section error card with its own
   * retry. Every widget on /profile renders inside one of these so the failure
   * of one aggregate is one grey card, never a blank page.
   *
   * `loading` is the FIRST load only (no data yet); `busy` is a refetch over
   * data that is already on screen. Keeping those apart is what stops the
   * charts from unmounting, collapsing to zero height and remounting every time
   * a range preset changes.
   */
  defineProps<{
    name: string
    title?: string
    loading?: boolean
    busy?: boolean
    error?: boolean
  }>()
  defineEmits<{ retry: [] }>()
  const { t } = useI18n()
</script>
