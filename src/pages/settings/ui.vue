<template>
  <div>

    <p style="color:white"> Current: {{ inputStore.input.current }}</p>
    <p style="color:white"> History: {{ inputStore.input.history }}</p>
    <p style="color:white"> keypressTimings: {{ inputStore.keypressTimings.spacing }}</p>

    <p style="color:white"> Timer: {{ timerStore.time }}</p>
    <div v-if="lang">
      <p class="word" style="color:white" v-for="(word, index) in lang.words" :key="`${index + word}`">
        <span v-for="(letter, index) in word" :key="`${index + word}`">
          {{ letter }}
        </span>
      </p>

    </div>
    <p v-else style="color:white">Loading...</p>
    <div>
      <Button color="error" style="width:100%" @click="restartTest">
        Restart
      </Button>
      <Button style="width:100%" @click="init">Start</Button>
    </div>
    <input type="text" @keyup="recordKeyUp" @keydown="recordKeyDown" @input="startTest"
      v-model="inputStore.input.current" @keydown.space.prevent="inputStore.handleSpace"
      @keydown.delete="inputStore.backspaceToPrevious" dir="auto">
    <KeyMap />
    <TestChart />
  </div>
</template>

<script setup lang="ts">
import { TestChart } from '@/shared/ui/chart';
import { useConfigStore } from '@/entities/config/store';
import { useTestStateStore } from '@/entities/test';
import { Button } from '@/shared/ui/button';
import { getCurrentLang } from '@/shared/lib/helpers/json-files';
import { useInputStore } from '@entities/input/store';
import { useTimerStore } from '@entities/timer/model/store';
import { onMounted, ref } from 'vue';
import { KeyMap } from '@/features/layouts/keymap';
import { LanguageObj } from '@/shared/constants/type';
import { shuffle } from '@/shared/lib/helpers/arrays';

const testState = useTestStateStore();
const timerStore = useTimerStore();
const inputStore = useInputStore();
const { config } = useConfigStore();
const lang = ref<LanguageObj>();


const startTest = () => {
  if (!testState.isActive) {
    testState.setActive(true);
    timerStore.resetTimer();
    timerStore.startTimer();
  }
};
const recordKeyDown = (event: KeyboardEvent) => {
  const now = performance.now();

  let keyCode = event.code;
  if (keyCode === "NumpadEnter") {
    keyCode = "Space";
    inputStore.handleSpace();
  }
  setTimeout(() => {
    const finalKeyCode =
      keyCode === "" || event.which === 231 ? "NoCode" : keyCode;
    console.log(finalKeyCode)
    inputStore.recordKeyDown(now, finalKeyCode);
  }, 0);
}
const recordKeyUp = (event: KeyboardEvent) => {

  const now = performance.now();

  let keyCode = event.code;
  if (keyCode === "NumpadEnter") {
    keyCode = "Space";
    inputStore.handleSpace();
  }
  setTimeout(() => {
    const finalKeyCode =
      keyCode === "" || event.which === 231 ? "NoCode" : keyCode;
    inputStore.recordKeyUp(now, finalKeyCode);
  }, 0);
};
const restartTest = async () => {

  timerStore.resetTimer()
  testState.setActive(false);
  await init();
};

const init = async () => {
  console.debug('Start init');
  inputStore.reset();
  try {
    console.log(config.language);
    lang.value = await getCurrentLang(config.language);
    shuffle(lang.value.words)

  } catch (e) {
    console.error(`Cannot initialize test: ${e}`);
  }
};

onMounted(async () => {
  await init();
});
</script>



<style scoped lang="scss">
.word {
  display: inline-block;
  padding: 5px;
}
</style>
