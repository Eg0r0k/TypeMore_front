let timer = 0
let isRunning = false
let configTime = 0
let timeoutId: NodeJS.Timeout | null = null

interface WorkerMessage {
  command: string
  time?: number
}
/**
 * Handles incoming messages to the worker and executes commands (start, reset, setTime).
 *
 * @param event - The message event containing the command and optional time.
 */
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
/**
 * Starts the timer with the specified configuration time.
 *
 * @param time - The time duration for the timer.
 * @returns Return void if timer <= 0
 */
function startTimer(time: number | undefined) {
  if (typeof time !== 'number' || time <= 0) return
  isRunning = true
  configTime = time
  timer = 0
  timerStep()
}
/**
 * Resets the timer, stopping it and clearing the timeout if it exists.
 */
function resetTimer() {
  timer = 0
  isRunning = false

  if (timeoutId !== null) {
    clearTimeout(timeoutId)
  }
}
/**
 * Sets the configuration time for the timer.
 *
 * @param time - The time duration to set for the timer.
 */
function setConfigTime(time: number) {
  configTime = time
}
/**
 * Increments the timer and posts the current timer value to the main thread.
 * If the timer reaches the configured time, it stops and sends a stop command.
 */
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
