<template>
  <footer class="footer">
    <div class="footer__top">
      <div class="key-tip">
        <!-- TODO make key-tip component -->
      </div>
    </div>
    <div class="footer__bottom">
      <div class="footer__left">
        <FooterLinks :data="navLinks" />
      </div>
      <div class="footer__right">
        <Button @click="handleOnClickOpenModal">
          <template #left-icon>
            <Icon width="32" icon="fluent:dark-theme-20-filled"></Icon>
          </template>
        </Button>
      </div>
    </div>
  </footer>
</template>

<script lang="ts" setup>
import { Icon } from '@iconify/vue';
import { Button } from '@/shared/ui/button';
import { FooterLinks } from '@/features/footer/links'
import { FOOTER_LINKS } from '../footer/model/const/values'
import { useModal } from '@/entities/modal/store';
import { ModalThemes } from '../theme';
import { Typography } from '@/shared/ui/typography';
import { FooterLink } from './model/types/links';
const navLinks: FooterLink[] = FOOTER_LINKS
const modal = useModal()

const handleOnClickOpenModal = () => {
  modal.open(ModalThemes, [], true);
}
</script>

<style lang="scss" scoped>
.footer {
  display: flex;
  width: 100%;
  flex-wrap: wrap;
  z-index: var(--navigation-z);

  & kbd {
    background-color: var(--sub-color);
    border-radius: 2px;
    padding: 2px 4px;
  }

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

  }
}
</style>
