<template>
  <footer class="footer">
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
  </footer>
</template>

<script lang="ts" setup>
import { Icon } from '@iconify/vue';
import { Button } from '@/shared/ui/button';
import { FooterLinks } from '@/features/footer/links'
import { FOOTER_LINKS } from '../footer/model/const/values'
import { useModal } from '@/entities/modal/store';
import { ModalThemes } from '../theme';
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
