<template>
    <div class="controls">
        <Button color="main-outline" size="s" @click="handleOpenModalLang">
            <template #left-icon>
                <Icon width="24" icon="solar:globus-bold" />
            </template>
            {{ configStore.config.language }}
        </Button>
    </div>
</template>

<script setup lang="ts">
import { useConfigStore } from '@/entities/config/model/store';
import { useModal } from '@/entities/modal/model/store';
import { LangModal } from '@/features/modal/language'
import { Button } from '@/shared/ui/button';
import { Icon } from '@iconify/vue';
const configStore = useConfigStore()
const modal = useModal()
const handleOpenModalLang = (): void => {
    modal.open(LangModal, 'top')
}
</script>

<style lang="scss" scoped>
.controls {
    margin-bottom: 8px;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 20px;
}
</style>