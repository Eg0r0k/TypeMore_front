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
        <Button size="s" @click="handleOnClickOpenTheme">
          <template #left-icon>
            <Icon width="12" icon="fluent:dark-theme-20-filled"></Icon>
          </template>
          {{ config.theme }}
        </Button>
        <Button size="s" @click="handleOnClickOpenInput">
          <template #left-icon>
            <Icon width="12" icon="ic:outline-bookmark"></Icon>
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
import { FooterLink } from './model/types/links'
import { ThemesModal } from '@/features/modal/themes'
import { InputModal } from '@/features/modal/input'
import { useConfigStore } from '@/entities/config/model/store'
const navLinks: FooterLink[] = FOOTER_LINKS
const modal = useModal()
const { config } = useConfigStore()
// Call function to open in modal component
const handleOnClickOpenTheme = () => {
  modal.open(ThemesModal, [], true)
}
// Call function to open in modal component
const handleOnClickOpenInput = () => {
  modal.open(InputModal, [], false)
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
    display: flex;
    justify-content: end;
    align-items: stretch;
  }
}
</style>
