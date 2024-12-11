<template>
  <div class="error-page">
    <Typography class="error-page__title" color="primary" tagName="h1" isBold>404</Typography>

    <Typography class="error-page__desc" color="primary" size="m" tagName="h1">
      Ooops, its looks like...
      <Typography color="error" size="xl" tagName="span">Error!</Typography>
    </Typography>
    <Button class="error-page__button" to="/" color="main">Back on main page</Button>
  </div>
</template>
<script setup lang="ts">
  import { Button } from '@/shared/ui/button'
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
      margin-bottom: 32px !important;
      text-align: center;
    }
  }
</style>
