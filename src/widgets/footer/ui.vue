<template>
    <footer class="footer">

        <div class="footer__left">
            <FooterLinks :data="navLinks" />
        </div>
        <div class="footer__right"></div>

    </footer>
</template>

<script lang="ts" setup>
import { FooterLinks } from '@/features/footer/links';
import { Container } from '@/shared/ui/container';
import { FOOTER_LINKS } from '../footer/model/const/values';
const navLinks = FOOTER_LINKS
</script>

<style lang="scss" scoped>
.footer {
    display: flex;
  

    &__left {}
}
</style>