<template>
  <div class="words-modal">
    <Typography tag-name="h2" color="primary" class="words-modal__title" size="l">
      Custom word amount
    </Typography>
    <TextInput v-select v-model.number="wordAmount" min="0" max="10000" v-max-chars="5" type="number" tag-name="input"
      placeholder="Enter word amount" @keydown.enter="saveWordAmount" />
    <Typography color="primary" size="xs">
      You can start an infinite test by inputting 0. Then, to stop the test, use the Bail Out
      feature.
    </Typography>
    <Button size="m" color="gray" @click="saveWordAmount">ok</Button>
  </div>
</template>

<script setup lang="ts">
import { TextInput } from '@/shared/ui/input'
import { Typography } from '@/shared/ui/typography'
import { Button } from '@/shared/ui/button'
import { useConfigStore } from '@/entities/config/model/store'
import { ref } from 'vue'
import { useModal } from '@/entities/modal/model/store'

const modal = useModal()
const configStore = useConfigStore()
const wordAmount = ref(configStore.config.words)
const saveWordAmount = () => {
  configStore.setWords(wordAmount.value)
  modal.close()
}

</script>

<style lang="scss" scoped>
.words-modal {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 500px;
  padding: 24px;
  gap: 20px;
  background: var(--bg-color);
  border-radius: var(--border-radius);
  box-shadow: 0 0 0 0.2em var(--sub-alt-color);

  &__title {
    margin-bottom: 0;
  }
}
</style>
