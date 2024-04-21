<template>
    <nav class="footer-navigation" title="footer navigation">
        <ul class="footer-navigation__list" title="links">
            <li class="list list__item" v-for="link in props.data" :key="link.label">
                <a :href="link.link" class="list__link" target="_blank" :title="link.label">
                    <Icon :icon="link.iconName" width="18" />
                    {{ link.label }}
                </a>
            </li>
        </ul>
    </nav>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';
interface Props {
    data: Array<{
        link: string;
        iconName: string;
        label: string;
    }>;
}
const props = defineProps<Props>()
</script>

<style scoped lang="scss">
.list {
    &__link {
        text-decoration: none;
        display: flex;
        align-items: center;
        gap: 2px;
    }
}

.footer-navigation {
    display: flex;

    &__list {
        display: flex;
        gap: 16px
    }
}
</style>