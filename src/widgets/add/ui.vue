<template>
  <div class="add">
    <Typography class="add__text" is-bold size="xxl" tag="span" color="sub">
      ADD
      <IconAd width="50" height="50" />
    </Typography>
    <Typography color="sub">
      Oh... looks like you use add block. Please turn it off to support the site ♥
    </Typography>
  </div>
</template>

<script lang="ts" setup>
  import { Typography } from '@/shared/ui/typography'
  import IconAd from '~icons/tabler/ad'
</script>
<style lang="scss" scoped>
  .add {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin: 0 auto;
    padding: 15px;
    user-select: none;
    text-align: center;
    background-color: var(--sub-alt-color);
    border-radius: var(--border-radius);

    &__text {
      display: inline-flex;
      gap: 10px;
      margin-bottom: 5px;
    }
  }
</style>
