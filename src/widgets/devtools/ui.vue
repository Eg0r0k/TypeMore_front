<template>
    <div class="devtools" :style="style">
        <div ref="devtoolsRef" class="devtools__head">
            <div class="dot--group" @click="toggleDevtools">

                <span class="dot"></span>
                <span class="dot"></span>
                <span class="dot"></span>
                <span class="dot"></span>
                <span class="dot"></span>
                <span class="dot"></span>
            </div>
        </div>

        <div class="devtools__body" v-if="isOpen">
            <div>
                <p color="primary">Timer:{{ configStore.config.time - timerStore.time }}</p>
                <p color="primary">State:{{ testState.isActive }}</p>
                <p color="primary">
                    Words: {{ testState.currentWordElementIndex }}/{{ configStore.config.words }}
                </p>
            </div>
            <div class="character-stats">
                <p>WPM: {{ getStats.wpm }}</p>
                <p>Raw WPM: {{ getStats.wpmRaw }}</p>
                <p>Correct Chars: {{ getStats.correctChars }}</p>
                <p>Missed Chars: {{ getStats.missedChars }}</p>
                <p>Extra Chars: {{ getStats.extraChars }}</p>
                <p>Spaces: {{ getStats.spaces }}</p>
            </div>
            <div>
                <p>Correct: {{ inputStore.accuracy.correct }}</p>
                <p>Incorrect: {{ inputStore.accuracy.incorrect }}</p>
                <p>Accuracy {{ inputStore.accuracyPercentage }}%</p>
            </div>
            <div style="max-width: 200px">
                <small>Histroy: {{ inputStore.input.history }}</small>
                <!-- <small>Miss: {{ inputStore.missedWords }} </small> -->
            </div>
        </div>


    </div>
</template>

<script lang="ts" setup>
import { useConfigStore } from '@/entities/config/model/store';
import { useInputStore } from '@/entities/input';
import { useTestStateStore } from '@/entities/test';
import { useTimerStore } from '@/entities/timer/model/store';
import { useStats } from '@/shared/lib/hooks/useStats';
import { useDraggable } from '@vueuse/core';
import { ref } from 'vue';

const { getStats } = useStats()
const inputStore = useInputStore()
const testState = useTestStateStore()
const configStore = useConfigStore()
const timerStore = useTimerStore()
const isOpen = ref(true);
const toggleDevtools = () => {
    isOpen.value = !isOpen.value
}

const devtoolsRef = ref<HTMLElement | null>(null)
const { x, y, style } = useDraggable(devtoolsRef, {
    initialValue: { x: 0, y: 45 },
    onMove: ({ x: newX, y: newY }) => {
        if (devtoolsRef.value) {
            const maxX = window.innerWidth - devtoolsRef.value!.offsetWidth
            const maxY = window.innerHeight - devtoolsRef.value!.offsetHeight
            x.value = Math.max(0, Math.min(newX, maxX))
            y.value = Math.max(0, Math.min(newY, maxY))
        }
    }
}
)

</script>

<style lang="scss" scoped>
.devtools {
    min-width: 300px;
    position: fixed;
    z-index: var(--fps-z);
    background-color: var(--sub-alt-color);
    border-radius: var(--border-radius);

    &__head {
        touch-action: none;
        display: flex;
        width: 100%;
        align-items: center;
        justify-content: center;
        cursor: grab;
        padding: 11px 20px 11px 20px;

    }

    &__body {
        padding: 0 20px 10px 20px;
    }

}

.dot {
    user-select: none;
    width: 4px;
    height: 4px;
    aspect-ratio: 1/1;
    background-color: var(--main-color);
    border-radius: 100%;

    &--group {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        grid-template-rows: 1fr 1fr;

        gap: 4px;
        padding: 2px;
    }
}
</style>