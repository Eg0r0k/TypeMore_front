<template>
  <footer class="footer">
    <div class="footer__top">
      <div class="key-tip">
        <key>Ctrl</key>
        +
        <key>Enter</key>
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
    font-size: 0.7rem;
    line-height: 0.7rem;
    color: var(--sub-color);
  }

  .footer {
    display: flex;
    flex-wrap: wrap;

    &__top {
      width: 100%;
      display: inline-flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    }

    &__bottom {
      width: 100%;
      display: flex;
    }

    &__left {
      display: flex;
      align-items: center;
      flex: 1;
    }

    &__right {
      flex: 1;
      display: flex;
      justify-content: end;
      align-items: stretch;
    }
  }
</style>
