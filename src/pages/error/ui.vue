<template>
  <div class="error-page">
    <Typography class="error-page__title" color="primary" tag-name="h1" is-bold>404</Typography>

    <Typography class="error-page__desc" color="primary" size="m" tag-name="h1">
      Ooops, its looks like...
      <Typography color="error" size="xl" tag-name="span">Error!</Typography>
    </Typography>
    <Button as-child color="main">
      <Link to="/">Back on main page</Link>
    </Button>
  </div>
</template>
<script setup lang="ts">
  import { Button } from '@/shared/ui/button'
  import { Link } from '@/shared/ui/link'
  import { Typography } from '@/shared/ui/typography'
</script>
<style lang="scss">
  .error-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    &__title {
      margin-bottom: 0 !important;
      font-size: 100px !important;
    }

    &__desc {
      margin-bottom: 12px !important;
      text-align: center;
    }
  }
</style>
