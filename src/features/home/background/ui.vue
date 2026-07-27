<template>
  <!--
    An <img> rather than a CSS `background-image`: `object-fit` maps 1:1 onto the three
    fit modes (cover / contain / max -> fill), and only a real element reports a failed
    load, so a dead remote URL hides the layer instead of leaving a broken tile behind
    the app. Nothing is rendered at all while both sources are empty.
  -->
  <img
    v-if="source && !failed"
    :src="source"
    :style="{ objectFit: fit }"
    class="custom-background"
    loading="lazy"
    draggable="false"
    alt=""
    aria-hidden="true"
    @error="failed = true"
  />
</template>

<script setup lang="ts">
  import { useConfigStore } from '@/entities/config'

  import { computed, ref, watch } from 'vue'

  const configStore = useConfigStore()

  // A locally picked image wins over the remote URL; '' on both means no background.
  const source = computed(
    () => configStore.config.backgroundLocal || configStore.config.backgroundImg || ''
  )

  // `max` stretches corner to corner; `cover`/`contain` are object-fit values already.
  const fit = computed(() =>
    configStore.config.backgroundSize === 'max' ? 'fill' : configStore.config.backgroundSize
  )

  const failed = ref(false)
  watch(source, () => (failed.value = false))
</script>

<style lang="scss" scoped>
  .custom-background {
    position: fixed;
    top: 0;
    left: 0;
    z-index: -1;
    width: 100vw;
    height: 100vh;

    // Purely decorative: it must never swallow a click meant for the app.
    pointer-events: none;
    user-select: none;
  }
</style>
