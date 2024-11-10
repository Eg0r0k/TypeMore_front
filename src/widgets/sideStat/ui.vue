<template>
    <div class="side-container">
        <SideStats :statistics="firstFourStats" />
        <SideStats :statistics="secondFourStats" />
    </div>
</template>

<script setup lang="ts">
import { SideStats } from '@/features/profile/side';
import { Statistic } from '@/pages/profile/ui.vue';
import { computed } from 'vue';
const allStatistics: Statistic[] = [
    { mode: '15 seconds', value: 123, accuracy: 100 },
    { mode: '30 seconds', value: 15, accuracy: 100 },
    { mode: '60 seconds', value: null, accuracy: null },
    { mode: '120 seconds', value: 123, accuracy: 100 },
    { mode: '10 words', value: 45, accuracy: 75 },
    { mode: '30 words', value: null, accuracy: null },
    { mode: '60 words', value: 98, accuracy: 50 },
    { mode: '100 words', value: 62, accuracy: 25 }
]

const firstFourStats = computed(() => {
    return prepareStats(allStatistics.slice(0, 4))
})

const secondFourStats = computed(() => {
    return prepareStats(allStatistics.slice(4, 8))
})
function prepareStats(stats: Statistic[]): Statistic[] {
    return stats.map((stat) => ({
        mode: stat.mode,
        value: stat.value ?? '-',
        accuracy: stat.accuracy != null ? `${stat.accuracy}%` : '-'
    }))
}
</script>

<style lang="scss" scoped>
@media screen and (max-width: 784px) {
    .side-container {
        flex-direction: column;
    }
}

.side-container {

    display: flex;
    gap: 20px;

}
</style>