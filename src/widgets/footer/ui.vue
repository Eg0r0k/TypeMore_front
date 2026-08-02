<template>
  <!-- All of it, unlike the header: there is nothing down here that a run needs.
       Fades rather than unmounts so the page keeps its height. -->
  <footer
    class="footer transition-opacity duration-200 ease-out motion-reduce:transition-none"
    :class="{ 'opacity-0': screen.isTyping }"
    :inert="screen.isTyping"
  >
    <div class="footer__top">
      <div class="key-tip">
        <kbd>Ctrl</kbd>
        +
        <kbd>Enter</kbd>
        - Restart test
      </div>
    </div>
    <div class="footer__bottom">
      <div class="footer__left">
        <FooterLinks :links="navLinks" />
      </div>
      <div class="footer__right"></div>
    </div>
  </footer>
</template>

<script lang="ts" setup>
  import { FooterLinks } from '@/features/footer/links'
  import { useScreenStore } from '@/entities/screen'
  import { FOOTER_LINKS } from '../footer/model/const/values'

  const navLinks = FOOTER_LINKS
  const screen = useScreenStore()
</script>

<style lang="scss" scoped>
  .key-tip {
    margin-bottom: 20px;
    font-size: 0.7rem;
    line-height: 0.7rem;
    color: var(--sub-color);
    cursor: default;
  }

  .footer {
    display: flex;
    flex-wrap: wrap;

    &__top {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
    }

    &__bottom {
      display: flex;
      width: 100%;
    }

    &__left {
      display: flex;
      flex: 1;
      align-items: center;
    }

    &__right {
      display: flex;
      flex: 1;
      align-items: stretch;
      justify-content: end;
    }
  }
</style>
