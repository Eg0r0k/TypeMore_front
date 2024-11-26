<template>
  <div class="input-modal">
    <Typography tag-name="h2" color="primary" class="input-modal__title" size="l">
      Custom word amount
    </Typography>
    <TextInput
      ref="textInputRef"
      v-model.number="wordAmount"
      :min="0"
      :max="10000"
      tag-name="input"
      placeholder="Enter word amount"
      @keydown.enter="saveWordAmount"
    />
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
  const isValidWordAmount = (value: number) => value >= 0 && value <= 10000

  const saveWordAmount = () => {
    if (isValidWordAmount(wordAmount.value)) {
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

    &__title {
      margin-bottom: 0;
    }
  }
</style>
