<template>
  <div class="time-modal">
    <Typography tag-name="h2" color="primary">Custrom time amount</Typography>
    <TextInput placeholder="Set time" v-select min="0" @keydown.enter="saveTime" />
  </div>
</template>

<script lang="ts" setup>
  import { TextInput } from '@/shared/ui/input'
  import { Typography } from '@/shared/ui/typography'

  const saveTime = () => {}
</script>

<style lang="scss" scoped>
  .time-modal {
    padding: 30px;
  }
</style>
