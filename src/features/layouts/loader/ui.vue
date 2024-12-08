<template>
  <div class="loader-wrapper wrapper" role="loading">
    <header class="loader-wrapper__header">
      <Logo />
    </header>
    <div class="loader-wrapper__body">
      <div>
        <div class="loader"></div>
      </div>
    </div>
    <footer class="loader-wrapper__footer"></footer>
  </div>
</template>

<script lang="ts" setup>
  import { Logo } from '@/shared/ui/logo'
</script>

<style lang="scss" scoped>
  .wrapper {
    box-sizing: border-box;
    z-index: 0;
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 100%;
    max-width: 1532px;
    min-height: 100vh;
    margin: 0 auto;
    padding: 28px 16px;
    background-size: cover;
  }

  .loader {
    box-sizing: border-box;
    display: inline-block;
    min-width: 40px;
    min-height: 40px;
    border: 6px solid var(--main-color);
    border-bottom-color: var(--bg-color);
    border-radius: 100%;
    animation: rotation 1.5s linear infinite;
  }

  .loader-wrapper {
    display: flex;
    flex-direction: column;
    gap: 20px;
    align-items: center;
    justify-content: center;
    min-height: 100vh;

    &__header {
      display: flex;
      width: 100%;
    }

    &__body {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
    }
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
