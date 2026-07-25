<template>
  <router-link :to="'/'" aria-label="TypeMore" class="logo">
    <h1>
      <div class="icon">
        <IconTypeMoreLogo aria-hidden="true" />
      </div>

      <span class="logo__text">TypeMore</span>
    </h1>
  </router-link>
</template>
<script setup lang="ts">
  import IconTypeMoreLogo from '~icons/typemore/logo'
</script>
<style lang="scss" scoped>
  .logo {
    display: flex;
    margin-right: 10px;
    text-decoration: none;
    user-select: none;

    & .icon {
      position: absolute;
      top: -50px;
      right: 50%;
      display: flex;
      transform: translate(50%, 50%);
      stroke: var(--main-color);

      & circle {
        fill: var(--main-color);
      }
    }

    &__text {
      @media screen and (width <=539px) {
        display: none;
      }
    }
  }

  h1 {
    position: relative;
    margin: 0;
    font-family: BalsamiqSans, sans-serif;
    color: var(--text-color);
    transform: translateY(23%);
  }

  @media screen and (width <=539px) {
    h1 {
      transform: none;
    }

    .logo {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 4px;

      & .icon {
        position: unset;
        transform: rotate(-60deg);
      }
    }
  }
</style>
