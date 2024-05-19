<template>
  <div>
    <ModalThemes />
    <p style="color:white"> Current: {{ store.input.current }}</p>
    <p style="color:white"> History: {{ store.input.history }}</p>

    <p style="color:white"> History: {{ timerStore.timer }}</p>
    <button @click="timerStore.start">Стар</button>
    <input type="text" v-model="store.input.current" @keydown.space.prevent="store.pushToHistory"
      @keydown.delete="store.backspaceToPrevious" dir="auto">
  </div>
</template>

<script setup lang="ts">
import { ModalThemes } from '@/widgets/theme'
import { useInputStore } from '@/entities/input/store';
import { useTimerStore } from '@/entities/timer/model/store';

const timerStore = useTimerStore()
const store = useInputStore()

</script>

<style scoped lang="scss"></style>
