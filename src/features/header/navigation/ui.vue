<template>
    <nav class="header-navigation">
        <ul class="header-navigation__list">
            <li class="list list__item" v-for="link in props.data" :key="link.link">
                <Popper hover arrow class="registration__popper" :content="link.label">
                    <router-link :to="link.link" class="list__link">
                        <Icon :icon="link.iconName" width="30" />
                    </router-link>
                </Popper>
            </li>
        </ul>
    </nav>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';
import Popper from 'vue3-popper';
interface Props {
    data: Array<{
        link: string;
        iconName: string;
        label: string;
    }>;
}
const props = defineProps<Props>()
</script>

<style lang="scss" scoped>
.header-navigation {
    display: flex;

    &__list {
        display: flex;
        gap: 8px
    }
}
</style>