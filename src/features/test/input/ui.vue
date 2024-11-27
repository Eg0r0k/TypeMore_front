<template>
  <input
    aria-label="Type here"
    v-focus
    :disabled="!testState.isActive"
    :value="inputStore.input.current"
    type="text"
    dir="auto"
    @input="inputStore.handleInput($event)"
    @keydown="inputStore.handleKeyDown"
    @keyup="inputStore.handleKeyUp"
    @keydown.delete="handleBackspace($event)"
    @keydown.space.prevent="inputStore.handleSpace()"
  />
</template>

<script setup lang="ts">
  import { useInputStore } from '@entities/input/model/store'
  import { useTestStateStore } from '@/entities/test/model/store'

  const inputStore = useInputStore()
  const testState = useTestStateStore()

  const handleBackspace = (event: KeyboardEvent) => {
    if (event.key === 'Backspace' && inputStore.input.current.length === 0) {
      inputStore.backspaceToPrevious()
      if (inputStore.input.current) {
        inputStore.setWordToInput(inputStore.input.current + ' ')
      }
    }
  }
</script>

<style lang="scss" scoped></style>
