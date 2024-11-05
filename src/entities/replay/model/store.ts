import { defineStore } from 'pinia'

import { reactive, ref } from 'vue'
import { useSounds } from '@/shared/lib/hooks/useSounds'
import { Replay, ReplayAction } from '../types/replay'

export const useReplayStore = defineStore('replay', () => {
  const replayData = reactive<Replay[]>([])
  const wordList = ref<string[]>([])
  let replayStartTime = 0
  let timeoutList: NodeJS.Timeout[] = []
  let stopwatchList: NodeJS.Timeout[] = []
  const { playRandomClickSound, playErrorSound } = useSounds()
  const startRecordReplay = () => {
    replayStartTime = performance.now()
    stopwatchList = []
    timeoutList = []
  }
  const replayGetWordsList = (loadedWordList: string[]): void => {
    wordList.value = loadedWordList
  }
  const playReplay = () => {}
  const pauseReplay = (): void => {}
  const resumeReplay = () => {}
  const playSound = (error = false): void => {
    if (error) {
      playErrorSound()
    } else {
      playRandomClickSound()
    }
  }
  const addReplayEvent = (action: ReplayAction, value?: number | string): void => {
    const timeDelta = performance.now() - 1
  }

  return {
    playReplay,
    pauseReplay,
    resumeReplay,
    playSound,
    addReplayEvent,
    replayGetWordsList,
    wordList
  }
})
