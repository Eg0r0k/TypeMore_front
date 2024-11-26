<template>
  <div class="errorPage">
    <Typography class="errorPage__title" color="primary" tagName="h1" isBold>404</Typography>

    <Typography class="errorPage__desc" color="primary" size="m" tagName="h1">
      Ooops, its looks like...
      <Typography color="error" size="xl" tagName="span">Error!</Typography>
    </Typography>
    <Button class="errorPage__button" to="/" color="main">Back on main page</Button>
  </div>
</template>
<script setup lang="ts">
  import { Button } from '@/shared/ui/button'
  import { Typography } from '@/shared/ui/typography'
</script>
<style lang="scss">
  .errorPage {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    &__title {
      font-size: 100px !important;
      margin-bottom: 0 !important;
    }
    &__desc {
      text-align: center;
      margin-bottom: 32px !important;
    }
    &__button {
    }
  }
</style>
