<template>
    <div class="words" :class="{ rightToLeft: props.isRightToLeft }" ref="wordsContainer">
        <template v-for="(word, wordIndex) in generator.retWords.words" :key="`${word}-${wordIndex}`">
            <p class="word" :class="{ active: wordIndex === testState.currentWordElementIndex }" ref="wordElements">
                <span v-for="(letter, letterIndex) in word" :key="`${letter}-${letterIndex}`"
                    :class="[inputStore.getLetterClass(wordIndex, letterIndex), { 'tab-character': letter === '\t', 'newline-character': letter === '\n' }]">
                    {{ letter === '\t' ? '→' : letter === '\n' ? '↵' : letter }}
                </span>
                <span v-for="(extraLetter, extraLetterIndex) in inputStore.getExtraLetters(wordIndex)"
                    :key="`extra-${extraLetter}-${extraLetterIndex}`" class="over-incorrect">
                    {{ extraLetter }}
                </span>
            </p>
        </template>
    </div>


    <div class="character-stats">
        <p>Correct characters: {{ inputStore.characterCounts.correct }}</p>
        <p>Incorrect characters: {{ inputStore.characterCounts.incorrect }}</p>
        <p>Extra characters: {{ inputStore.characterCounts.extra }}</p>
        <p>Total characters entered: {{ inputStore.characterCounts.total }}</p>
        <p>Correct spaces: {{ inputStore.characterCounts.correctSpaces }}</p>
        <p>Incorrect spaces: {{ inputStore.characterCounts.incorrectSpaces }}</p>
    </div>
</template>


<script lang="ts" setup>
import { useWordGeneratorStore } from '@/entities/generator/model/store';
import { useInputStore } from '@/entities/input/model';
import { useTestStateStore } from '@/entities/test';
import { nextTick, onMounted, ref } from 'vue';


interface Props {
    isRightToLeft?: boolean
}
const inputStore = useInputStore()
const testState = useTestStateStore()
const generator = useWordGeneratorStore()
const props = withDefaults(defineProps<Props>(), {
    isRightToLeft: false
})

</script>

<style lang="scss" scoped>
.incorrect {
    color: var(--error-color) !important;
}

.over-incorrect {
    color: var(--error-extra-color) !important;
}

.correct {
    color: var(--text-color) !important;
}

.rightToLeft {
    direction: rtl;
}


.words {
    display: flex;
    flex-wrap: wrap;
    width: 100%;
    align-content: flex-start;
    overflow: hidden;
    height: 142px;

}


.active {
    position: relative;

    /*&::before {
        content: "";
        position: absolute;
        left: -5px;
        height: 100%;
        width: 3px;
        animation: caretFlashSmooth 1s infinite;
        background-color: red;
    }
        */
}

.word {
    position: relative;
    font-size: 32px;
    line-height: 1em;
    margin: 8px;
    border-bottom: 2px solid transparent;
    color: var(--sub-color);
    //user-select: none;

    &:has(.over-incorrect) {
        border-bottom: 2px solid var(--error-extra-color) !important
    }

    &:has(.incorrect) {
        border-bottom: 2px solid var(--error-color)
    }
}

.newline-character {}
</style>