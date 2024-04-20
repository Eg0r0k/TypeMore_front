<template>
    <header class="header">
        <Container class="wrapper">
            <Navigation :data="navigationLinks" />
            <router-link to="/login">
                <Icon :icon="'mdi:user'" width="30" />
            </router-link>
        </Container>
    </header>
</template>

<script lang="ts" setup>
import { Container } from '@/shared/ui/container';
import { Navigation } from '@/features/header/navigation';
import { Icon } from '@iconify/vue';
import { NAV_LINKS } from './model/const/values'
const navigationLinks = NAV_LINKS
</script>

<style lang="scss" scoped>
.header {
    display: flex;
    padding: 36px 0;
}
.wrapper 
{
    display: flex;
    justify-content: space-between;
}
</style>