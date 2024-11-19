<template>
  <div class="modalNews">
    <Button color="shadow" class="modalNews__close" size="s" @click="$emit('close')">
      <template #left-icon>
        <Icon :icon="'mingcute:close-fill'" width="30" />
      </template>
    </Button>

    <div class="modalNews__news news">
      <Typography class="news__title" color="primary" size="xl">
        <Icon icon="material-symbols:newsmode-outline-rounded" />News
      </Typography>
      <div class="news__data">
        <template v-if="loadingNews">
          <span class="loader" aria-hidden="true"></span>
        </template>
        <template v-else>
          <div v-for="newsItem in news" :key="newsItem.id">{{ newsItem.content }}</div>
        </template>
      </div>
    </div>

    <div class="modalNews__invites invites">
      <Typography class="invites__title" color="primary" size="xl">
        <Icon icon="lets-icons:message" />Invites
      </Typography>
      <div class="invites__data">
        <template v-if="loadingInvites">
          <span class="loader" aria-hidden="true"></span>
        </template>
        <template v-else>
          <div v-for="invite in invites" :key="invite.id">{{ invite.content }}</div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Button } from '@/shared/ui/button'
import { Typography } from '@/shared/ui/typography'
import { Icon } from '@iconify/vue'

const loadingNews = ref(true)
const loadingInvites = ref(true)
const news = ref<{ id: number; content: string }[]>([])
const invites = ref<{ id: number; content: string }[]>([])

onMounted(() => {
  setTimeout(() => {
    news.value = [
      { id: 1, content: 'News item 1' },
      { id: 2, content: 'News item 2' },
      { id: 3, content: 'News item 2' },
      { id: 4, content: 'News item 2' },
      { id: 5, content: 'News item 2' },
      { id: 6, content: 'News item 2' },
      { id: 7, content: 'News item 2' }
    ]
    loadingNews.value = false
  }, 2000)

  setTimeout(() => {
    invites.value = [
      { id: 1, content: 'Invite item 1' },
      { id: 2, content: 'Invite item 2' }
    ]
    loadingInvites.value = false
  }, 2000)
})
</script>

<style lang="scss" scoped>
.modalNews {
  display: flex;
  flex-direction: column;
  position: fixed;
  width: 100%;
  max-width: 350px;
  height: 100vh;
  z-index: var(--news-z);
  right: 0;
  top: 0;
  bottom: 0;
  box-shadow: 0 0 0 0.2em var(--sub-alt-color);
  background-color: var(--bg-color);
  padding: 54px 20px 20px 20px;
  border-radius: var(--border-radius) 0 0 var(--border-radius);
  gap: 20px;
  &__close {
    position: absolute;
    top: 10px;
    right: 0;
  }
}

.news,
.invites {
  &__title {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__data {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 148px;
    max-height: 148px;
    overflow-y: auto;
    width: 100%;
  }
}

.loader {
  min-width: 35px;
  min-height: 35px;
  border: 5px solid var(--sub-color);
  border-bottom-color: var(--text-color);
  border-radius: 50%;
  animation: rotation 1.5s linear infinite;
}

@keyframes rotation {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
