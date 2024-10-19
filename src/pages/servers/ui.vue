<template>
  <div class="serverPage">
    <div class="serverPage__head head">
      <Typography class="serverPage__title" color="primary" size="xxl" tag-name="h1">Welcome to <Typography
          tag-name="span" size="xxl" color="main">
          Servers </Typography>
      </Typography>
      <div class="serverPage__info">
        <Typography size="s" color="sub">Online <Typography tag-name="span" size="m" color="primary">{{ online }}
          </Typography>
        </Typography>
        <Typography size="xs" color="sub">ping <Typography tag-name="span" size="xs" color="sub">{{ ping }}ms
          </Typography>
        </Typography>
      </div>
    </div>
    <div class="serverPage__main main">
      <Button color="main-outline">Create room</Button>
      <Button color="main-outline">Browse lobbyes</Button>
      <Button color="main-outline">Enter code </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Button } from '@/shared/ui/button';
import { Typography } from '@/shared/ui/typography'
import { ref } from 'vue';
const online = ref(3)
const ping = ref(20)
</script>

<style scoped lang="scss">
.serverPage {
  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__main {
    display: flex;
    gap: 20px;
  }

  &__info {
    text-align: end;

  }

  &__title {
    margin-bottom: 0;
  }
}
</style>
