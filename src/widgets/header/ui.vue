<template>
    <header class="header">
        <Navigation :data="navigationLinks" />
        <router-link to="/login" title="Login">
            <Icon :icon="'mdi:user'" width="30" />
        </router-link>
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
    justify-content: space-between;
}
</style>