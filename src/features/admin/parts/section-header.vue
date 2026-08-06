<template>
  <header class="flex flex-col gap-1">
    <Typography tag-name="h2" size="l" color="primary">{{ title }}</Typography>
    <Typography size="s" color="sub" class="max-w-prose">{{ description }}</Typography>
  </header>
</template>

<script setup lang="ts">
  import { Typography } from '@/shared/ui/typography'

  defineProps<{
    title: string
    description: string
  }>()
</script>
