<template>
  <div class="fps" role="status" aria-live="polite" :aria-label="`Fps counter ${fps}`">
    <dl>
      <dt>FPS:</dt>
      <dd>{{ fps }}</dd>
      <dt>AVG:</dt>
      <dd>{{ avgFps }}</dd>
      <dt>MAX:</dt>
      <dd>{{ maxFps }}</dd>
      <dt>MIN:</dt>
      <dd>{{ minFps }}</dd>
    </dl>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, watch } from 'vue'
  import { useFps } from '@vueuse/core'

  // Use hook to count FPS
  const fps = useFps()
  const minFps = ref(0)
  const maxFps = ref(0)

  // Calc AVG FPS
  const avgFps = computed(
    () => Math.round(((minFps.value + fps.value + maxFps.value) / 3) * 10) / 10
  )

  // Watch changes FPS to update values
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
    z-index: var(--fps-z);
    position: absolute;
    pointer-events: none;
    top: 20px;
    left: 20px;
    color: var(--text-color);

    & dl {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      font-weight: bold;
    }
  }
</style>
