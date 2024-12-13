<template>
  <div class="custom-background">
    <img
      loading="lazy"
      :src="backgroundImg"
      draggable="false"
      @error="handleImageError"
      alt="Background Image"
      class="background-image"
    />
  </div>
</template>

<script setup lang="ts">
  import { useConfigStore } from '@/entities/config/model/store'

  const configStore = useConfigStore()
  const backgroundImg = configStore.config.backgroundImg

  const handleImageError = () => {
    console.log('implement alert on failed loading image [BackgroundImage.vue]')
  }
</script>

<style lang="scss" scoped>
  .custom-background {
    position: fixed;
    top: 0;
    left: 0;
    z-index: -1;
    width: 100vw;
    height: 100vh;
  }

  .custom-background img {
    position: absolute;
    top: 0;
    left: 0;
    z-index: -1;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>
