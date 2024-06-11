<template>
  <div class="fps">
    <p>FPS: {{ fps }}</p>
    <p>AVG: {{ avgFps }}</p>
    <p>MAX: {{ maxFps }}</p>
    <p>MIN: {{ minFps }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useFps } from '@vueuse/core'
// Use hook to count FPS
const fps = useFps()
const minFps = ref(0)
const maxFps = ref(0)
//Calc AVG FPC *10)/10 to be like in form 0.00
const avgFps = computed(() => Math.round(((minFps.value + fps.value + maxFps.value) / 3) * 10) / 10)
//Wach changes FPS to update values
watch(fps, (value: number) => {
  minFps.value = Math.min(minFps.value || value, value)
  maxFps.value = Math.max(maxFps.value, value)
})
</script>

<style lang="scss">
.fps {
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 1000;
  position: absolute;
  pointer-events: none;
  top: 20px;
  left: 20px;
  color: var(--main-color);
}
</style>
