<template>
  <div class="input-modal" tabindex="0">
    <Typography color="primary" size="l"> Custom word amount </Typography>
    <TextInput :min="0" :max="10000" @keydown.enter="saveWordAmount" ref="textInputRef" tagName="input"
      v-model.number="wordAmount" placeholder="Enter word amount" />
    <Typography color="primary" size="xs">
      You can start an infinite test by inputting 0. Then, to stop the test, use the Bail Out
      feature
    </Typography>
    <Button @click="saveWordAmount" size="m" color="gray"> ok </Button>
  </div>
</template>

<script setup lang="ts">
import { TextInput } from '@/shared/ui/input'
import { Typography } from '@/shared/ui/typography'
import { Button } from '@/shared/ui/button'
import { useConfigStore } from '@/entities/config/model/store'
import { ref, onMounted, Ref } from 'vue'
import { useModal } from '@/entities/modal/model/store'

interface TextInputComponent {
  $refs: {
    inputEl: HTMLInputElement
  }
}

const modal = useModal()
const configStore = useConfigStore()
const wordAmount = ref(configStore.config.words)
const textInputRef: Ref<TextInputComponent | null> = ref(null)

const saveWordAmount = () => {
  console.log(wordAmount.value, typeof wordAmount.value)
  if (typeof wordAmount.value === 'number' && !(0 > wordAmount.value || wordAmount.value > 10000)) {
    configStore.setWords(wordAmount.value)
  }
  modal.close()
}

onMounted(() => {
  textInputRef.value?.$refs.inputEl?.select()
})
</script>

<style lang="scss" scoped>
.input-modal {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 500px;
  background: var(--bg-color);
  border-radius: var(--border-radius);
  padding: 24px;
  width: 100%;
  box-shadow: 0 0 0 0.2em var(--sub-alt-color);
}
</style>
