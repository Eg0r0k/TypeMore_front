<template>
  <div class="modalNews">
    <Button size="s" @click="$emit('close')">
      <template #left-icon>
        <Icon :icon="'mingcute:close-fill'" width="30" />
      </template>
    </Button>
    <div class="modalNews__news news">
      <Typography class="news__title" color="primary" size="xl">
        <Icon icon="material-symbols:newsmode-outline-rounded" />News
      </Typography>
      <div class="news__data">data</div>
    </div>

    <div class="modalNews__invates invates">
      <Typography class="invates__title" color="primary" size="xl">
        <Icon icon="lets-icons:message" />Invates
      </Typography>
      <div class="invates__data">data</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Button } from '@/shared/ui/button'
import { Typography } from '@/shared/ui/typography'
import { Icon } from '@iconify/vue'
//TODO: Сделать отдельное модальное окно для новостей
//TODO: Добавить лоадинг для этого окна
</script>

<style lang="scss" scoped>
.modalNews {
  display: flex;
  flex-direction: column;
  position: fixed;
  height: 100%;
  z-index: var(--news-z);
  right: 0;
  top: 0;
  box-shadow: 0 0 0 0.2em var(--sub-alt-color);
  background-color: var(--bg-color);
  padding: 20px;
  border-radius: var(--border-radius) 0 0 var(--border-radius);
}
</style>
