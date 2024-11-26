import { reactive } from 'vue'
import { roundTo2 } from '../helpers/numbers'

interface KeyData {
  timestamp: number
  index: number
}

interface KeypressTimings {
  spacing: {
    first: number
    last: number
    array: number[]
  }
  duration: {
    array: number[]
  }
}

export const useKeypressTracking = () => {
  let keyDownData: Record<string, KeyData> = reactive({})
  let keypressTimings: KeypressTimings = reactive({
    spacing: { first: -1, last: -1, array: [] },
    duration: { array: [] }
  })
  let noCodeIndex = 0
  let keyOverlap = { total: 0, lastStartTime: -1 }
  function resetKeypressTimings(): void {
    keypressTimings = {
      spacing: {
        first: -1,
        last: -1,
        array: []
      },
      duration: {
        array: []
      }
    }
    keyOverlap = {
      total: 0,
      lastStartTime: -1
    }
    keyDownData = {}
    noCodeIndex = 0
    console.debug('Keypress timings reset')
  }
  function updateOverlap(now: number): void {
    const keys = Object.keys(keyDownData)
    if (keys.length > 1) {
      if (keyOverlap.lastStartTime === -1) {
        keyOverlap.lastStartTime = now
      }
    } else {
      if (keyOverlap.lastStartTime !== -1) {
        keyOverlap.total += now - keyOverlap.lastStartTime
        keyOverlap.lastStartTime = -1
      }
    }
  }

  const recordKeyupTime = (now: number, key: string) => {
    // if (!KAYS_TO_TRACK.includes(key)) {
    //   console.debug('Key not tracked', key)
    //   return
    // }

    if (key === 'NoCode') {
      key = `NoCode${noCodeIndex--}`
    }

    const keyDownDataForKey = keyDownData[key]
    if (!keyDownDataForKey) return

    const diff = Math.abs(keyDownDataForKey.timestamp - now)
    keypressTimings.duration.array[keyDownDataForKey.index] = diff
    console.debug('Keyup recorded', key, diff)

    delete keyDownData[key]

    updateOverlap(now)
  }
  const recordKeydownTime = (now: number, key: string) => {
    // if (!KAYS_TO_TRACK.includes(key)) {
    //   console.debug('Key not tracked', key)
    //   return
    // }

    if (key === 'NoCode') {
      key = `NoCode${noCodeIndex++}`
    }

    if (keyDownData[key]) {
      console.debug('Key already down', key)
      return
    }

    keyDownData[key] = {
      timestamp: now,
      index: keypressTimings.duration.array.length
    }

    keypressTimings.duration.array.push(0)
    updateOverlap(now)

    if (keypressTimings.spacing.last !== -1) {
      const diff = Math.abs(now - keypressTimings.spacing.last)
      keypressTimings.spacing.array.push(roundTo2(diff))
      console.debug('Keydown recorded', key, diff)
    }

    if (keypressTimings.spacing.first === -1) {
      keypressTimings.spacing.first = now
      console.debug('First keydown recorded', key, now)
    }

    keypressTimings.spacing.last = now
  }
  return {
    recordKeydownTime,
    recordKeyupTime,
    resetKeypressTimings
  }
}
