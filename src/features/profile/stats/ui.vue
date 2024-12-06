<template>
  <section class="statistic" aria-labelledby="statistic-title">
    <h2 id="statistic-title" class="sr-only">Statistics Overview</h2>
    <div class="statistic__stats stats">
      <div class="stats__title">
        <Typography color="sub" size="xs" tag="h3">tests started</Typography>
      </div>
      <div class="stats__value">
        <Typography color="primary" isBold size="m" tag="span">723</Typography>
      </div>
    </div>
    <div class="statistic__stats stats">
      <div class="stats__title">
        <Typography color="sub" size="xs" tag="h3">tests complited</Typography>
      </div>
      <div class="stats__value">
        <Typography color="primary" isBold size="m" tag="span">112</Typography>
      </div>
    </div>

    <div class="statistic__stats stats">
      <div class="stats__title">
        <Typography color="sub" size="xs" tag="h3">type typing</Typography>
      </div>
      <div class="stats__value">
        <Typography color="primary" isBold size="m" tag="span">00:23:00</Typography>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
  import { Typography } from '@/shared/ui/typography'
</script>

<style scoped lang="scss">
  .statistic {
    display: flex;
    flex-wrap: wrap;
    gap: 40px;
    justify-content: space-between;
  }

  .sr-only {
    @include hide-visually;
  }
</style>
