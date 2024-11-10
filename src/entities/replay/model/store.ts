import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
import { useSounds } from '@/shared/lib/hooks/useSounds'
import { Replay, ReplayAction } from '../types/replay'
import click1 from '/static/sounds/click3/click6_1.wav'
import click2 from '/static/sounds/click3/click6_2.wav'
import click3 from '/static/sounds/click3/click6_3.wav'
import click4 from '/static/sounds/click3/click6_11.wav'
import click5 from '/static/sounds/click3/click6_22.wav'
import click6 from '/static/sounds/click3/click6_33.wav'

import errorSound from '/static/sounds/error/error1_1.wav'
export const useReplayStore = defineStore('replay', () => {
  const replayData = reactive<Replay[]>([])
  const wordList = ref<string[]>([])
  let replayStartTime = 0
  let wordPos = 0
  let curPos = 0

  let timeoutList: NodeJS.Timeout[] = []
  let stopwatchList: NodeJS.Timeout[] = []

  const { playRandomClickSound, playErrorSound } = useSounds(
    [click1, click2, click3, click4, click5, click6],
    errorSound
  )

  function replayGetWordsList(wordsListFromScript: string[]): void {
    wordList.value = wordsListFromScript
  }

  function handleDisplayLogic(item: Replay): void {
    let activeWord = document.getElementById('replayWords')?.children[wordPos] as HTMLElement

    if (!activeWord) return

    if (item.action === 'correctLetter') {
      playRandomClickSound() // Звук при правильной букве
      activeWord.children[curPos]?.classList.add('correct')
      curPos++
    } else if (item.action === 'incorrectLetter') {
      playErrorSound() // Звук при неправильной букве
      const myElement = activeWord.children[curPos]
      if (myElement) {
        myElement.classList.add('incorrect')
      }
      curPos++
    } else if (item.action === 'setLetterIndex' && typeof item.value === 'number') {
      playRandomClickSound()
      curPos = item.value

      for (let i = curPos; i < activeWord.children.length; i++) {
        activeWord.children[i].className = ''
      }
    } else if (item.action === 'submitCorrectWord') {
      playRandomClickSound()
      wordPos++
      curPos = 0
    } else if (item.action === 'submitErrorWord') {
      playRandomClickSound()
      activeWord.classList.add('error')
      wordPos++
      curPos = 0
    } else if (item.action === 'backWord') {
      playRandomClickSound()
      wordPos--
      activeWord = document.getElementById('replayWords')?.children[wordPos] as HTMLElement
      curPos = activeWord.children.length
    }
  }

  // Старт записи реплея
  function startReplayRecording(): void {
    replayData.length = 0
    replayStartTime = performance.now()
    wordPos = 0
    curPos = 0
  }

  function stopReplayRecording(): void {}

  function addReplayEvent(action: ReplayAction, value?: string | number): void {
    const timeDelta = performance.now() - replayStartTime
    replayData.push({ action, value, time: timeDelta })
  }

  function playReplay(): void {
    const lastTime = replayData[replayData.length - 1]?.time ?? 0
    let lastEventTime = 0

    async function handleReplayEvents() {
      for (const item of replayData) {
        const delay = item.time - lastEventTime
        lastEventTime = item.time

        await new Promise((resolve) => {
          setTimeout(() => {
            console.log(item)
            handleDisplayLogic(item)
            resolve(null)
          }, delay)
        })
      }

      setTimeout(() => {
        wordPos = 0
        curPos = 0
      }, lastTime - lastEventTime)
    }

    handleReplayEvents()
  }

  function pauseReplay(): void {
    timeoutList.forEach((item) => clearTimeout(item))
    timeoutList = []
    stopwatchList.forEach((item) => clearTimeout(item))
    stopwatchList = []
  }

  function getReplayExport(): string {
    return JSON.stringify({
      replayData: replayData,
      wordList: wordList.value
    })
  }

  return {
    replayData,
    wordList,
    startReplayRecording,
    stopReplayRecording,
    addReplayEvent,
    playReplay,
    pauseReplay,
    getReplayExport,
    replayGetWordsList
  }
})
