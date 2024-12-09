<template>
  <footer class="footer">
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
      <div class="footer__right">
        <Button size="s" color="shadow" @click="handleOnClickOpenTheme">
          <template #left-icon>
            <Icon width="20" icon="material-symbols:palette"></Icon>
          </template>
        </Button>
      </div>
    </div>
  </footer>
</template>

<script lang="ts" setup>
  import { Icon } from '@iconify/vue'
  import { Button } from '@/shared/ui/button'
  import { FooterLinks } from '@/features/footer/links'
  import { FOOTER_LINKS } from '../footer/model/const/values'
  import { useModal } from '@/entities/modal/model/store'
  import { ThemesModal } from '@/features/modal/themes'
  const navLinks = FOOTER_LINKS
  const modal = useModal()
  const handleOnClickOpenTheme = () => {
    modal.open(ThemesModal, 'top', 'center')
  }
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
