let timer = 0
let isRunning = false
let configTime = 0
let timeoutId: NodeJS.Timeout | null = null

interface WorkerMessage {
  command: string
  time?: number
}

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { command, time } = event.data

  switch (command) {
    case 'start':
      startTimer(time)
      break
    case 'reset':
      resetTimer()
      break
    case 'setTime':
      if (time !== undefined) {
        setConfigTime(time)
      }
      break
    default:
      throw new Error(`Unknown command: ${command}`)
  }
}

function startTimer(time: number | undefined) {
  if (typeof time !== 'number' || time <= 0) return
  isRunning = true
  configTime = time
  timer = 0
  timerStep()
}

function resetTimer() {
  timer = 0
  isRunning = false

  if (timeoutId !== null) {
    clearTimeout(timeoutId)
  }
}
function setConfigTime(time: number) {
  configTime = time
}

function timerStep() {
  if (!isRunning) return

  postMessage({ timer })
  timer++
  if (timer >= configTime && configTime !== 0) {
    isRunning = false
    postMessage({ timer })
    postMessage({ command: 'stop' })
  } else {
    timeoutId = setTimeout(timerStep, 1000)
  }
}
